# ScholarIQ

A privacy-first student life and academic OS. A local LLM (LM Studio) powers a
notes-only study assistant, a deadline planner and a burnout-aware daily plan.
No student data leaves the laptop.

## Run it

1. LM Studio: load a chat model and an embedding model, then start the server (port 1234).
2. Backend:
   cd backend
   python -m venv .venv
   .venv\Scripts\activate          (Mac/Linux: source .venv/bin/activate)
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
3. Frontend (in a second terminal):
   cd frontend
   npm install
   npm run dev
4. Open http://localhost:5173

## Modules

- Prof. Pilot: PDF notes are chunked, embedded locally, answered with page citations.
- Chrono-Regulator: tasks, priority scoring, deadline extraction from pasted messages.
- Wellness Core: daily check-in and an explainable 0-100 burnout score that reshapes the plan.
