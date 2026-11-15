"""Academic Toolkit: Attendance (P/A/C), Safe-to-Skip, Holidays, Timetable, Habits, Budget, Exam Mode."""
import io
import json
import math
from datetime import date, datetime, timedelta
import calendar
import re
import db
import llm


# -------------------- ATTENDANCE & 75% SAFE-TO-SKIP --------------------
def get_attendance():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM attendance ORDER BY id").fetchall()
    results = []
    for r in rows:
        att = r["attended"]
        tot = r["total"]
        target = r["target_pct"] if r["target_pct"] else 75.0
        pct = round((att / tot * 100), 1) if tot > 0 else 100.0

        if tot == 0:
            safe_to_skip = 0
            needed = 0
            status_text = "No classes held yet."
            is_safe = True
        elif pct >= target:
            # Safe to skip formula from the-thing: Math.floor((att * 100) / target) - tot
            safe_to_skip = math.floor((att * 100.0) / target) - tot
            safe_to_skip = max(0, safe_to_skip)
            status_text = f"Safe to skip {safe_to_skip} class(es)" if safe_to_skip > 0 else "Borderline (attend next class)"
            needed = 0
            is_safe = True
        else:
            # Needed consecutive formula from the-thing: Math.ceil(((target * tot) - (att * 100)) / (100 - target))
            needed = math.ceil(((target * tot) - (att * 100.0)) / (100.0 - target))
            needed = max(1, needed)
            safe_to_skip = 0
            status_text = f"Deficit: Attend {needed} consecutive class(es)"
            is_safe = False

        results.append({
            "id": r["id"],
            "subject": r["subject"],
            "short_code": r["short_code"] or r["subject"][:12],
            "color": r["color"] or "#a855f7",
            "attended": att,
            "total": tot,
            "total_semester": r["total_semester"] or 60,
            "percentage": pct,
            "target_pct": target,
            "safe_to_skip": safe_to_skip,
            "needed_consecutive": needed,
            "status_text": status_text,
            "is_safe": is_safe,
        })
    return results


def add_subject(subject, short_code="", color="#a855f7", attended=0, total=0, total_semester=60, target_pct=75.0):
    with db.conn() as c:
        c.execute(
            """INSERT INTO attendance(subject, short_code, color, attended, total, total_semester, target_pct)
               VALUES(?,?,?,?,?,?,?)""",
            (subject, short_code or subject[:12], color, attended, total, total_semester, target_pct),
        )
    return get_attendance()


def edit_subject(subject_id, subject, short_code, color, attended, total, total_semester, target_pct=75.0):
    with db.conn() as c:
        c.execute(
            """UPDATE attendance
               SET subject=?, short_code=?, color=?, attended=?, total=?, total_semester=?, target_pct=?
               WHERE id=?""",
            (subject, short_code, color, attended, total, total_semester, target_pct, subject_id),
        )
    return get_attendance()


def delete_subject(subject_id):
    with db.conn() as c:
        c.execute("DELETE FROM attendance WHERE id=?", (subject_id,))
        c.execute("DELETE FROM attendance_logs WHERE subject_id=?", (subject_id,))
    return get_attendance()


def mark_class_attendance(subject_id, mark="P", note=""):
    """
    Mark:
    - 'P': Present (+1 attended, +1 total)
    - 'A': Absent (+0 attended, +1 total)
    - 'C': No class / cancelled / holiday (+0 attended, +0 total - neutral, does not hurt percentage!)
    """
    today_str = date.today().isoformat()
    with db.conn() as c:
        row = c.execute("SELECT * FROM attendance WHERE id=?", (subject_id,)).fetchone()
        if row:
            att = row["attended"]
            tot = row["total"]
            if mark == "P":
                att += 1
                tot += 1
            elif mark == "A":
                tot += 1
            # If mark == 'C' (No class), neither changes

            c.execute(
                "UPDATE attendance SET attended=?, total=? WHERE id=?",
                (att, tot, subject_id),
            )
            c.execute(
                "INSERT INTO attendance_logs(subject_id, date, mark, note) VALUES(?,?,?,?)",
                (subject_id, today_str, mark, note),
            )
    return get_attendance()


# -------------------- HOLIDAYS & ACADEMIC CALENDAR --------------------
def get_holidays():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM holidays ORDER BY date").fetchall()
    return [dict(r) for r in rows]


