"""Chrono-Regulator: Intelligent schedule & deadline optimization for engineering students."""
import json
import re
from datetime import date, datetime, timedelta
import db
import llm
import toolkit

TYPE_WEIGHT = {
    "exam": 25,
    "lab": 18,
    "assignment": 14,
    "project": 12,
    "placement": 15,
    "other": 5,
}


def extract_task(text):
    today_str = date.today().isoformat()
    prompt = (
        f"Today is {today_str}. The current year is {date.today().year}. "
        "Extract ONE academic task or deadline from the pasted message below. "
        "Turn relative days like 'tomorrow', 'this Friday', 'next Monday', or 'end of month' into real ISO dates (YYYY-MM-DD). "
        "Allowed types: exam, lab, assignment, project, placement, other. "
        "Return ONLY a single valid JSON object:\n"
        '{"title": "...", "due_date": "YYYY-MM-DD", "type": "exam|lab|assignment|project|placement|other"}\n\n'
        f"Message:\n{text}"
    )
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0)
    found = re.findall(r"\{[^{}]*\}", raw, re.DOTALL)
    if not found:
        return {
            "title": text.strip()[:60],
            "due_date": (date.today() + timedelta(days=2)).isoformat(),
            "type": "assignment",
        }
    try:
        data = json.loads(found[-1])
        datetime.strptime(data["due_date"], "%Y-%m-%d")
    except Exception:
        data = {
            "title": text.strip()[:60] or "Important Academic Task",
            "due_date": (date.today() + timedelta(days=2)).isoformat(),
            "type": "assignment",
        }

    if data.get("type") not in TYPE_WEIGHT:
        data["type"] = "assignment"
    return {
        "title": str(data.get("title", "Important Task"))[:120],
        "due_date": data["due_date"],
        "type": data["type"],
    }


def add_task(title, due_date, type_="assignment"):
    with db.conn() as c:
        cur = c.execute(
            "INSERT INTO tasks(title,due_date,type,done) VALUES(?,?,?,0)",
            (title, due_date, type_),
        )
        return cur.lastrowid


def mark_done(task_id):
    with db.conn() as c:
        c.execute("UPDATE tasks SET done=1 WHERE id=?", (task_id,))


def delete_task(task_id):
    with db.conn() as c:
        c.execute("DELETE FROM tasks WHERE id=?", (task_id,))


def replan_missed_tasks():
    today = date.today()
    with db.conn() as c:
        overdue = c.execute(
            "SELECT * FROM tasks WHERE done=0 AND due_date < ?", (today.isoformat(),)
        ).fetchall()
        for t in overdue:
            new_date = today.isoformat()
            c.execute(
                "UPDATE tasks SET due_date=?, priority_override=99 WHERE id=?",
                (new_date, t["id"]),
            )
    return {"replanned_count": len(overdue), "status": "Missed tasks prioritized for immediate recovery today."}


def _score(task, today):
    task_due = date.fromisoformat(task["due_date"])
    days = (task_due - today).days

    if days < 0:
        urgency, why = 100, f"⚠️ Overdue by {-days} day(s)"
    elif days == 0:
        urgency, why = 95, "🚨 Due TODAY"
    elif days == 1:
        urgency, why = 85, "⏰ Due tomorrow"
    elif days <= 3:
        urgency, why = 70, f"Due in {days} days"
    elif days <= 7:
        urgency, why = 45, f"Due in {days} days"
    else:
        urgency, why = 20, f"Due in {days} days"

    weight = TYPE_WEIGHT.get(task.get("type", "other"), 5)
    priority = urgency + weight
    if task.get("priority_override"):
        priority = max(priority, task["priority_override"])
    return priority, days, why


def plan_today():
    today = date.today()
    with db.conn() as c:
        tasks = [dict(r) for r in c.execute("SELECT * FROM tasks WHERE done=0")]
        last_checkin = c.execute(
            "SELECT score, level, advice FROM checkins ORDER BY id DESC LIMIT 1"
        ).fetchone()

    items = []
    for t in tasks:
        priority, days, why = _score(t, today)
        items.append({
            "id": t["id"],
            "title": t["title"],
            "type": t["type"],
            "due_date": t["due_date"],
            "days_left": days,
            "priority": priority,
            "reason": why,
        })

    items.sort(key=lambda x: -x["priority"])

    # Check holiday status for today
    holiday_info = toolkit.is_holiday(today.isoformat())

    burnout_score = last_checkin["score"] if last_checkin else 25
    if holiday_info["is_holiday"]:
        tip = f"🎉 Today is a College Holiday: '{holiday_info['name']}'! No classes scheduled. Recharge or study at your own pace."
    elif last_checkin is None:
        tip = "⚡ Welcome to ScholarIQ! Complete a 30-second wellness check-in to dynamically tune your daily workload."
    elif burnout_score >= 65:
        tip = "⚠️ High burnout risk detected! Chrono-Regulator has compressed your day: focus on top 2 priorities and defer the rest."
        items = items[:2] + [dict(i, deferred=True) for i in items[2:]]
    elif burnout_score >= 35:
        tip = "💡 Moderate load. Work in focused 25-minute Pomodoro bursts with 5-minute stretch & eye breaks."
    else:
        tip = "🔥 High stamina day! Clear your hardest academic assignments first while focus is peak."

    # Today's timetable
    day_name = today.strftime("%A")
    tt_result = toolkit.get_timetable_for_day(day_name, today.isoformat())

    return {
        "items": items,
        "tip": tip,
        "burnout_score": burnout_score,
        "burnout_level": last_checkin["level"] if last_checkin else "Low",
        "is_holiday": tt_result["is_holiday"],
        "holiday_name": tt_result.get("holiday_name", ""),
        "timetable": tt_result["classes"],
        "clashes": tt_result["clashes"],
    }
