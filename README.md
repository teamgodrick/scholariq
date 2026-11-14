# ScholarIQ

A privacy-first student life and academic OS. A local LLM (LM Studio) powers a
notes-only study assistant, a deadline planner and a burnout-aware daily plan.
No student data leaves the laptop.

## Run it (Windows)

1. Open LM Studio, load your chat model and the nomic embedding model, start the server (port 1234).
2. First time only: double-click `1-setup-backend.bat`, then `3-setup-frontend.bat`.
3. Every time: double-click `2-run-backend.bat`, then `4-run-frontend.bat`.
4. Open http://localhost:5173

## Folders

- backend/   Python brain (FastAPI): rag.py, planner.py, wellness.py, llm.py, db.py, main.py
- frontend/  React screens (Today, Prof. Pilot, Check-in)
- demo/      test questions and the demo script
- docs/      write-up and screenshots

## Modules

- Prof. Pilot: PDF notes are chunked, embedded locally, answered with page citations.
- Chrono-Regulator: tasks, priority scoring, deadline extraction from pasted messages.
- Wellness Core: daily check-in and an explainable 0-100 burnout score that reshapes the plan.
