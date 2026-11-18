"""Tasks, deadline extraction, priority plan, burnout score, exam mode, flashcards."""
import math
import re
from datetime import date, timedelta

import db
import llm
import rag

TYPE_W = {"exam": 15, "lab": 10, "assignment": 8, "project": 5, "other": 0}


def extract_task(text):
    if not (text or "").strip():
        raise ValueError("Paste a message first.")
    prompt = (f"Today is {date.today().isoformat()}. Extract ONE academic task from the message. "
              'Reply with ONLY JSON like {"title": "...", "due_date": "YYYY-MM-DD", '
              '"type": "exam|lab|assignment|project|other"}. '
              "Turn words like tomorrow or Friday into a real date.\n\nMessage: " + text)
    data = llm.chat_json([{"role": "user", "content": prompt}], temperature=0)
    if isinstance(data, list) and data:
        data = data[0]
    due = str(data.get("due_date", ""))[:10]
    date.fromisoformat(due)
    typ = data.get("type") if data.get("type") in TYPE_W else "other"
    return {"title": str(data.get("title", "Task"))[:120], "due_date": due, "type": typ}


def add_task(title, due_date, typ="other"):
    title = (title or "").strip()
    if not title:
        raise ValueError("Add a title for the task.")
    date.fromisoformat(due_date or "")
    return db.run("INSERT INTO tasks(title,due_date,type) VALUES(?,?,?)",
                  (title[:120], due_date, typ if typ in TYPE_W else "other"))


def done_task(task_id):
    db.run("UPDATE tasks SET done=1, done_on=? WHERE id=?", (db.today(), task_id))


def delete_task(task_id):
    db.run("DELETE FROM tasks WHERE id=?", (task_id,))


def open_tasks():
    return db.q("SELECT * FROM tasks WHERE done=0 ORDER BY due_date")


def _score(task, today):
    days = (date.fromisoformat(task["due_date"]) - today).days
    if days < 0:
        u, why = 100, f"Overdue by {-days} day(s)"
    elif days == 0:
        u, why = 95, "Due today"
    elif days == 1:
        u, why = 85, "Due tomorrow"
    elif days <= 3:
        u, why = 65, f"Due in {days} days"
    elif days <= 7:
        u, why = 40, f"Due in {days} days"
    else:
        u, why = 10, f"Due in {days} days"
    return u + TYPE_W.get(task["type"], 0), days, why


def todays_checkin():
    return db.one("SELECT * FROM checkins WHERE day=? ORDER BY id DESC LIMIT 1", (db.today(),))


def plan():
    today = date.today()
    items = []
    for t in open_tasks():
        pr, days, why = _score(t, today)
        items.append({"id": t["id"], "title": t["title"], "type": t["type"], "due_date": t["due_date"],
                      "days_left": days, "priority": pr, "reason": why})
    items.sort(key=lambda x: -x["priority"])
    ci = todays_checkin()
    if ci is None:
        tip = "Do today's check-in so ScholarIQ can adapt your plan to how you feel."
    elif ci["score"] >= 65:
        tip = "Burnout risk is high. Focus on your top 2 tasks only and protect your sleep tonight."
        items = items[:2] + [dict(i, deferred=True) for i in items[2:]]
    elif ci["score"] >= 35:
        tip = "Moderate load. Work in 25-minute focus blocks with short breaks."
    else:
        tip = "Energy looks good. Start with your highest-priority task."
    return {"items": items, "tip": tip, "burnout": ci["score"] if ci else None}


def workload_points():
    limit = (date.today() + timedelta(days=3)).isoformat()
    n = db.one("SELECT COUNT(*) AS c FROM tasks WHERE done=0 AND due_date<=?", (limit,))["c"]
    return min(26, n * 8), n


def burnout(sleep_h, mood, water):
    sleep_h, mood, water = float(sleep_h), int(mood), int(water)
    sleep_pts = min(40, max(0.0, 8 - sleep_h) * 10)
    mood_pts = (5 - max(1, min(5, mood))) * 6
    water_pts = max(0, 8 - water) * 1.25
    work_pts, due = workload_points()
    score = round(min(100, sleep_pts + mood_pts + water_pts + work_pts))
    if score >= 65:
        level, advice = "High", ("Burnout risk is high. Finish only your top 2 tasks today, "
                                 "take a 20-minute walk and sleep before 11 PM.")
    elif score >= 35:
        level, advice = "Moderate", "Manageable load. Study in 25-minute blocks with 5-minute breaks and drink water."
    else:
        level, advice = "Low", "You are in good shape. Start with your hardest task while your energy is high."
    return {"score": score, "level": level, "advice": advice,
            "breakdown": {"sleep": round(sleep_pts), "mood": round(mood_pts), "water": round(water_pts),
                          "workload": work_pts, "tasks_due_in_3_days": due}}


def save_checkin(sleep_h, mood, water):
    res = burnout(sleep_h, mood, water)
    db.run("INSERT INTO checkins(day,sleep_h,mood,water,score) VALUES(?,?,?,?,?)",
           (db.today(), float(sleep_h), int(mood), int(water), res["score"]))
    return res


def checkin_history():
    return db.q("SELECT day, sleep_h, mood, water, score FROM checkins ORDER BY id DESC LIMIT 14")[::-1]


