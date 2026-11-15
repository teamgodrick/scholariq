"""ScholarIQ API Backend - Local-First Student Life & Academic OS.
Run: uvicorn main:app --reload --port 8000
"""
import os
import shutil
from datetime import date
from typing import List, Optional
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
    description="Universal Student Life & Academic Operating System",
    version="2.1.0",
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
        raise HTTPException(500, f"AI Engine error: {str(e)}")


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
    water: int = 6
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


class SubjectPayload(BaseModel):
    subject: str
    short_code: str = ""
    color: str = "#8A4FE0"
    attended: int = 0
    total: int = 0
    total_semester: int = 60
    target_pct: float = 75.0


class SubjectEditPayload(BaseModel):
    id: int
    subject: str
    short_code: str = ""
    color: str = "#8A4FE0"
    attended: int = 0
    total: int = 0
    total_semester: int = 60
    target_pct: float = 75.0


class MarkAttendancePayload(BaseModel):
    subject_id: int
    mark: str = "P"  # 'P' (Present), 'A' (Absent), 'C' (No Class / Cancelled)
    note: str = ""


class HolidayPayload(BaseModel):
    date: str
    name: str
    type: str = "Holiday"


class HabitPayload(BaseModel):
    title: str
    category: str = "Study"


class HabitEditPayload(BaseModel):
    title: str
    streak: int
    category: str = "Study"


class HabitTogglePayload(BaseModel):
    id: int


class BudgetPayload(BaseModel):
    title: str
    amount: float
    category: str = "Food"
    type: str = "expense"


class BudgetAllowancePayload(BaseModel):
    amount: float


class BudgetEditPayload(BaseModel):
    title: str
    amount: float
    category: str = "Food"


class ExamPlanPayload(BaseModel):
    subject: str
    exam_date: str
    topics: str


class RepoCheckPayload(BaseModel):
    owner: str = "team-scholars"
    repo: str = "ScholarIQ"
    deadline: Optional[str] = None


class AIConfigPayload(BaseModel):
    provider: str = "builtin"  # 'builtin', 'gemini', 'lm-studio'
    api_key: Optional[str] = None


# ------------------ System & Health ------------------
@app.get("/health")
def health():
    engine_status = llm.get_engine_status()
    return {
        "ok": True,
        "engine": engine_status["engine"],
        "mode": engine_status["mode"],
        "models": {"chat": engine_status["chat"], "embed": engine_status["embed"]},
        "universal": True,
    }


@app.post("/ai/config")
def config_ai(cfg: AIConfigPayload):
    if cfg.api_key:
        os.environ["GEMINI_API_KEY"] = cfg.api_key
    return llm.get_engine_status()


# ------------------ Prof. Pilot (Multi-PDF Ingest & RAG) ------------------
@app.post("/ingest")
def ingest_files(files: List[UploadFile] = File(...)):
    """Accepts as many PDFs as the student wants at once!"""
    total_chunks = 0
    ingested_names = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            continue
        path = os.path.join(UPLOADS, os.path.basename(file.filename))
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        chunks = rag.ingest_pdf(path, file.filename)
        total_chunks += chunks
        ingested_names.append(file.filename)

    if not ingested_names:
        raise HTTPException(400, "Please upload valid PDF files.")

    return {
        "count": len(ingested_names),
        "files": ingested_names,
        "total_chunks": total_chunks,
        "status": f"Indexed {len(ingested_names)} document(s) ({total_chunks} sections)",
    }


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


# ------------------ Chrono-Regulator & Tasks ------------------
@app.post("/tasks/extract")
def extract_task_from_notice(t: TextPayload):
    return llm_guard(planner.extract_task, t.text)


@app.post("/tasks")
def create_task(t: NewTask):
    try:
        date.fromisoformat(t.due_date)
    except ValueError:
        raise HTTPException(400, "due_date must look like YYYY-MM-DD")
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


