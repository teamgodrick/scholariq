"""Chrono-Regulator: Intelligent schedule & deadline optimization for engineering students."""
import json
import re
from datetime import date, datetime, timedelta
import db
import llm

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
        # Fallback keyword parser
        return {
            "title": text.strip()[:60],
            "due_date": (date.today() + timedelta(days=2)).isoformat(),
            "type": "assignment",
        }
    data = json.loads(found[-1])
    try:
        datetime.strptime(data["due_date"], "%Y-%m-%d")
    except Exception:
        data["due_date"] = (date.today() + timedelta(days=1)).isoformat()

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
    """Finds all overdue tasks, shifts their target focus, and re-sequences priorities."""
    today = date.today()
    with db.conn() as c:
        overdue = c.execute(
            "SELECT * FROM tasks WHERE done=0 AND due_date < ?", (today.isoformat(),)
        ).fetchall()
        for t in overdue:
            # Reschedule overdue tasks to today or tomorrow with an alert
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

    burnout_score = last_checkin["score"] if last_checkin else 25
    if last_checkin is None:
        tip = "⚡ Welcome to ScholarIQ! Complete a 30-second wellness check-in to dynamically tune your daily workload."
    elif burnout_score >= 65:
        tip = "⚠️ High burnout risk detected! Chrono-Regulator has compressed your day: focus on top 2 priorities and defer the rest."
        items = items[:2] + [dict(i, deferred=True) for i in items[2:]]
    elif burnout_score >= 35:
        tip = "💡 Moderate load. Work in focused 25-minute Pomodoro bursts with 5-minute stretch & eye breaks."
    else:
        tip = "🔥 High stamina day! Clear your hardest academic assignments first while focus is peak."

    # Also fetch today's timetable
    day_name = today.strftime("%A")
    today_classes, clashes = get_timetable_for_day(day_name)

    return {
        "items": items,
        "tip": tip,
        "burnout_score": burnout_score,
        "burnout_level": last_checkin["level"] if last_checkin else "Low",
        "timetable": today_classes,
        "clashes": clashes,
    }


def get_timetable_for_day(day_name):
    with db.conn() as c:
        classes = [
            dict(r)
            for r in c.execute(
                "SELECT * FROM timetable WHERE day_of_week=? ORDER BY start_time",
                (day_name,),
            ).fetchall()
        ]

    # Detect clashes
    clashes = []
    for i in range(len(classes)):
        for j in range(i + 1, len(classes)):
            c1, c2 = classes[i], classes[j]
            # Simple overlap check: c1 start < c2 end and c2 start < c1 end
            if c1["start_time"] < c2["end_time"] and c2["start_time"] < c1["end_time"]:
                clashes.append(f"Clash between {c1['subject']} ({c1['start_time']}) and {c2['subject']} ({c2['start_time']})")

    return classes, clashes


def add_timetable_class(day_of_week, subject, start_time, end_time, room, professor, type_="Lecture"):
    with db.conn() as c:
        c.execute(
            """INSERT INTO timetable(day_of_week, subject, start_time, end_time, room, professor, type)
               VALUES(?,?,?,?,?,?,?)""",
            (day_of_week, subject, start_time, end_time, room, professor, type_),
        )
    return {"ok": True}
