"""GitHub Sentinel, resume helper, study group board, mentor view, demo data."""
import json
import random
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

import db
import life
import llm

_cache = {}


def _gh(path):
    req = urllib.request.Request("https://api.github.com" + path,
                                 headers={"User-Agent": "ScholarIQ", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise ValueError("GitHub user not found. Check the username in Settings.")
        if e.code in (403, 429):
            raise ValueError("GitHub is rate-limiting this network. Try again in a few minutes.")
        raise ValueError(f"GitHub error {e.code}.")
    except Exception:
        raise ValueError("Cannot reach GitHub. Check your internet connection.")


def _user():
    u = db.get_setting("github_user", "").strip()
    if not u:
        raise ValueError("Add your GitHub username in Settings first.")
    return u


def _age_days(iso):
    return (datetime.now(timezone.utc).replace(tzinfo=None) - datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ")).days


def sentinel():
    u = _user()
    repos = _gh(f"/users/{u}/repos?sort=pushed&per_page=10")
    events = _gh(f"/users/{u}/events/public?per_page=100")
    push_days = {e["created_at"][:10] for e in events if e.get("type") == "PushEvent"}
    streak, d = 0, date.today()
    if d.isoformat() not in push_days:
        d -= timedelta(days=1)
    while d.isoformat() in push_days:
        streak += 1
        d -= timedelta(days=1)
    week = {(date.today() - timedelta(days=i)).isoformat() for i in range(7)}
    last_push = min((_age_days(r["pushed_at"]) for r in repos if r.get("pushed_at")), default=None)
    soon = (date.today() + timedelta(days=21)).isoformat()
    nxt = db.one("SELECT title, due_date FROM tasks WHERE done=0 AND type IN ('project','assignment') "
                 "AND due_date<=? ORDER BY due_date LIMIT 1", (soon,))
    warning = None
    if nxt:
        days_left = (date.fromisoformat(nxt["due_date"]) - date.today()).days
        if days_left <= 7 and (last_push is None or last_push >= 2):
            gap = "no pushes yet" if last_push is None else f"no push for {last_push} days"
            warning = f"'{nxt['title']}' is due in {max(days_left, 0)} day(s) but you have {gap}. Commit something today."
    res = {"user": u, "last_push_days": last_push, "streak": streak, "active_days_week": len(push_days & week),
           "next_deadline": nxt, "warning": warning,
           "repos": [{"name": r["name"], "language": r.get("language"), "pushed_days_ago":
                      _age_days(r["pushed_at"]) if r.get("pushed_at") else None} for r in repos[:6]]}
    _cache["sentinel"] = (time.time(), res)
    return res


def sentinel_cached():
    t = _cache.get("sentinel")
    return t[1] if t and time.time() - t[0] < 900 else None


def resume():
    u = _user()
    repos = [r for r in _gh(f"/users/{u}/repos?sort=pushed&per_page=12") if not r.get("fork")][:6]
    if not repos:
        raise ValueError("No public repositories found to write about.")
    lines = "\n".join(f"- {r['name']}: {r.get('description') or 'no description'} "
                      f"({r.get('language') or 'n/a'}, {r.get('stargazers_count', 0)} stars)" for r in repos)
    return {"text": llm.chat([{"role": "user", "content":
            "Write 5 strong resume bullet points (action verb first, no made-up numbers) and a 2-line "
            "portfolio summary for a student based on these GitHub projects:\n" + lines}])}


def add_post(name, text):
    text = (text or "").strip()
    if not text:
        raise ValueError("Write a message first.")
    return db.run("INSERT INTO posts(ts,name,text) VALUES(?,?,?)",
                  (datetime.now().strftime("%d %b %H:%M"), ((name or "").strip() or "Student")[:30], text[:500]))


def posts():
    return db.q("SELECT * FROM posts ORDER BY id DESC LIMIT 60")


def mentor():
    since = (date.today() - timedelta(days=13)).isoformat()
    rows = db.q("SELECT day,sleep_h,mood,score FROM class_checkins WHERE day>=? UNION ALL "
                "SELECT day,sleep_h,mood,score FROM checkins WHERE day>=?", (since, since))
    avg = lambda rs, k: round(sum(r[k] for r in rs) / len(rs), 1) if rs else None
    by_day = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        rs = [r for r in rows if r["day"] == d]
        by_day.append({"day": d, "avg": avg(rs, "score"), "n": len(rs)})
    high = sum(1 for r in rows if r["score"] >= 65)
    return {"n": len(rows), "avg_score": avg(rows, "score"), "avg_sleep": avg(rows, "sleep_h"),
            "avg_mood": avg(rows, "mood"), "high_pct": round(high / len(rows) * 100) if rows else 0,
            "by_day": by_day,
            "overdue": db.one("SELECT COUNT(*) AS c FROM tasks WHERE done=0 AND due_date<?", (db.today(),))["c"],
            "note": "Anonymous and aggregated. No names or personal notes are ever shown to mentors."}


TABLES = ["tasks", "checkins", "class_checkins", "habits", "habit_logs", "lecture_attendance", "timetable",
          "academic_events", "subjects", "expenses", "prep", "focus", "journal", "cards", "meals", "water",
          "posts", "settings"]


def reset(keep_docs=True):
    for t in TABLES + ([] if keep_docs else ["chunks"]):
        db.run(f"DELETE FROM {t}")


def demo_seed():
    reset()
    rnd, today = random.Random(7), date.today()
    d = lambda n: (today + timedelta(days=n)).isoformat()
    db.many("INSERT INTO tasks(title,due_date,type) VALUES(?,?,?)", [
        ("DBMS internal exam", d(2), "exam"), ("OS lab record submission", d(0), "lab"),
        ("ML project milestone 2", d(5), "project"), ("Maths assignment 4", d(1), "assignment"),
        ("Computer Networks quiz", d(6), "exam"), ("Python lab viva", d(3), "lab"),
        ("Placement aptitude test", d(9), "other"), ("Return library books", d(-1), "other")])
    for n in ["Morning walk", "Revise notes 30 min", "Read 10 pages", "Sleep before 11 PM"]:
        hid = db.run("INSERT INTO habits(name) VALUES(?)", (n,))
        for i in range(1, 7):
            if rnd.random() < 0.7:
                db.run("INSERT OR IGNORE INTO habit_logs(habit_id,day) VALUES(?,?)", (hid, d(-i)))
    db.many("INSERT INTO subjects(name,attended,total) VALUES(?,?,?)",
            [("DBMS", 18, 22), ("Operating Systems", 14, 20), ("Computer Networks", 20, 23),
             ("Machine Learning", 12, 18), ("Mathematics", 21, 24)])
    db.set_setting("budget", "6000")
    db.many("INSERT INTO expenses(day,category,amount,note) VALUES(?,?,?,?)",
            [(d(-i), c, a, n) for i, (c, a, n) in enumerate([
                ("Food", 120, "Canteen lunch"), ("Transport", 60, "Bus pass top-up"), ("Study", 250, "Printouts"),
                ("Food", 90, "Dinner"), ("Fun", 300, "Movie"), ("Food", 150, "Weekend meal"),
                ("Recharge", 299, "Phone plan")]) if (today - timedelta(days=i)).month == today.month])
    life.prep_starter()
    for t in ["Arrays and strings", "Linked lists", "Resume ready"]:
        db.run("UPDATE prep SET done=1 WHERE title=?", (t,))
    db.many("INSERT INTO focus(day,minutes,label) VALUES(?,?,?)",
            [(d(-i), rnd.choice([25, 50, 75, 100]), "Study") for i in range(1, 7)])
    db.many("INSERT INTO journal(day,mood,text) VALUES(?,?,?)", [
        (d(-3), 3, "Heavy week, exams approaching, but the study plan helps."),
        (d(-2), 2, "Slept late again. Felt tired in the lab."),
        (d(-1), 4, "Good revision session and a walk in the evening.")])
    db.many("INSERT INTO cards(deck,front,back,due) VALUES(?,?,?,?)", [
        ("DBMS basics", q, a, today.isoformat()) for q, a in [
            ("What is normalization?", "Organising tables to reduce redundancy and anomalies."),
            ("What is a primary key?", "A column set that uniquely identifies each row."),
            ("What does ACID stand for?", "Atomicity, Consistency, Isolation, Durability."),
            ("What is a foreign key?", "A column referencing the primary key of another table."),
            ("Define a transaction.", "A unit of work that is committed or rolled back as a whole."),
            ("What is an index?", "A structure that speeds up lookups on a column.")]])
    db.many("INSERT INTO checkins(day,sleep_h,mood,water,score) VALUES(?,?,?,?,?)",
            [(d(-i), s, m, w, sc) for i, (s, m, w, sc) in zip(range(6, 0, -1), [
                (7.5, 4, 6, 18), (6.5, 3, 5, 36), (5.5, 3, 4, 50), (6, 2, 4, 58), (5, 2, 3, 72), (7, 4, 6, 30)])])
    db.many("INSERT INTO class_checkins(day,sleep_h,mood,water,score) VALUES(?,?,?,?,?)",
            [(d(-rnd.randint(0, 6)), round(rnd.uniform(4.5, 8.5), 1), rnd.randint(1, 5), rnd.randint(2, 8),
              rnd.randint(15, 85)) for _ in range(45)])
    db.many("INSERT INTO posts(ts,name,text) VALUES(?,?,?)", [
        ("Today 09:10", "Asha", "DBMS unit 3 notes uploaded in the shared drive."),
        ("Today 09:42", "Ravi", "Study group at the library 6 PM for the OS lab?"),
        ("Today 10:05", "Meera", "I can explain joins if anyone wants a quick session.")])
    db.set_setting("bedtime", "23:00")
    db.set_setting("display_name", "Demo")
    db.set_setting("mess_menu", "Breakfast: idli, sambar. Lunch: rice, dal, mixed veg, curd. Dinner: chapati, paneer curry.")