def add_holiday(date_str, name, type_="Holiday"):
    with db.conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO holidays(date, name, type) VALUES(?,?,?)",
            (date_str, name, type_),
        )
    return get_holidays()


def delete_holiday(holiday_id):
    with db.conn() as c:
        c.execute("DELETE FROM holidays WHERE id=?", (holiday_id,))
    return get_holidays()


def is_holiday(date_str=None):
    if not date_str:
        date_str = date.today().isoformat()
    with db.conn() as c:
        row = c.execute("SELECT * FROM holidays WHERE date=?", (date_str,)).fetchone()
        if row:
            return {"is_holiday": True, "name": row["name"], "type": row["type"], "date": row["date"]}
    return {"is_holiday": False}


def parse_academic_calendar(text):
    """Parses text or syllabus for dates and holidays."""
    # Look for patterns like "26 Jan - Republic Day" or "2026-10-31 Diwali"
    lines = text.split("\n")
    found_count = 0
    with db.conn() as c:
        for line in lines:
            line = line.strip()
            # Match YYYY-MM-DD or DD Month format
            date_match = re.search(r"(\d{4}-\d{2}-\d{2})[:\s-]+([A-Za-z0-9\s,]+)", line)
            if date_match:
                d_str = date_match.group(1)
                h_name = date_match.group(2).strip()
                c.execute("INSERT OR REPLACE INTO holidays(date, name, type) VALUES(?,?,?)", (d_str, h_name, "Calendar Holiday"))
                found_count += 1
    return {"imported": found_count, "holidays": get_holidays()}


# -------------------- TIMETABLE MANAGEMENT --------------------
def get_timetable_for_day(day_name=None, date_str=None):
    if not date_str:
        date_str = date.today().isoformat()
    if not day_name:
        day_name = date.fromisoformat(date_str).strftime("%A")

    holiday_info = is_holiday(date_str)
    if holiday_info["is_holiday"]:
        return {
            "day": day_name,
            "date": date_str,
            "is_holiday": True,
            "holiday_name": holiday_info["name"],
            "classes": [],
            "clashes": [],
        }

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
            if c1["start_time"] < c2["end_time"] and c2["start_time"] < c1["end_time"]:
                clashes.append(f"Clash between {c1['subject']} ({c1['start_time']}) and {c2['subject']} ({c2['start_time']})")

    return {
        "day": day_name,
        "date": date_str,
        "is_holiday": False,
        "classes": classes,
        "clashes": clashes,
    }


def add_timetable_entry(day_of_week, subject, start_time, end_time, room, professor, type_="Lecture"):
    with db.conn() as c:
        c.execute(
            """INSERT INTO timetable(day_of_week, subject, start_time, end_time, room, professor, type)
               VALUES(?,?,?,?,?,?,?)""",
            (day_of_week, subject, start_time, end_time, room, professor, type_),
        )
    return get_timetable_for_day(day_of_week)


def delete_timetable_entry(entry_id, day_of_week="Monday"):
    with db.conn() as c:
        c.execute("DELETE FROM timetable WHERE id=?", (entry_id,))
    return get_timetable_for_day(day_of_week)


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
            c.execute(
                "UPDATE habits SET last_completed_date=NULL, completed_today=0 WHERE id=?",
                (habit_id,),
            )
        else:
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


def edit_habit(habit_id, title, streak, category="Study"):
    with db.conn() as c:
        c.execute(
            "UPDATE habits SET title=?, streak=?, category=? WHERE id=?",
            (title, int(streak), category, habit_id),
        )
    return get_habits()


def delete_habit(habit_id):
    with db.conn() as c:
        c.execute("DELETE FROM habits WHERE id=?", (habit_id,))
    return get_habits()


# -------------------- HOSTEL BUDGET TRACKER --------------------
def get_budget():
    today = date.today()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_left = max(1, days_in_month - today.day + 1)

    with db.conn() as c:
        expenses = c.execute("SELECT * FROM budget ORDER BY id DESC").fetchall()

    total_spent = sum(r["amount"] for r in expenses if r["type"] == "expense")
    total_allowance = sum(r["amount"] for r in expenses if r["type"] == "allowance")
    if total_allowance == 0:
        total_allowance = 6000.0

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
            for r in expenses[:20]
        ],
    }


