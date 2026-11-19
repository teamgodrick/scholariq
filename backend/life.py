"""Habits, attendance, budget, placement prep, focus, journal, nutrition, wind-down, review."""
import calendar
import math
import os
import re
from datetime import date, datetime, timedelta

import db
import llm
import ocr
import readers

# ---------- Habits ----------
def _streak(days):
    d = date.today()
    if d.isoformat() not in days:
        d -= timedelta(days=1)
    n = 0
    while d.isoformat() in days:
        n += 1
        d -= timedelta(days=1)
    return n


def habits_list():
    out, today = [], date.today()
    for h in db.q("SELECT * FROM habits ORDER BY id"):
        days = {r["day"] for r in db.q("SELECT day FROM habit_logs WHERE habit_id=?", (h["id"],))}
        out.append({"id": h["id"], "name": h["name"], "streak": _streak(days),
                    "done_today": today.isoformat() in days,
                    "last7": [(today - timedelta(days=6 - i)).isoformat() in days for i in range(7)]})
    return out


def habit_add(name):
    name = (name or "").strip()
    if not name:
        raise ValueError("Type a habit name.")
    return db.run("INSERT INTO habits(name) VALUES(?)", (name[:60],))


def habit_toggle(habit_id):
    if db.one("SELECT 1 AS x FROM habit_logs WHERE habit_id=? AND day=?", (habit_id, db.today())):
        db.run("DELETE FROM habit_logs WHERE habit_id=? AND day=?", (habit_id, db.today()))
    else:
        db.run("INSERT INTO habit_logs(habit_id,day) VALUES(?,?)", (habit_id, db.today()))


def habit_delete(habit_id):
    db.run("DELETE FROM habit_logs WHERE habit_id=?", (habit_id,))
    db.run("DELETE FROM habits WHERE id=?", (habit_id,))


