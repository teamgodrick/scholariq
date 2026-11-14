"""ScholarIQ API. Run:  uvicorn main:app --reload --port 8000"""
import os
import shutil
from datetime import date
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import llm
import planner
import rag
import wellness

app = FastAPI(title="ScholarIQ API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"], allow_headers=["*"],
)
db.init()
UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOADS, exist_ok=True)


def llm_guard(fn, *args):
    try:
        return fn(*args)
    except HTTPException:
        raise
    except Exception as e:  # LM Studio off, no model loaded, bad JSON, etc.
        raise HTTPException(503, f"AI engine problem: {e}")


class Question(BaseModel):
    question: str


class Text(BaseModel):
    text: str


class Topic(BaseModel):
    topic: str


class NewTask(BaseModel):
    title: str
    due_date: str
    type: str = "other"


class CheckIn(BaseModel):
    sleep_h: float
    mood: int
    water: int


@app.get("/health")
def health():
    try:
        return {"ok": True, "models": llm.models()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/ingest")
def ingest(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")
    path = os.path.join(UPLOADS, os.path.basename(file.filename))
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    chunks = llm_guard(rag.ingest_pdf, path, file.filename)
    return {"doc": file.filename, "chunks": chunks}


@app.post("/chat")
def chat(q: Question):
    return llm_guard(rag.answer, q.question)


@app.post("/quiz")
def quiz(t: Topic):
    return llm_guard(rag.quiz, t.topic)


@app.post("/tasks/extract")
def extract(t: Text):
    return llm_guard(planner.extract_task, t.text)


@app.post("/tasks")
def create_task(t: NewTask):
    try:
        date.fromisoformat(t.due_date)
    except ValueError:
        raise HTTPException(400, "due_date must look like 2026-11-20")
    return {"id": planner.add_task(t.title, t.due_date, t.type)}


@app.post("/tasks/{task_id}/done")
def done(task_id: int):
    planner.mark_done(task_id)
    return {"ok": True}


@app.get("/plan/today")
def plan():
    return planner.plan_today()


@app.post("/checkin")
def checkin(c: CheckIn):
    result = wellness.burnout(c.sleep_h, c.mood, c.water)
    with db.conn() as conn:
        conn.execute(
            "INSERT INTO checkins(day,sleep_h,mood,water,score) VALUES(?,?,?,?,?)",
            (date.today().isoformat(), c.sleep_h, c.mood, c.water, result["score"]))
    return result
