"""All /api routes. Each route is a small function that returns JSON-friendly data."""
import re
from datetime import date, datetime

import core
import academic
import db
import life
import llm
import rag
import social

ROUTES = []
PUBLIC = {("GET", "/api/info"), ("GET", "/api/group"), ("POST", "/api/group")}  # allowed for Wi-Fi guests


def route(method, pattern):
    def deco(fn):
        ROUTES.append((method, re.compile("^" + pattern + "$"), fn))
        return fn
    return deco


def dispatch(method, path, body, query, raw, is_local, ctx):
    for m, rx, fn in ROUTES:
        match = rx.match(path)
        if m == method and match:
            if not is_local and (method, path) not in PUBLIC:
                raise PermissionError("Only the laptop running ScholarIQ can use this part.")
            return fn(Req(body, query, raw, [int(g) if g.isdigit() else g for g in match.groups()], ctx))
    raise LookupError("Not found")


class Req:
    def __init__(self, body, query, raw, args, ctx):
        self.body, self.query, self.raw, self.args, self.ctx = body or {}, query, raw, args, ctx


# ---------- info ----------
@route("GET", "/api/info")
def info(r):
    return {"local": r.ctx["is_local"], "sharing": r.ctx["sharing"], "lan_ip": r.ctx["lan_ip"],
            "port": r.ctx["port"], "version": "1.0"}


@route("GET", "/api/health")
def health(r):
    return llm.status()


# ---------- Today ----------
def alerts():
    out, today = [], db.today()
    tasks = core.open_tasks()
    over = [t for t in tasks if t["due_date"] < today]
    due_today = [t for t in tasks if t["due_date"] == today]
    if over:
        out.append({"level": "high", "page": "today", "text": f"{len(over)} overdue task(s). Start with: {over[0]['title']}"})
    if due_today:
        out.append({"level": "warn", "page": "today", "text": f"Due today: {', '.join(t['title'] for t in due_today[:3])}"})
    ci = core.todays_checkin()
    if ci and ci["score"] >= 65:
        out.append({"level": "high", "page": "checkin", "text": f"Burnout score {ci['score']}. Protect your sleep and do only your top 2 tasks."})
    elif ci is None:
        out.append({"level": "info", "page": "checkin", "text": "You have not done today's check-in yet."})
    for s in life.attendance_list():
        if s["total"] and s["pct"] < 75:
            out.append({"level": "high", "page": "attendance", "text": f"{s['name']} attendance is {s['pct']}%. Attend the next {s['need_to_attend']} classes to reach 75%."})
    for h in life.habits_list():
        if h["streak"] >= 3 and not h["done_today"]:
            out.append({"level": "warn", "page": "habits", "text": f"Keep your {h['streak']}-day streak alive: {h['name']}"})
    b = life.budget_summary()
    if b["limit"] and b["spent"] > 0.9 * b["limit"]:
        out.append({"level": "warn", "page": "budget", "text": f"You have spent {b['spent']:.0f} of your {b['limit']:.0f} budget this month."})
    n = life.nutrition()
    if n["glasses"] < 3 and datetime.now().hour >= 14:
        out.append({"level": "info", "page": "nutrition", "text": "Only a few glasses of water so far today."})
    s = social.sentinel_cached()
    if s and s.get("warning"):
        out.append({"level": "high", "page": "github", "text": s["warning"]})
    order = {"high": 0, "warn": 1, "info": 2}
    return sorted(out, key=lambda a: order[a["level"]])


@route("GET", "/api/today")
def today(r):
    avg = db.one("SELECT AVG(sleep_h) AS a FROM checkins WHERE day>=date('now','-6 day','localtime')")["a"]
    habits = life.habits_list()
    return {"date": date.today().strftime("%A, %d %B"), "today_iso": db.today(), "greeting": academic.today_greeting(),
            "sessions": academic.today_sessions(), "events": [e for e in academic.calendar_events() if e["event_date"] == db.today()],
            "plan": core.plan(), "alerts": alerts(),
            "winddown": life.winddown(),
            "stats": {"open_tasks": len(core.open_tasks()), "focus_today": life.focus_stats()["today"],
                      "habits_done": sum(1 for h in habits if h["done_today"]), "habits_total": len(habits),
                      "cards_due": sum(c["due"] or 0 for c in core.decks()),
                      "water": life.nutrition()["glasses"], "avg_sleep": round(avg, 1) if avg else None}}


# ---------- Tasks ----------
@route("GET", "/api/tasks")
def tasks_list(r):
    return core.open_tasks()


@route("POST", "/api/tasks")
def tasks_add(r):
    return {"id": core.add_task(r.body.get("title"), r.body.get("due_date"), r.body.get("type", "other"))}


@route("POST", "/api/tasks/extract")
def tasks_extract(r):
    return core.extract_task(r.body.get("text"))


@route("POST", r"/api/tasks/(\d+)/done")
def tasks_done(r):
    core.done_task(r.args[0])
    return {"ok": True}