# ---------- Attendance (75% rule) ----------
def _subject(s):
    a, t = s["attended"], s["total"]
    pct = round(a / t * 100, 1) if t else 100.0
    can_skip = max(0, math.floor(a / 0.75 - t)) if pct >= 75 else 0
    need = math.ceil((0.75 * t - a) / 0.25) if pct < 75 else 0
    remaining = s.get("remaining_classes")
    semester_skips = None
    projected_pct = None
    extra_classes_needed = None
    if remaining is not None:
        remaining = int(remaining)
        semester_skips = max(0, (4 * a + remaining - 3 * t) // 4)
        projected_total = t + remaining
        projected_attended = a + remaining
        projected_pct = round(projected_attended / projected_total * 100, 1) if projected_total else 100.0
        extra_classes_needed = max(0, 3 * t - remaining - 4 * a)
    return {**s, "pct": pct, "can_skip": can_skip, "need_to_attend": need,
            "remaining_classes": remaining, "semester_can_skip": semester_skips,
            "projected_pct": projected_pct, "extra_classes_needed": extra_classes_needed}


def attendance_list():
    subjects = {}
    for subject in db.q("SELECT * FROM subjects ORDER BY id"):
        key = subject["name"].casefold()
        if key in subjects:
            current = subjects[key]
            current["attended"] += subject["attended"]
            current["total"] += subject["total"]
            if current["remaining_classes"] is None:
                current["remaining_classes"] = subject["remaining_classes"]
            current["id"] = None
        else:
            subjects[key] = subject
    tracked = db.q(
        "SELECT t.subject AS name, "
        "SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS attended, "
        "SUM(CASE WHEN a.status IN ('present','absent') THEN 1 ELSE 0 END) AS total "
        "FROM timetable t JOIN lecture_attendance a ON a.timetable_id=t.id GROUP BY t.subject")
    for row in tracked:
        key = row["name"].casefold()
        if key in subjects:
            subjects[key]["attended"] += row["attended"]
            subjects[key]["total"] += row["total"]
        else:
            subjects[key] = {"id": None, "remaining_classes": None, **row}
    return [_subject(s) for s in sorted(subjects.values(), key=lambda x: x["name"].lower())]


def _count(value, label, maximum=1000000):
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a whole number.")
    if isinstance(value, int):
        number = value
    elif isinstance(value, float) and value.is_integer():
        number = int(value)
    elif isinstance(value, str) and value.strip().isdecimal():
        number = int(value.strip())
    else:
        raise ValueError(f"{label} must be a whole number.")
    if number < 0 or number > maximum:
        raise ValueError(f"{label} must be between 0 and {maximum}.")
    return number


def subject_set_remaining(name, remaining):
    name = (name or "").strip()
    if not name:
        raise ValueError("Subject name is required.")
    remaining = _count(remaining, "Remaining classes", 10000)
    existing = db.one("SELECT id FROM subjects WHERE lower(name)=lower(?)", (name,))
    if existing:
        db.run("UPDATE subjects SET remaining_classes=? WHERE id=?", (remaining, existing["id"]))
    else:
        db.run("INSERT INTO subjects(name,attended,total,remaining_classes) VALUES(?,0,0,?)", (name[:60], remaining))


def import_attendance_snapshot(snapshots):
    if not isinstance(snapshots, list) or not snapshots:
        raise ValueError("No attendance records were selected.")
    if len(snapshots) > 100:
        raise ValueError("A maximum of 100 subjects can be imported at once.")
    clean, names = [], set()
    for row in snapshots:
        if not isinstance(row, dict):
            raise ValueError("Each attendance record must include a subject name.")
        name = str(row.get("name") or "").strip()
        if not name:
            raise ValueError("Every selected record must have a subject name.")
        key = name.casefold()
        if key in names:
            raise ValueError(f"Duplicate subject in the import: {name}.")
        names.add(key)
        attended = _count(row.get("attended"), f"{name}: attended classes")
        total = _count(row.get("total"), f"{name}: total classes")
        if attended > total:
            raise ValueError(f"{name}: attended classes cannot exceed total classes.")
        remaining = row.get("remaining_classes")
        if remaining is not None:
            remaining = _count(remaining, f"{name}: remaining classes", 10000)
        tracked = db.q(
            "SELECT a.status, COUNT(*) AS count FROM timetable t "
            "JOIN lecture_attendance a ON a.timetable_id=t.id "
            "WHERE lower(t.subject)=lower(?) GROUP BY a.status", (name,))
        tracked_attended = sum(x["count"] for x in tracked if x["status"] == "present")
        tracked_total = sum(x["count"] for x in tracked if x["status"] in ("present", "absent"))
        if attended < tracked_attended or total < tracked_total:
            raise ValueError(
                f"{name}: uploaded totals are below lecture attendance already tracked in ScholarIQ. "
                "Check the report before importing.")
        clean.append((name[:60], attended - tracked_attended, total - tracked_total, remaining))
    for name, attended, total, remaining in clean:
        existing = db.q("SELECT id, remaining_classes FROM subjects WHERE lower(name)=lower(?) ORDER BY id", (name,))
        if existing:
            value = remaining if remaining is not None else existing[0]["remaining_classes"]
            db.run("UPDATE subjects SET attended=?, total=?, remaining_classes=? WHERE id=?",
                   (attended, total, value, existing[0]["id"]))
            for duplicate in existing[1:]:
                db.run("UPDATE subjects SET attended=0, total=0, remaining_classes=NULL WHERE id=?",
                       (duplicate["id"],))
        else:
            db.run("INSERT INTO subjects(name,attended,total,remaining_classes) VALUES(?,?,?,?)",
                   (name, attended, total, remaining))
    return attendance_list()


def _attendance_rows(text):
    rows = []
    for line in text.splitlines():
        line = " ".join(line.split()).strip()
        if not line:
            continue
        values = re.findall(r"(?<![A-Za-z])\d[\d,]*(?:\.\d+)?%?", line)
        if not values and len(re.findall(r"\b(subject|course|attended|present|total|classes)\b", line, re.I)) >= 2:
            continue
        name = re.sub(r"(?<![A-Za-z])\d[\d,]*(?:\.\d+)?%?", " ", line)
        name = re.sub(r"[\s|:/\\-]+", " ", name).strip(" .")
        name = name[:60]
        if not name or not re.search(r"[A-Za-z]", name):
            continue
        attended = total = None
        count_values = values
        if len(values) == 3 and values[-1].endswith("%"):
            count_values = values[:2]
        if len(count_values) == 2:
            try:
                attended, total = (_count(value.rstrip("%").replace(",", ""), "Class count")
                                   for value in count_values)
                if attended > total:
                    attended = total = None
            except ValueError:
                attended = total = None
        rows.append({"name": name, "attended": attended, "total": total, "remaining_classes": None})
    return rows


def extract_attendance_snapshot(filename, data):
    if not data:
        raise ValueError("Choose an attendance report PDF or image.")
    if len(data) > 8 * 1024 * 1024:
        raise ValueError("Attendance reports must be 8 MB or smaller.")
    ext = os.path.splitext((filename or "").lower())[1]
    mime = readers.IMG.get(ext)
    if ext not in (".pdf",) + tuple(readers.IMG):
        raise ValueError("Upload an attendance report PDF, PNG, JPG, or WEBP image.")
    if mime:
        signatures = {".png": b"\x89PNG\r\n\x1a\n", ".jpg": b"\xff\xd8\xff",
                      ".jpeg": b"\xff\xd8\xff", ".webp": b"RIFF"}
        if not data.startswith(signatures[ext]) or (ext == ".webp" and data[8:12] != b"WEBP"):
            raise ValueError(f"This does not look like a valid {ext[1:].upper()} image.")
        text = "\n".join(ocr.read_image_lines(data))
    else:
        if not data.startswith(b"%PDF"):
            raise ValueError("This does not look like a valid PDF.")
        units = readers.read_pdf(data, describe=lambda image, image_mime: "\n".join(ocr.read_image_lines(image)))
        text = "\n\n".join(content for _, content in units)
        if not text.strip():
            raise ValueError("No readable attendance data found. Upload a clear screenshot or image of the report.")
        text = re.sub(r"(?m)^Figure on this page:\s*", "", text)
    return {"subjects": _attendance_rows(text), "text": text[:30000], "source": "Offline OCR"}


def subject_add(name, attended=0, total=0):
    name = (name or "").strip()
    if not name:
        raise ValueError("Type a subject name.")
    attended, total = int(attended or 0), int(total or 0)
    if attended < 0 or total < attended:
        raise ValueError("Classes attended cannot be more than total classes.")
    return db.run("INSERT INTO subjects(name,attended,total) VALUES(?,?,?)", (name[:60], attended, total))


def subject_mark(subject_id, present):
    db.run("UPDATE subjects SET total=total+1, attended=attended+? WHERE id=?", (1 if present else 0, subject_id))


def subject_delete(subject_id):
    db.run("DELETE FROM subjects WHERE id=?", (subject_id,))


# ---------- Budget ----------
def budget_summary():
    month = date.today().strftime("%Y-%m")
    rows = db.q("SELECT * FROM expenses WHERE day LIKE ? ORDER BY day DESC, id DESC", (month + "%",))
    spent = round(sum(r["amount"] for r in rows), 2)
    limit = float(db.get_setting("budget", "0") or 0)
    left_days = calendar.monthrange(date.today().year, date.today().month)[1] - date.today().day + 1
    cats = {}
    for r in rows:
        cats[r["category"]] = round(cats.get(r["category"], 0) + r["amount"], 2)
    return {"limit": limit, "spent": spent, "remaining": round(limit - spent, 2),
            "safe_daily": round(max(0, limit - spent) / max(1, left_days), 2),
            "days_left": left_days, "by_category": cats, "recent": rows[:12]}


def expense_add(category, amount, note=""):
    amount = float(amount)
    if amount <= 0:
        raise ValueError("Amount must be more than zero.")
    return db.run("INSERT INTO expenses(day,category,amount,note) VALUES(?,?,?,?)",
                  (db.today(), (category or "Other")[:30], amount, (note or "")[:80]))


# ---------- Placement prep ----------
STARTER = {
    "DSA": ["Arrays and strings", "Linked lists", "Stacks and queues", "Trees", "Graphs", "Sorting and searching", "Dynamic programming basics"],
    "Aptitude": ["Percentages and ratios", "Time and work", "Probability", "Data interpretation", "Logical reasoning"],
    "CS core": ["Operating systems basics", "DBMS and SQL", "Computer networks", "OOP concepts"],
    "Career": ["Resume ready", "GitHub profile polished", "LinkedIn updated", "Two mock interviews"],
}


def prep_list():
    items = db.q("SELECT * FROM prep ORDER BY category, id")
    cats = {}
    for i in items:
        c = cats.setdefault(i["category"], {"category": i["category"], "items": [], "done": 0})
        c["items"].append(i)
        c["done"] += i["done"]
    out = list(cats.values())
    for c in out:
        c["pct"] = round(c["done"] / len(c["items"]) * 100)
    return out


def prep_add(category, title):
    if not (title or "").strip():
        raise ValueError("Type what you want to prepare.")
    return db.run("INSERT INTO prep(category,title) VALUES(?,?)", ((category or "General")[:30], title.strip()[:80]))


def prep_starter():
    if db.one("SELECT 1 AS x FROM prep LIMIT 1"):
        raise ValueError("You already have a checklist.")
    db.many("INSERT INTO prep(category,title) VALUES(?,?)", [(c, t) for c, ts in STARTER.items() for t in ts])


def prep_toggle(item_id):
    db.run("UPDATE prep SET done = 1 - done WHERE id=?", (item_id,))


def prep_delete(item_id):
    db.run("DELETE FROM prep WHERE id=?", (item_id,))


# ---------- Focus ----------
def focus_log(minutes, label="Study"):
    minutes = int(minutes)
    if minutes <= 0:
        raise ValueError("Minutes must be more than zero.")
    return db.run("INSERT INTO focus(day,minutes,label) VALUES(?,?,?)", (db.today(), minutes, (label or "Study")[:40]))


def focus_stats():
    today = date.today()
    days = []
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        m = db.one("SELECT COALESCE(SUM(minutes),0) AS m FROM focus WHERE day=?", (d,))["m"]
        days.append({"day": d, "minutes": m})
    return {"today": days[-1]["minutes"], "week": sum(x["minutes"] for x in days), "days": days}


# ---------- Journal ----------
def journal_add(mood, text):
    if not (text or "").strip():
        raise ValueError("Write a few words first.")
    return db.run("INSERT INTO journal(day,mood,text) VALUES(?,?,?)",
                  (db.today(), max(1, min(5, int(mood))), text.strip()[:1000]))


def journal_list():
    return db.q("SELECT * FROM journal ORDER BY id DESC LIMIT 15")


def journal_summary():
    since = (date.today() - timedelta(days=7)).isoformat()
    rows = db.q("SELECT day, mood, text FROM journal WHERE day>=? ORDER BY id", (since,))
    if not rows:
        raise ValueError("Write at least one journal entry this week first.")
    notes = "\n".join(f"{r['day']} (mood {r['mood']}/5): {r['text']}" for r in rows)
    return {"summary": llm.chat([{"role": "user", "content":
            "You are a kind student coach. Read this week's private journal and reply in under 120 words: "
            "the main feeling, one thing going well, one gentle suggestion. No medical advice.\n\n" + notes}])}


# ---------- Nutrition and water ----------
def nutrition():
    today = db.today()
    w = db.one("SELECT glasses FROM water WHERE day=?", (today,))
    glasses = w["glasses"] if w else 0
    hour = datetime.now().hour
    expected = min(8, max(0, round((hour - 7) / 1.5)))
    if glasses >= 8:
        tip = "Hydration goal reached. Great work."
    elif glasses < expected:
        tip = f"You are about {expected - glasses} glass(es) behind for this time of day. Drink one now."
    else:
        tip = "You are on track. Keep a bottle at your desk."
    return {"glasses": glasses, "goal": 8, "tip": tip,
            "meals": db.q("SELECT * FROM meals WHERE day=? ORDER BY id", (today,))}


def water_add(delta):
    cur = nutrition()["glasses"]
    new = max(0, min(20, cur + int(delta)))
    db.run("INSERT INTO water(day,glasses) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET glasses=excluded.glasses",
           (db.today(), new))
    return new


def meal_add(slot, note):
    if not (note or "").strip():
        raise ValueError("Write what you ate.")
    return db.run("INSERT INTO meals(day,slot,note) VALUES(?,?,?)", (db.today(), slot or "Meal", note.strip()[:100]))


def meal_suggest():
    hour = datetime.now().hour
    slot = "breakfast" if hour < 11 else "lunch" if hour < 16 else "evening snack" if hour < 19 else "dinner"
    menu = db.get_setting("mess_menu", "").strip() or "No mess menu was given. Suggest simple, cheap, healthy Indian options."
    eaten = ", ".join(m["note"] for m in db.q("SELECT note FROM meals WHERE day=?", (db.today(),))) or "nothing logged yet"
    return {"slot": slot, "suggestion": llm.chat([{"role": "user", "content":
            f"A student needs a {slot} suggestion. Mess menu: {menu}\nAlready eaten today: {eaten}\n"
            "Reply in under 60 words: what to pick and one reason. Not medical advice."}])}


# ---------- Settings and sleep wind-down ----------
KEYS = {"bedtime", "github_user", "display_name", "profile_description", "mess_menu", "chat_model", "embed_model", "vision_model", "ai_memory"}


def settings_all():
    return {k: db.get_setting(k, "23:00" if k == "bedtime" else "small" if k == "ai_memory" else "") for k in KEYS}


def settings_save(data):
    for k, v in (data or {}).items():
        if k in KEYS:
            if k == "bedtime":
                datetime.strptime(str(v), "%H:%M")
            limit = 120 if k == "profile_description" else 500
            db.set_setting(k, str(v).strip()[:limit])


def winddown():
    bed = datetime.strptime(db.get_setting("bedtime", "23:00") or "23:00", "%H:%M").time()
    now = datetime.now()
    bed_dt = now.replace(hour=bed.hour, minute=bed.minute, second=0, microsecond=0)
    if now.hour < 5 and bed.hour >= 12:
        bed_dt -= timedelta(days=1)
    diff = (bed_dt - now).total_seconds() / 60
    if -300 <= diff < 0:
        return {"state": "late", "message": "It is past your bedtime. Anything due after tomorrow can wait. Sleep protects tomorrow's marks."}
    if 0 <= diff <= 60:
        return {"state": "soon", "message": f"Bedtime in {int(diff)} minutes. Wrap up, screens off in 30, and pick tomorrow's top 3 tasks."}
    return {"state": "ok", "message": ""}


# ---------- Weekly review ----------
def weekly_review():
    since = (date.today() - timedelta(days=6)).isoformat()
    ck = db.q("SELECT * FROM checkins WHERE day>=?", (since,))
    avg = lambda key: round(sum(r[key] for r in ck) / len(ck), 1) if ck else None
    habits = db.one("SELECT COUNT(*) AS c FROM habits")["c"]
    logs = db.one("SELECT COUNT(*) AS c FROM habit_logs WHERE day>=?", (since,))["c"]
    stats = {
        "checkins": len(ck), "avg_sleep_h": avg("sleep_h"), "avg_mood": avg("mood"), "avg_burnout": avg("score"),
        "tasks_done": db.one("SELECT COUNT(*) AS c FROM tasks WHERE done=1 AND done_on>=?", (since,))["c"],
        "tasks_open": db.one("SELECT COUNT(*) AS c FROM tasks WHERE done=0")["c"],
        "focus_minutes": focus_stats()["week"],
        "habit_completion_pct": round(logs / (habits * 7) * 100) if habits else None,
        "spent_this_week": round(db.one("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE day>=?", (since,))["s"], 2),
        "low_attendance": [s["name"] for s in attendance_list() if s["pct"] < 75],
    }
    try:
        text = llm.chat([{"role": "user", "content":
                          "You are a supportive student coach. From these weekly stats write a short review: "
                          "one strength, one risk, and exactly three actions for next week. Under 160 words. "
                          "No medical advice.\n\n" + str(stats)}])
        err = None
    except llm.LLMError as e:
        text, err = None, str(e)
    return {"stats": stats, "review": text, "error": err}