# ---------- Exam mode ----------
def exam_plan(title, due_date, topics_text=""):
    days = (date.fromisoformat(due_date or "") - date.today()).days
    if days < 0:
        raise ValueError("That exam date has already passed.")
    topics = [t.strip(" -*\t") for t in re.split(r"[\n;]", topics_text or "") if t.strip(" -*\t")]
    source = "the topics you typed"
    if not topics:
        hits = rag.retrieve(f"{title} syllabus units topics", k=6)
        if hits:
            ctx = "\n\n".join(h["text"] for h in hits)
            topics = [str(t) for t in llm.chat_json([{"role": "user", "content":
                      "From this syllabus text list the main exam topics as a JSON array of short "
                      f"strings (maximum 12).\n\n{ctx}"}], temperature=0)][:12]
            source = "your uploaded notes"
    if not topics:
        raise ValueError("Upload your syllabus in Prof. Pilot, or type the topics (one per line).")
    weak = [r["deck"] for r in db.q("SELECT deck, AVG(ease) AS a FROM cards GROUP BY deck HAVING a < 2.3")]
    today = date.today()
    schedule = []
    if days == 0:
        schedule.append({"date": today.isoformat(), "label": "Exam day",
                         "topics": [], "tip": "Light revision only. Eat, hydrate and trust your preparation."})
    else:
        study_days = max(1, days - 1) if days > 1 else 1
        per = math.ceil(len(topics) / study_days)
        for i in range(study_days):
            chunk = topics[i * per:(i + 1) * per]
            if chunk:
                schedule.append({"date": (today + timedelta(days=i)).isoformat(), "label": f"Study day {i + 1}",
                                 "topics": chunk, "tip": "Two 25-minute focus blocks per topic, then 5 flashcards each."})
        if days > 1:
            schedule.append({"date": (today + timedelta(days=days - 1)).isoformat(), "label": "Final revision",
                             "topics": weak or ["Weak areas and key formulas"],
                             "tip": "Mock quiz from Prof. Pilot, quick flashcard pass, sleep before 11 PM."})
        schedule.append({"date": due_date, "label": "Exam day", "topics": [],
                         "tip": "Light revision only. Eat, hydrate and trust your preparation."})
    return {"title": title, "due_date": due_date, "days_left": days, "source": source,
            "topics": topics, "schedule": schedule}


# ---------- Flashcards (spaced repetition) ----------
def _norm_tokens(text):
    return set(rag.toks(text))


def _duplicate(front, seen):
    t = _norm_tokens(front)
    return any(t and len(t & s) / max(1, len(t | s)) > 0.7 for s in seen)


def generate_cards(topic, n=8):
    topic = (topic or "").strip()
    deck = topic[:60] or "Whole library"
    used = {r["chunk_id"] for r in db.q("SELECT chunk_id FROM used_chunks WHERE deck=?", (deck,))}
    existing = [r["front"] for r in db.q("SELECT front FROM cards WHERE deck=?", (deck,))]
    seen = [_norm_tokens(f) for f in existing]
    for attempt in range(2):
        hits, fresh = rag.pick(topic, 4, used)
        if not hits:
            raise ValueError("Upload or scan your notes first." if not used else
                             "Every section of your library already has cards in this deck. Try another topic or add more notes.")
        ctx = "\n\n".join(f"[{h['doc']}, {h['label']}]\n{h['text']}" for h in hits)
        avoid = "\n".join("- " + f for f in existing[-40:]) or "(none)"
        parsed = llm.chat_json([{"role": "user", "content":
                         f"Using only this material, write {int(n)} NEW flashcards about '{topic or 'these notes'}'. Cover different "
                         "facts, definitions, steps and examples. Reply with ONLY a JSON array like "
                         f'[{{"front": "question", "back": "short answer"}}].\nDo NOT repeat or rephrase these existing cards:\n{avoid}\n\nMATERIAL:\n{ctx}'}],
                        temperature=0.8)
        new, skipped = [], 0
        for c in parsed:
            if not (isinstance(c, dict) and c.get("front") and c.get("back")):
                continue
            if _duplicate(str(c["front"]), seen):
                skipped += 1
                continue
            seen.append(_norm_tokens(str(c["front"])))
            new.append(c)
        used |= {h["id"] for h in hits}
        db.many("INSERT OR IGNORE INTO used_chunks(deck, chunk_id) VALUES(?,?)", [(deck, h["id"]) for h in hits])
        if new:
            db.many("INSERT INTO cards(deck,front,back,due) VALUES(?,?,?,?)",
                    [(deck, str(c["front"])[:300], str(c["back"])[:500], db.today()) for c in new])
            return {"created": len(new), "skipped": skipped, "deck": deck}
    raise ValueError("No new cards this time. You may have covered this topic. Try another topic or add more notes.")


def decks():
    return db.q("SELECT deck, COUNT(*) AS total, SUM(CASE WHEN due<=? THEN 1 ELSE 0 END) AS due "
                "FROM cards GROUP BY deck ORDER BY deck", (db.today(),))


def due_cards():
    return db.q("SELECT id, deck, front, back FROM cards WHERE due<=? ORDER BY due, id LIMIT 20", (db.today(),))


def review_card(card_id, grade):
    c = db.one("SELECT * FROM cards WHERE id=?", (card_id,))
    if not c:
        raise ValueError("Card not found.")
    grade = int(grade)  # 0 again, 1 hard, 2 good, 3 easy
    interval, ease, reps = c["interval"], c["ease"], c["reps"]
    if grade < 2:
        interval, reps, ease = 1, 0, max(1.3, ease - 0.2)
    else:
        reps += 1
        interval = 1 if reps == 1 else 3 if reps == 2 else round(max(1, interval) * ease * (1.3 if grade == 3 else 1))
        ease = ease + (0.1 if grade == 3 else 0)
    due = (date.today() + timedelta(days=interval)).isoformat()
    db.run("UPDATE cards SET interval=?, ease=?, reps=?, due=? WHERE id=?", (interval, ease, reps, due, card_id))
    return {"next_in_days": interval}
