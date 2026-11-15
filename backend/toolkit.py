"""Academic Toolkit: 75% Attendance Safe-to-Skip, Habit Streaks, Budget & Exam Mode."""
import math
from datetime import date, datetime, timedelta
import calendar
import db
import llm


# -------------------- ATTENDANCE & 75% SAFE-TO-SKIP --------------------
def get_attendance():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM attendance ORDER BY subject").fetchall()
    results = []
    for r in rows:
        att = r["attended"]
        tot = r["total"]
        target = r["target_pct"] if r["target_pct"] else 75.0
        pct = round((att / tot * 100), 1) if tot > 0 else 100.0

        if pct >= target:
            # How many more can skip?
            # (att) / (tot + S) >= target/100  =>  att >= (target/100)*(tot + S)
            # S <= (att / (target/100)) - tot
            safe_to_skip = math.floor((att / (target / 100.0)) - tot)
            safe_to_skip = max(0, safe_to_skip)
            status_text = f"Safe to skip {safe_to_skip} class(es)" if safe_to_skip > 0 else "On the border (cannot skip)"
            is_safe = True
        else:
            # How many consecutive classes needed?
            # (att + C) / (tot + C) >= target/100
            # att + C >= (target/100)*tot + (target/100)*C
            # C * (1 - target/100) >= (target/100)*tot - att
            needed = math.ceil(((target / 100.0) * tot - att) / (1.0 - (target / 100.0)))
            needed = max(1, needed)
            safe_to_skip = 0
            status_text = f"Needs {needed} consecutive class(es)"
            is_safe = False

        results.append({
            "id": r["id"],
            "subject": r["subject"],
            "attended": att,
            "total": tot,
            "percentage": pct,
            "target_pct": target,
            "safe_to_skip": safe_to_skip,
            "needed_consecutive": 0 if is_safe else needed,
            "status_text": status_text,
            "is_safe": is_safe,
        })
    return results


def update_attendance(subject, attended, total, target_pct=75.0):
    with db.conn() as c:
        c.execute(
            """INSERT INTO attendance(subject, attended, total, target_pct)
               VALUES(?,?,?,?)
               ON CONFLICT(subject) DO UPDATE SET attended=?, total=?, target_pct=?""",
            (subject, attended, total, target_pct, attended, total, target_pct),
        )
    return get_attendance()


def mark_class_attendance(subject, attended=True):
    with db.conn() as c:
        row = c.execute("SELECT * FROM attendance WHERE subject=?", (subject,)).fetchone()
        if row:
            new_att = row["attended"] + (1 if attended else 0)
            new_tot = row["total"] + 1
            c.execute(
                "UPDATE attendance SET attended=?, total=? WHERE subject=?",
                (new_att, new_tot, subject),
            )
    return get_attendance()


# -------------------- HABIT & ROUTINE COACH --------------------
def get_habits():
    today = date.today().isoformat()
    with db.conn() as c:
        rows = c.execute("SELECT * FROM habits ORDER BY id").fetchall()
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "category": r["category"],
            "streak": r["streak"],
            "completed_today": 1 if r["last_completed_date"] == today else 0,
        }
        for r in rows
    ]


def toggle_habit(habit_id):
    today = date.today().isoformat()
    with db.conn() as c:
        row = c.execute("SELECT * FROM habits WHERE id=?", (habit_id,)).fetchone()
        if not row:
            return get_habits()
        completed = row["last_completed_date"] == today
        if completed:
            # Uncheck
            c.execute(
                "UPDATE habits SET last_completed_date=NULL, completed_today=0 WHERE id=?",
                (habit_id,),
            )
        else:
            # Mark complete and increment streak
            new_streak = row["streak"] + 1
            c.execute(
                "UPDATE habits SET last_completed_date=?, completed_today=1, streak=? WHERE id=?",
                (today, new_streak, habit_id),
            )
    return get_habits()


def add_habit(title, category="Study"):
    with db.conn() as c:
        c.execute(
            "INSERT INTO habits(title, category, streak, completed_today) VALUES(?,?,0,0)",
            (title, category),
        )
    return get_habits()


# -------------------- HOSTEL BUDGET TRACKER --------------------
def get_budget():
    today = date.today()
    # Calculate days remaining in current month
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_left = max(1, days_in_month - today.day + 1)

    with db.conn() as c:
        expenses = c.execute("SELECT * FROM budget ORDER BY id DESC").fetchall()

    total_spent = sum(r["amount"] for r in expenses if r["type"] == "expense")
    total_allowance = sum(r["amount"] for r in expenses if r["type"] == "allowance")
    if total_allowance == 0:
        total_allowance = 6000.0  # standard monthly student baseline

    remaining = max(0.0, total_allowance - total_spent)
    daily_safe_spend = round(remaining / days_left, 1)

    return {
        "total_allowance": total_allowance,
        "total_spent": total_spent,
        "remaining": remaining,
        "days_left_in_month": days_left,
        "daily_safe_spend": daily_safe_spend,
        "history": [
            {
                "id": r["id"],
                "title": r["title"],
                "amount": r["amount"],
                "category": r["category"],
                "type": r["type"],
                "date": r["date"],
            }
            for r in expenses[:10]
        ],
    }


def add_budget_entry(title, amount, category="Food", type_="expense"):
    today_str = date.today().isoformat()
    with db.conn() as c:
        c.execute(
            "INSERT INTO budget(title, amount, category, type, date) VALUES(?,?,?,?,?)",
            (title, amount, category, type_, today_str),
        )
    return get_budget()


# -------------------- EXAM MODE REVISION PLANNER --------------------
def generate_exam_plan(subject, exam_date_str, topics_str):
    today = date.today()
    try:
        exam_dt = date.fromisoformat(exam_date_str)
        days_until = (exam_dt - today).days
    except Exception:
        days_until = 7
        exam_dt = today + timedelta(days=7)

    days_until = max(1, days_until)
    topics = [t.strip() for t in topics_str.split(",") if t.strip()]
    if not topics:
        topics = ["Core Theory & Formulas", "Previous Year Questions", "Unit 1 & 2 Review", "Viva Preparation"]

    # Prompt LLM for structured revision breakdown
    prompt = (
        f"Subject: {subject}\n"
        f"Days remaining until Exam: {days_until} days (Exam on {exam_dt.isoformat()})\n"
        f"Topics to cover: {', '.join(topics)}\n\n"
        "Generate a high-intensity, stress-minimized day-by-day revision roadmap for an engineering student. "
        "Divide the remaining days into: Stage 1 (Deep Concept Grasp), Stage 2 (Problem Solving & PYQ drill), "
        "and Final Stage (Formula Sheet & High-Yield Mock test). "
        "Keep it actionable, encouraging, and formatted clearly with day tags like [Day 1], [Day 2], etc."
    )
    plan_text = llm.chat([
        {"role": "system", "content": "You are a master engineering exam strategist."},
        {"role": "user", "content": prompt},
    ], temperature=0.3)

    with db.conn() as c:
        c.execute(
            "INSERT INTO exam_plans(subject, exam_date, syllabus_topics, plan_json) VALUES(?,?,?,?)",
            (subject, exam_date_str, topics_str, plan_text),
        )

    return {
        "subject": subject,
        "exam_date": exam_dt.isoformat(),
        "days_until": days_until,
        "roadmap": plan_text,
    }
