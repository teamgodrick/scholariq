"""ScholarIQ API Backend - Local-First Student Life & Academic OS.
Run: uvicorn main:app --reload --port 8000
"""
import os
import shutil
from datetime import date
from typing import Optional
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import github_sentinel
import llm
import planner
import rag
import toolkit
import wellness

app = FastAPI(
    title="ScholarIQ API",
    description="Privacy-First Academic & Student Life Operating System powered by local LLMs",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init()
UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOADS, exist_ok=True)


def llm_guard(fn, *args):
    try:
        return fn(*args)
    except HTTPException:
        raise
    except Exception as e:
        # If LM Studio is not running or model not loaded
        err_msg = str(e)
        if "Connection" in err_msg or "Failed to establish" in err_msg or "1234" in err_msg:
            raise HTTPException(
                503,
                "LM Studio is offline. Start LM Studio on port 1234 and load Llama 3.2 8B & nomic-embed.",
            )
        raise HTTPException(500, f"AI Engine error: {err_msg}")


# ------------------ Request Models ------------------
class Question(BaseModel):
    question: str


class TextPayload(BaseModel):
    text: str


class TopicPayload(BaseModel):
    topic: str


class NewTask(BaseModel):
    title: str
    due_date: str
    type: str = "assignment"


class CheckInPayload(BaseModel):
    sleep_h: float = 7.0
    mood: int = 3
    water: int = 4
    meals: int = 3
    exercise_m: int = 20
    screentime_h: float = 6.0


class TimetableEntry(BaseModel):
    day_of_week: str
    subject: str
    start_time: str
    end_time: str
    room: str
    professor: str
    type: str = "Lecture"


class AttendancePayload(BaseModel):
    subject: str
    attended: int
    total: int
    target_pct: float = 75.0


class MarkAttendancePayload(BaseModel):
    subject: str
    attended: bool = True


class HabitPayload(BaseModel):
    title: str
    category: str = "Study"


class HabitTogglePayload(BaseModel):
    id: int


class BudgetPayload(BaseModel):
    title: str
    amount: float
    category: str = "Food"
    type: str = "expense"


class ExamPlanPayload(BaseModel):
    subject: str
    exam_date: str
    topics: str


class RepoCheckPayload(BaseModel):
    owner: str = "team-scholars"
    repo: str = "ScholarIQ"
    deadline: Optional[str] = None


# ------------------ System & Health ------------------
@app.get("/health")
def health():
    try:
        models_info = llm.models()
        return {
            "ok": True,
            "models": models_info,
            "privacy": "100% Local - Zero Data Leaves Device",
            "team": "Team ScholarIQ (3 Engineers)",
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "advice": "Please ensure LM Studio local server is started on http://localhost:1234",
        }


# ------------------ Prof. Pilot (RAG Engine) ------------------
@app.post("/ingest")
def ingest(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a syllabus or notes PDF file.")
    path = os.path.join(UPLOADS, os.path.basename(file.filename))
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    chunks = llm_guard(rag.ingest_pdf, path, file.filename)
    return {"doc": file.filename, "chunks": chunks, "status": "Indexed into local Chroma-compatible vector store"}


@app.get("/documents")
def get_documents():
    return rag.list_documents()


@app.delete("/documents/{doc_name}")
def delete_doc(doc_name: str):
    return rag.delete_document(doc_name)


@app.post("/chat")
def chat(q: Question):
    return llm_guard(rag.answer, q.question)


@app.post("/quiz")
def quiz(t: TopicPayload):
    return llm_guard(rag.quiz, t.topic)


@app.post("/summary")
def summary(t: TopicPayload):
    return llm_guard(rag.summary, t.topic)


@app.post("/viva")
def viva(t: TopicPayload):
    return llm_guard(rag.viva_practice, t.topic)


@app.post("/flashcards")
def flashcards(t: TopicPayload):
    return llm_guard(rag.generate_flashcards, t.topic)


# ------------------ Chrono-Regulator (Planner) ------------------
@app.post("/tasks/extract")
def extract_task_from_notice(t: TextPayload):
    return llm_guard(planner.extract_task, t.text)


@app.post("/tasks")
def create_task(t: NewTask):
    try:
        date.fromisoformat(t.due_date)
    except ValueError:
        raise HTTPException(400, "due_date must look like YYYY-MM-DD (e.g. 2026-11-20)")
    task_id = planner.add_task(t.title, t.due_date, t.type)
    return {"id": task_id, "status": "Task scheduled in Chrono-Regulator"}


@app.post("/tasks/{task_id}/done")
def mark_task_done(task_id: int):
    planner.mark_done(task_id)
    return {"ok": True}


@app.delete("/tasks/{task_id}")
def delete_task_entry(task_id: int):
    planner.delete_task(task_id)
    return {"ok": True}


@app.post("/tasks/replan")
def replan():
    return planner.replan_missed_tasks()


@app.get("/plan/today")
def get_today_plan():
    return planner.plan_today()


@app.get("/timetable")
def get_timetable(day: Optional[str] = None):
    day_name = day or date.today().strftime("%A")
    classes, clashes = planner.get_timetable_for_day(day_name)
    return {"day": day_name, "classes": classes, "clashes": clashes}


@app.post("/timetable")
def add_class(t: TimetableEntry):
    return planner.add_timetable_class(
        t.day_of_week, t.subject, t.start_time, t.end_time, t.room, t.professor, t.type
    )


# ------------------ Wellness Core ------------------
@app.post("/checkin")
def log_checkin(c: CheckInPayload):
    result = wellness.burnout(
        sleep_h=c.sleep_h,
        mood=c.mood,
        water=c.water,
        meals=c.meals,
        exercise_m=c.exercise_m,
        screentime_h=c.screentime_h,
    )
    today_str = date.today().isoformat()
    with db.conn() as conn:
        conn.execute(
            """INSERT INTO checkins(day, sleep_h, mood, water, meals, exercise_m, screentime_h, score, level, advice)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (
                today_str,
                c.sleep_h,
                c.mood,
                c.water,
                c.meals,
                c.exercise_m,
                c.screentime_h,
                result["score"],
                result["level"],
                result["advice"],
            ),
        )
    return result


# ------------------ GitHub Repo Sentinel ------------------
@app.post("/sentinel")
def check_repo(p: RepoCheckPayload):
    return github_sentinel.check_repo_activity(p.owner, p.repo, p.deadline)


# ------------------ Academic Toolkit & Coach ------------------
@app.get("/attendance")
def get_attendance():
    return toolkit.get_attendance()


@app.post("/attendance")
def save_attendance(p: AttendancePayload):
    return toolkit.update_attendance(p.subject, p.attended, p.total, p.target_pct)


@app.post("/attendance/mark")
def mark_attendance(p: MarkAttendancePayload):
    return toolkit.mark_class_attendance(p.subject, p.attended)


@app.get("/habits")
def get_habits():
    return toolkit.get_habits()


@app.post("/habits/toggle")
def toggle_habit(p: HabitTogglePayload):
    return toolkit.toggle_habit(p.id)


@app.post("/habits")
def add_habit(p: HabitPayload):
    return toolkit.add_habit(p.title, p.category)


@app.get("/budget")
def get_budget():
    return toolkit.get_budget()


@app.post("/budget")
def add_budget(p: BudgetPayload):
    return toolkit.add_budget_entry(p.title, p.amount, p.category, p.type)


@app.post("/exam/plan")
def exam_plan(p: ExamPlanPayload):
    return llm_guard(toolkit.generate_exam_plan, p.subject, p.exam_date, p.topics)