@route("POST", r"/api/tasks/(\d+)/delete")
def tasks_delete(r):
    core.delete_task(r.args[0])
    return {"ok": True}


def _docs(body):
    """Which documents to use: a list of names, one old-style name, or None for all of them."""
    docs = body.get("docs")
    if body.get("doc"):
        docs = [body["doc"]]
    if docs is None:
        return None
    if not isinstance(docs, list) or not docs:
        raise ValueError("Choose at least one document, or tick All documents.")
    return [str(d) for d in docs]


# ---------- Prof. Pilot and the knowledge library ----------
@route("POST", "/api/ingest")
def ingest(r):
    name = (r.query.get("name") or "notes.pdf").replace("\\", "/").split("/")[-1][:80]
    if not r.raw:
        raise ValueError("Please choose a file.")
    return rag.ingest_file(name, r.raw, vision=r.query.get("vision") == "1")


@route("GET", "/api/docs")
def docs(r):
    return rag.docs()


@route("POST", "/api/docs/delete")
def docs_delete(r):
    rag.delete_doc(r.body.get("doc", ""))
    return {"ok": True}


@route("POST", "/api/library/scan")
def library_scan(r):
    return rag.scan_library()


@route("POST", "/api/ai/selftest")
def selftest(r):
    return rag.selftest(r.body.get("n", 6))


@route("GET", "/api/models")
def models(r):
    return llm.status()


@route("POST", "/api/chat")
def chat(r):
    if not (r.body.get("question") or "").strip():
        raise ValueError("Type a question.")
    mode = "notes" if r.body.get("mode") == "notes" else "hybrid"
    return rag.answer(r.body["question"], r.body.get("history"), mode, _docs(r.body), bool(r.body.get("careful")))


@route("POST", "/api/quiz")
def quiz(r):
    return rag.quiz(r.body.get("topic") or "", int(r.body.get("n", 5)), _docs(r.body))


# ---------- Exam mode and flashcards ----------
@route("POST", "/api/exam/plan")
def exam(r):
    return core.exam_plan(r.body.get("title") or "Exam", r.body.get("due_date"), r.body.get("topics", ""))


@route("GET", "/api/flashcards/decks")
def decks(r):
    return core.decks()


@route("GET", "/api/flashcards/due")
def due(r):
    return core.due_cards()


@route("POST", "/api/flashcards/generate")
def gen_cards(r):
    return core.generate_cards(r.body.get("topic"), r.body.get("n", 8))


@route("POST", r"/api/flashcards/(\d+)/review")
def review_card(r):
    return core.review_card(r.args[0], r.body.get("grade", 2))


# ---------- Wellness ----------
@route("POST", "/api/checkin")
def checkin(r):
    return core.save_checkin(r.body.get("sleep_h", 7), r.body.get("mood", 3), r.body.get("water", 4))


@route("GET", "/api/checkin/history")
def checkin_hist(r):
    return core.checkin_history()


@route("GET", "/api/journal")
def journal(r):
    return life.journal_list()


@route("POST", "/api/journal")
def journal_add(r):
    return {"id": life.journal_add(r.body.get("mood", 3), r.body.get("text"))}


@route("POST", "/api/journal/summary")
def journal_sum(r):
    return life.journal_summary()


@route("GET", "/api/nutrition")
def nutrition(r):
    return life.nutrition()


@route("POST", "/api/water")
def water(r):
    return {"glasses": life.water_add(r.body.get("delta", 1))}


@route("POST", "/api/meals")
def meals(r):
    return {"id": life.meal_add(r.body.get("slot"), r.body.get("note"))}


@route("POST", "/api/meals/suggest")
def meal_suggest(r):
    return life.meal_suggest()


# ---------- Habits ----------
@route("GET", "/api/habits")
def habits(r):
    return life.habits_list()


@route("POST", "/api/habits")
def habit_add(r):
    return {"id": life.habit_add(r.body.get("name"))}


@route("POST", r"/api/habits/(\d+)/toggle")
def habit_toggle(r):
    life.habit_toggle(r.args[0])
    return {"ok": True}


@route("POST", r"/api/habits/(\d+)/delete")
def habit_delete(r):
    life.habit_delete(r.args[0])
    return {"ok": True}


# ---------- Attendance, budget, placement ----------
@route("GET", "/api/attendance")
def attendance(r):
    return life.attendance_list()


@route("POST", "/api/attendance")
def attendance_add(r):
    return {"id": life.subject_add(r.body.get("name"), r.body.get("attended"), r.body.get("total"))}


@route("POST", "/api/attendance/remaining")
def attendance_remaining(r):
    life.subject_set_remaining(r.body.get("name"), r.body.get("remaining_classes"))
    return {"subjects": life.attendance_list()}


@route("POST", "/api/attendance/extract")
def attendance_extract(r):
    return life.extract_attendance_snapshot(r.query.get("name", "attendance.pdf"), r.raw)