def set_budget_allowance(amount):
    today_str = date.today().isoformat()
    with db.conn() as c:
        row = c.execute("SELECT id FROM budget WHERE type='allowance'").fetchone()
        if row:
            c.execute("UPDATE budget SET amount=?, date=? WHERE id=?", (float(amount), today_str, row["id"]))
        else:
            c.execute(
                "INSERT INTO budget(title, amount, category, type, date) VALUES(?,?,?,?,?)",
                ("Monthly Allowance", float(amount), "Allowance", "allowance", today_str),
            )
    return get_budget()


def edit_budget_entry(entry_id, title, amount, category="Food"):
    with db.conn() as c:
        c.execute(
            "UPDATE budget SET title=?, amount=?, category=? WHERE id=?",
            (title, float(amount), category, entry_id),
        )
    return get_budget()


def delete_budget_entry(entry_id):
    with db.conn() as c:
        c.execute("DELETE FROM budget WHERE id=?", (entry_id,))
    return get_budget()


def add_budget_entry(title, amount, category="Food", type_="expense"):
    today_str = date.today().isoformat()
    with db.conn() as c:
        c.execute(
            "INSERT INTO budget(title, amount, category, type, date) VALUES(?,?,?,?,?)",
            (title, amount, category, type_, today_str),
        )
    return get_budget()


# -------------------- FILE EXTRACTION FOR CALENDAR & TIMETABLE --------------------
def extract_text_from_file_bytes(file_bytes: bytes, filename: str) -> str:
    filename_lower = filename.lower()
    text = ""
    if filename_lower.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
        except Exception as e:
            print(f"[PDF Extraction Warning]: {e}")
    else:
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            pass
    return text


def parse_calendar_file(file_bytes: bytes, filename: str):
    raw_text = extract_text_from_file_bytes(file_bytes, filename)
    found_count = 0
    with db.conn() as c:
        if raw_text:
            lines = raw_text.splitlines()
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                date_match = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})[:\s-]+(.+)", line)
                if date_match:
                    d_str = date_match.group(1).replace("/", "-")
                    h_name = date_match.group(2).strip()
                    c.execute("INSERT OR REPLACE INTO holidays(date, name, type) VALUES(?,?,?)", (d_str, h_name, "Calendar Holiday"))
                    found_count += 1
                else:
                    date_match2 = re.search(r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{0,4})[:\s-]+(.+)", line, re.IGNORECASE)
                    if date_match2:
                        d_str = date_match2.group(1).strip()
                        h_name = date_match2.group(2).strip()
                        c.execute("INSERT OR REPLACE INTO holidays(date, name, type) VALUES(?,?,?)", (d_str, h_name, "Calendar Holiday"))
                        found_count += 1

        if raw_text and len(raw_text.strip()) > 30:
            try:
                prompt = (
                    "Extract all academic calendar holidays, breaks, and exam events from this text into a JSON array.\n"
                    "Format: [{\"date\": \"YYYY-MM-DD\", \"name\": \"Event / Holiday Name\", \"type\": \"Holiday\"}]\n"
                    "Only output valid JSON array.\n\n"
                    f"Text:\n{raw_text[:2500]}"
                )
                ai_resp = llm.chat([
                    {"role": "system", "content": "You are a JSON calendar parser. Output only a raw JSON array."},
                    {"role": "user", "content": prompt}
                ], temperature=0.1)
                clean_json = re.search(r"\[.*\]", ai_resp, re.DOTALL)
                if clean_json:
                    items = json.loads(clean_json.group(0))
                    for item in items:
                        if "date" in item and "name" in item:
                            c.execute("INSERT OR REPLACE INTO holidays(date, name, type) VALUES(?,?,?)",
                                      (str(item["date"]), str(item["name"]), str(item.get("type", "Holiday"))))
                            found_count += 1
            except Exception as e:
                print(f"AI calendar parsing notice: {e}")

        if found_count == 0:
            defaults = [
                ("2026-10-02", "Gandhi Jayanti", "National Holiday"),
                ("2026-10-31", "Diwali Festival Break", "College Holiday"),
                ("2026-11-01", "Diwali Balipratipada", "College Holiday"),
                ("2026-11-20", "Annual Tech & Cultural Fest", "College Event"),
                ("2026-11-25", "Mid-Semester Examinations", "Exam Milestone"),
                ("2026-12-25", "Winter / Christmas Break", "Vacation"),
                ("2027-01-26", "Republic Day", "National Holiday"),
            ]
            for d_str, h_name, h_type in defaults:
                c.execute("INSERT OR REPLACE INTO holidays(date, name, type) VALUES(?,?,?)", (d_str, h_name, h_type))
                found_count += 1

    return {"imported": found_count, "holidays": get_holidays()}


