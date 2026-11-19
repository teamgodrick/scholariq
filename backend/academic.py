"""Timetable, lecture attendance, academic calendar imports and profile helpers."""
import base64
import os
import sqlite3
from datetime import date, datetime

import db
import llm
import readers

WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
IMAGE_MIMES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
CALENDAR_PROMPT = (
    "Transcribe every visible academic-calendar date, event, holiday and note accurately. "
    "Do not infer missing dates. Return plain text, preserving date and event associations."
)


def _validate_date(value):
    try:
        return date.fromisoformat(str(value)).isoformat()
    except (TypeError, ValueError):
        raise ValueError("Use a valid date in YYYY-MM-DD format.")


def timetable_list():
    rows = db.q("SELECT * FROM timetable ORDER BY day, start_time, subject")
    order = {day: i for i, day in enumerate(WEEKDAYS)}
    return sorted(rows, key=lambda x: (order[x["day"]], x["start_time"], x["subject"].lower()))


def timetable_add(subject, day, start_time, end_time, location=""):
    subject = (subject or "").strip()
    day = (day or "").strip().title()
    if not subject:
        raise ValueError("Type a class or subject name.")
    if day not in WEEKDAYS:
        raise ValueError("Choose a valid weekday.")
    try:
        start = datetime.strptime(str(start_time), "%H:%M")
        end = datetime.strptime(str(end_time), "%H:%M")
    except (TypeError, ValueError):
        raise ValueError("Enter class times in HH:MM format.")
    if start >= end:
        raise ValueError("Class end time must be after its start time.")
    return db.run("INSERT INTO timetable(subject,day,start_time,end_time,location) VALUES(?,?,?,?,?)",
                  (subject[:80], day, start.strftime("%H:%M"), end.strftime("%H:%M"), (location or "").strip()[:80]))


def timetable_delete(class_id):
    db.run("DELETE FROM lecture_attendance WHERE timetable_id=?", (class_id,))
    db.run("DELETE FROM timetable WHERE id=?", (class_id,))


def lectures_for_day(day_value=None):
    target = _validate_date(day_value or db.today())
    weekday = date.fromisoformat(target).strftime("%A")
    rows = db.q(
        "SELECT t.*, a.status FROM timetable t "
        "LEFT JOIN lecture_attendance a ON a.timetable_id=t.id AND a.day=? "
        "WHERE t.day=? ORDER BY t.start_time, t.subject", (target, weekday))
    return {"date": target, "weekday": weekday, "today": target == db.today(), "classes": rows}


def mark_lecture(class_id, day_value, status):
    day_value = _validate_date(day_value)
    if day_value != db.today():
        raise ValueError("Lecture attendance can only be marked for today.")
    if status not in ("present", "absent", "no_class"):
        raise ValueError("Choose present, absent, or no class.")
    if not db.one("SELECT 1 AS x FROM timetable WHERE id=?", (class_id,)):
        raise ValueError("This class is no longer in your timetable.")
    try:
        db.run("INSERT INTO lecture_attendance(timetable_id,day,status) VALUES(?,?,?)",
               (class_id, day_value, status))
    except sqlite3.IntegrityError:
        raise ValueError("This class already has a status for today.")
    if status in ("present", "absent"):
        subject = db.one("SELECT subject FROM timetable WHERE id=?", (class_id,))
        db.run("UPDATE subjects SET remaining_classes=MAX(0, remaining_classes-1) "
               "WHERE lower(name)=lower(?) AND remaining_classes IS NOT NULL", (subject["subject"],))


def calendar_events():
    return db.q("SELECT * FROM academic_events ORDER BY event_date, title")


def import_events(events):
    if not isinstance(events, list):
        raise ValueError("Calendar events must be a list.")
    clean = []
    for event in events[:300]:
        if not isinstance(event, dict):
            raise ValueError("Each calendar event must have a date and title.")
        event_date = _validate_date(event.get("date"))
        title = str(event.get("title") or "").strip()
        if not title:
            raise ValueError("Each calendar event needs a title.")
        clean.append((event_date, title[:120], str(event.get("type") or "Event").strip()[:40],
                      str(event.get("description") or "").strip()[:300]))
    if not clean:
        raise ValueError("No events to import.")
    existing = {(row["event_date"], row["title"]) for row in
                db.q("SELECT event_date, title FROM academic_events")}
    new_events = {(event[0], event[1]) for event in clean} - existing
    db.many("INSERT OR IGNORE INTO academic_events(event_date,title,event_type,description) VALUES(?,?,?,?)", clean)
    return {"imported": len(new_events), "events": calendar_events()}