@route("POST", "/api/attendance/snapshot")
def attendance_snapshot(r):
    return {"subjects": life.import_attendance_snapshot(r.body.get("subjects"))}


@route("POST", r"/api/attendance/(\d+)/mark")
def attendance_mark(r):
    life.subject_mark(r.args[0], bool(r.body.get("present")))
    return {"ok": True}


@route("POST", r"/api/attendance/(\d+)/delete")
def attendance_delete(r):
    life.subject_delete(r.args[0])
    return {"ok": True}


# ---------- Academic calendar and timetable ----------
@route("GET", "/api/timetable")
def timetable(r):
    return academic.timetable_list()


@route("POST", "/api/timetable")
def timetable_add(r):
    return {"id": academic.timetable_add(r.body.get("subject"), r.body.get("day"), r.body.get("start_time"),
                                         r.body.get("end_time"), r.body.get("location"))}


@route("POST", r"/api/timetable/(\d+)/delete")
def timetable_delete(r):
    academic.timetable_delete(r.args[0])
    return {"ok": True}


@route("GET", "/api/lectures")
def lectures(r):
    return academic.lectures_for_day(r.query.get("date"))


@route("POST", r"/api/lectures/(\d+)/mark")
def lecture_mark(r):
    academic.mark_lecture(r.args[0], r.body.get("date"), r.body.get("status"))
    return {"ok": True}


@route("GET", "/api/calendar/events")
def calendar_events(r):
    return academic.calendar_events()


@route("POST", "/api/calendar/import")
def calendar_import(r):
    return academic.extract_calendar(r.query.get("name", "calendar.pdf"), r.raw)


@route("POST", "/api/calendar/events/import")
def calendar_events_import(r):
    return academic.import_events(r.body.get("events"))


@route("POST", r"/api/calendar/events/(\d+)/delete")
def calendar_event_delete(r):
    academic.calendar_event_delete(r.args[0])
    return {"ok": True}


@route("GET", "/api/profile")
def profile(r):
    return academic.profile()


@route("POST", "/api/profile/photo")
def profile_photo(r):
    return academic.save_profile_photo(r.raw)


@route("POST", "/api/profile/photo/remove")
def profile_photo_remove(r):
    return academic.save_profile_photo(b"")


@route("GET", "/api/budget")
def budget(r):
    return life.budget_summary()


@route("POST", "/api/budget/limit")
def budget_limit(r):
    amount = float(r.body.get("amount", 0))
    if amount < 0:
        raise ValueError("Budget cannot be negative.")
    db.set_setting("budget", amount)
    return {"ok": True}


@route("POST", "/api/budget/expense")
def expense(r):
    return {"id": life.expense_add(r.body.get("category"), r.body.get("amount"), r.body.get("note"))}


@route("POST", r"/api/expenses/(\d+)/delete")
def expense_delete(r):
    db.run("DELETE FROM expenses WHERE id=?", (r.args[0],))
    return {"ok": True}


@route("GET", "/api/prep")
def prep(r):
    return life.prep_list()


@route("POST", "/api/prep")
def prep_add(r):
    return {"id": life.prep_add(r.body.get("category"), r.body.get("title"))}


@route("POST", "/api/prep/starter")
def prep_starter(r):
    life.prep_starter()
    return {"ok": True}


@route("POST", r"/api/prep/(\d+)/toggle")
def prep_toggle(r):
    life.prep_toggle(r.args[0])
    return {"ok": True}


@route("POST", r"/api/prep/(\d+)/delete")
def prep_delete(r):
    life.prep_delete(r.args[0])
    return {"ok": True}


# ---------- Focus ----------
@route("GET", "/api/focus")
def focus(r):
    return life.focus_stats()


@route("POST", "/api/focus")
def focus_log(r):
    return {"id": life.focus_log(r.body.get("minutes"), r.body.get("label", "Study"))}


# ---------- Settings, code, team, review, demo ----------
@route("GET", "/api/settings")
def settings(r):
    return life.settings_all()


@route("POST", "/api/settings")
def settings_save(r):
    life.settings_save(r.body)
    return life.settings_all()


@route("GET", "/api/github/sentinel")
def sentinel(r):
    return social.sentinel()


@route("POST", "/api/github/resume")
def resume(r):
    return social.resume()


@route("GET", "/api/group")
def group(r):
    return social.posts()


@route("POST", "/api/group")
def group_post(r):
    return {"id": social.add_post(r.body.get("name"), r.body.get("text"))}


@route("GET", "/api/mentor")
def mentor(r):
    return social.mentor()


@route("POST", "/api/review")
def review(r):
    return life.weekly_review()


@route("POST", "/api/demo/seed")
def demo_seed(r):
    social.demo_seed()
    return {"ok": True}


@route("POST", "/api/demo/reset")
def demo_reset(r):
    social.reset()
    return {"ok": True}