"""Chrono-Regulator: tasks, deadline extraction, and the daily priority plan."""
import json
import re
from datetime import date, datetime
import db
import llm

TYPE_WEIGHT = {"exam": 15, "lab": 10, "assignment": 8, "project": 5, "other": 0}


def extract_task(text):
    prompt = (
        f"Today is {date.today().isoformat()}. Extract ONE academic task from the message. "
        'Reply with ONLY JSON like {"title": "...", "due_date": "YYYY-MM-DD", '
        '"type": "exam|lab|assignment|project|other"}. '
        "Turn words like 'tomorrow' or 'Friday' into a real date.\n\nMessage: " + text
    )
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0)
    found = re.findall(r"\{[^{}]*\}", raw, re.S)
    if not found:
        raise ValueError("The model did not return a task. Try rephrasing the message.")
    data = json.loads(found[-1])
    datetime.strptime(data["due_date"], "%Y-%m-%d")  # raises if the date is invalid
    if data.get("type") not in TYPE_WEIGHT:
        data["type"] = "other"
    return {"title": str(data["title"])[:120], "due_date": data["due_date"], "type": data["type"]}


def add_task(title, due_date, type_):
    with db.conn() as c:
        cur = c.execute("INSERT INTO tasks(title,due_date,type) VALUES(?,?,?)",
                        (title, due_date, type_))
        return cur.lastrowid


def mark_done(task_id):
    with db.conn() as c:
        c.execute("UPDATE tasks SET done=1 WHERE id=?", (task_id,))


def _score(task, today):
    days = (date.fromisoformat(task["due_date"]) - today).days
    if days < 0:
        urgency, why = 100, f"Overdue by {-days} day(s)"
    elif days == 0:
        urgency, why = 95, "Due today"
    elif days == 1:
        urgency, why = 85, "Due tomorrow"
    elif days <= 3:
        urgency, why = 65, f"Due in {days} days"
    elif days <= 7:
        urgency, why = 40, f"Due in {days} days"
    else:
        urgency, why = 10, f"Due in {days} days"
    return urgency + TYPE_WEIGHT.get(task["type"], 0), days, why


def plan_today():
    today = date.today()
    with db.conn() as c:
        tasks = [dict(r) for r in c.execute("SELECT * FROM tasks WHERE done=0")]
        last = c.execute("SELECT score FROM checkins ORDER BY id DESC LIMIT 1").fetchone()
    items = []
    for t in tasks:
        priority, days, why = _score(t, today)
        items.append({"id": t["id"], "title": t["title"], "type": t["type"],
                      "due_date": t["due_date"], "days_left": days,
                      "priority": priority, "reason": why})
    items.sort(key=lambda x: -x["priority"])
    if last is None:
        tip = "Do a quick check-in so ScholarIQ can adapt today's plan to how you feel."
    elif last["score"] >= 65:
        tip = "Burnout risk is high. Focus on your top 2 tasks only and protect your sleep tonight."
        items = items[:2] + [dict(i, deferred=True) for i in items[2:]]
    elif last["score"] >= 35:
        tip = "Moderate load. Work in 25-minute focus blocks with short breaks."
    else:
        tip = "Energy looks good. Start with your highest-priority task."
    return {"items": items, "tip": tip}