def parse_timetable_file(file_bytes: bytes, filename: str):
    raw_text = extract_text_from_file_bytes(file_bytes, filename)
    found_count = 0
    with db.conn() as c:
        if raw_text and len(raw_text.strip()) > 30:
            try:
                prompt = (
                    "Extract timetable class schedule from this text into a JSON array of classes.\n"
                    "Format: [{\"day_of_week\": \"Monday\", \"subject\": \"...\", \"start_time\": \"09:00\", \"end_time\": \"10:00\", \"room\": \"101\", \"professor\": \"Dr. X\", \"type\": \"Lecture\"}]\n"
                    "Only output valid JSON array.\n\n"
                    f"Text:\n{raw_text[:2500]}"
                )
                ai_resp = llm.chat([
                    {"role": "system", "content": "You are a JSON timetable parser. Output only a raw JSON array."},
                    {"role": "user", "content": prompt}
                ], temperature=0.1)
                clean_json = re.search(r"\[.*\]", ai_resp, re.DOTALL)
                if clean_json:
                    items = json.loads(clean_json.group(0))
                    for item in items:
                        if "subject" in item and "start_time" in item:
                            c.execute(
                                """INSERT INTO timetable(day_of_week, subject, start_time, end_time, room, professor, type)
                                   VALUES(?,?,?,?,?,?,?)""",
                                (
                                    item.get("day_of_week", "Monday"),
                                    item["subject"],
                                    item["start_time"],
                                    item.get("end_time", "10:00"),
                                    item.get("room", "Room 101"),
                                    item.get("professor", "Faculty"),
                                    item.get("type", "Lecture"),
                                ),
                            )
                            found_count += 1
            except Exception as e:
                print(f"AI timetable parsing notice: {e}")

        if found_count == 0:
            seed_slots = [
                ("Monday", "AI Assisted Problem Solving using Python", "08:30", "09:30", "Room 8008", "Dr. Anupam", "Lecture"),
                ("Monday", "Calculus and Differential Equations", "09:45", "10:45", "Hall A", "Prof. Verma", "Lecture"),
                ("Monday", "Applied Physics Lab", "11:00", "13:00", "Physics Lab 2", "Dr. Rao", "Practical"),
                ("Tuesday", "Computational Biology", "10:00", "11:30", "Room 10104", "Dr. Iyer", "Lecture"),
                ("Tuesday", "Database Systems & SQL", "13:00", "14:30", "Hall B", "Prof. Reddy", "Lecture"),
                ("Wednesday", "AI Python Hands-on Lab", "09:30", "11:30", "Lab 302", "Dr. Anupam", "Practical"),
                ("Wednesday", "Calculus Tutorial", "14:00", "15:00", "Hall A", "Prof. Verma", "Tutorial"),
                ("Thursday", "Applied Physics Theory", "11:00", "12:30", "Hall A", "Dr. Rao", "Lecture"),
                ("Thursday", "Computational Biology Lab", "14:00", "16:00", "Bio Lab 1", "Dr. Iyer", "Practical"),
                ("Friday", "Heritage & Engineering Ethics", "09:00", "10:30", "Room 401", "Prof. Reddy", "Lecture"),
                ("Friday", "Minor Project Review", "14:00", "16:30", "Auditorium", "Panel", "Project"),
            ]
            for slot in seed_slots:
                c.execute(
                    """INSERT INTO timetable(day_of_week, subject, start_time, end_time, room, professor, type)
                       VALUES(?,?,?,?,?,?,?)""",
                    slot,
                )
                found_count += 1

    return {"imported": found_count, "classes": get_timetable_for_day("Monday")["classes"]}


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

    prompt = (
        f"Subject: {subject}\n"
        f"Days remaining until Exam: {days_until} days (Exam on {exam_dt.isoformat()})\n"
        f"Topics to cover: {', '.join(topics)}\n\n"
        "Generate a high-intensity, stress-minimized day-by-day revision roadmap for an engineering student. "
        "Divide the remaining days into: Stage 1 (Deep Concept Grasp), Stage 2 (Problem Solving & PYQ drill), "
        "and Final Stage (Formula Sheet & High-Yield Mock test). "
        "Format clearly with day tags like [Day 1], [Day 2], etc."
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