# ------------------ Timetable & Holidays ------------------
@app.get("/timetable")
def get_timetable(day: Optional[str] = None, date_str: Optional[str] = None):
    return toolkit.get_timetable_for_day(day, date_str)


@app.post("/timetable")
def add_timetable_class(t: TimetableEntry):
    return toolkit.add_timetable_entry(
        t.day_of_week, t.subject, t.start_time, t.end_time, t.room, t.professor, t.type
    )


@app.delete("/timetable/{entry_id}")
def delete_timetable_class(entry_id: int, day: str = "Monday"):
    return toolkit.delete_timetable_entry(entry_id, day)


@app.get("/holidays")
def list_holidays():
    return toolkit.get_holidays()


@app.post("/holidays")
def add_new_holiday(h: HolidayPayload):
    return toolkit.add_holiday(h.date, h.name, h.type)


@app.delete("/holidays/{holiday_id}")
def remove_holiday(holiday_id: int):
    return toolkit.delete_holiday(holiday_id)


@app.post("/calendar/parse")
def parse_calendar(p: TextPayload):
    return toolkit.parse_academic_calendar(p.text)


# ------------------ Attendance Management (From the-thing) ------------------
@app.get("/attendance")
def get_all_attendance():
    return toolkit.get_attendance()


@app.post("/attendance/subject")
def create_subject(p: SubjectPayload):
    return toolkit.add_subject(
        p.subject, p.short_code, p.color, p.attended, p.total, p.total_semester, p.target_pct
    )


@app.put("/attendance/subject")
def update_subject(p: SubjectEditPayload):
    return toolkit.edit_subject(
        p.id, p.subject, p.short_code, p.color, p.attended, p.total, p.total_semester, p.target_pct
    )


@app.delete("/attendance/subject/{subject_id}")
def remove_subject(subject_id: int):
    return toolkit.delete_subject(subject_id)


@app.post("/attendance/mark")
def mark_attendance(p: MarkAttendancePayload):
    return toolkit.mark_class_attendance(p.subject_id, p.mark, p.note)


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


# ------------------ Routine Coach ------------------
@app.get("/habits")
def get_habits():
    return toolkit.get_habits()


@app.post("/habits/toggle")
def toggle_habit(p: HabitTogglePayload):
    return toolkit.toggle_habit(p.id)


@app.post("/habits")
def add_habit(p: HabitPayload):
    return toolkit.add_habit(p.title, p.category)


@app.put("/habits/{habit_id}")
def edit_habit(habit_id: int, p: HabitEditPayload):
    return toolkit.edit_habit(habit_id, p.title, p.streak, p.category)


@app.delete("/habits/{habit_id}")
def remove_habit(habit_id: int):
    return toolkit.delete_habit(habit_id)


@app.get("/budget")
def get_budget():
    return toolkit.get_budget()


@app.post("/budget")
def add_budget(p: BudgetPayload):
    return toolkit.add_budget_entry(p.title, p.amount, p.category, p.type)


@app.post("/budget/allowance")
def set_allowance(p: BudgetAllowancePayload):
    return toolkit.set_budget_allowance(p.amount)


@app.put("/budget/{entry_id}")
def edit_budget(entry_id: int, p: BudgetEditPayload):
    return toolkit.edit_budget_entry(entry_id, p.title, p.amount, p.category)


@app.delete("/budget/{entry_id}")
def remove_budget(entry_id: int):
    return toolkit.delete_budget_entry(entry_id)


@app.post("/calendar/upload")
async def upload_calendar_file(file: UploadFile = File(...)):
    contents = await file.read()
    return toolkit.parse_calendar_file(contents, file.filename)


@app.post("/timetable/upload")
async def upload_timetable_file(file: UploadFile = File(...)):
    contents = await file.read()
    return toolkit.parse_timetable_file(contents, file.filename)


@app.post("/exam/plan")
def exam_plan(p: ExamPlanPayload):
    return llm_guard(toolkit.generate_exam_plan, p.subject, p.exam_date, p.topics)