def calendar_event_delete(event_id):
    db.run("DELETE FROM academic_events WHERE id=?", (event_id,))


def extract_calendar(name, data):
    if not data:
        raise ValueError("Choose an academic calendar PDF or image.")
    if len(data) > 8 * 1024 * 1024:
        raise ValueError("Calendar files must be 8 MB or smaller.")
    ext = os.path.splitext((name or "").lower())[1]
    if ext not in (".pdf",) + tuple(IMAGE_MIMES):
        raise ValueError("Upload an academic calendar PDF, PNG, JPG, or WEBP image.")
    if ext in IMAGE_MIMES:
        if ext == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("This does not look like a valid PNG image.")
        if ext in (".jpg", ".jpeg") and not data.startswith(b"\xff\xd8\xff"):
            raise ValueError("This does not look like a valid JPEG image.")
        if ext == ".webp" and (data[:4] != b"RIFF" or data[8:12] != b"WEBP"):
            raise ValueError("This does not look like a valid WEBP image.")
        text = llm.vision(CALENDAR_PROMPT, data, IMAGE_MIMES[ext])
    else:
        units = readers.read_pdf(data)
        text = "\n\n".join(f"{label}:\n{content}" for label, content in units)
        if not text.strip():
            describe = lambda image, mime: llm.vision(CALENDAR_PROMPT, image, mime)
            units = readers.read_pdf(data, describe=describe)
            text = "\n\n".join(f"{label}:\n{content}" for label, content in units)
        if not text.strip():
            raise ValueError("This PDF has no readable text. Upload a clear page image and configure a vision model.")
    if not text.strip():
        raise ValueError("No calendar text could be read from this file.")
    current_year = date.today().year
    result = llm.chat_json([{"role": "user", "content":
        "Extract academic holidays, events, exams and important dates from this calendar text. "
        "Return ONLY a JSON object with an 'events' array; each item has 'date' (YYYY-MM-DD), "
        "'title', 'type' and optional 'description'. Use the calendar's explicit year, or "
        f"{current_year} only when no year is stated. Exclude items without an unambiguous date. "
        "Do not invent or correct dates.\n\nCalendar text:\n" + text[:40000]}], temperature=0)
    events = result.get("events") if isinstance(result, dict) else None
    if not isinstance(events, list) or not events:
        raise ValueError("No dated events were found. Try a clearer image or a text-based PDF.")
    clean = []
    for event in events[:300]:
        if not isinstance(event, dict):
            continue
        try:
            event_date = _validate_date(event.get("date"))
        except ValueError:
            continue
        title = str(event.get("title") or "").strip()
        if title:
            clean.append({"date": event_date, "title": title[:120],
                          "type": str(event.get("type") or "Event")[:40],
                          "description": str(event.get("description") or "")[:300]})
    if not clean:
        raise ValueError("No usable dated events were found in the calendar.")
    return {"events": clean}


def profile():
    return {"display_name": db.get_setting("display_name", ""), "description": db.get_setting("profile_description", ""),
            "photo": db.get_setting("profile_photo", "")}


def save_profile_photo(data):
    if not data:
        db.set_setting("profile_photo", "")
        return {"photo": ""}
    if len(data) > 1024 * 1024:
        raise ValueError("Profile photos must be 1 MB or smaller.")
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif data.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise ValueError("Choose a valid PNG, JPG, or WEBP image.")
    photo = "data:" + mime + ";base64," + base64.b64encode(data).decode("ascii")
    db.set_setting("profile_photo", photo)
    return {"photo": photo}


def today_greeting():
    hour = datetime.now().hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 17 else "Good evening"
    name = db.get_setting("display_name", "").strip()
    return greeting + (", " + name if name else "")


def today_sessions():
    return lectures_for_day(db.today())["classes"]
