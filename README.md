# ScholarIQ

A privacy-first student life and academic OS. Its AI uses the local LM Studio server to read
your own notes, slides and flowcharts, plan deadlines and study, and does not send your data
to a hosted AI service.

## Run it (Windows)

1. Open LM Studio, load a chat model and the Nomic embedding model, and start its server on port 1234.
2. Double-click `ScholarIQ.bat`. It creates a private Python environment and installs the local OCR dependencies when needed; the first setup needs internet. Your browser opens at http://localhost:8000.
3. Optional: use `ScholarIQ-Group.bat` to share only the Study Group board with friends on your Wi-Fi.

Attendance report images and scanned PDF pages use offline OCR; you do not need LM Studio for that feature. Review and correct the editable preview before importing, since OCR can make mistakes. The launcher installs OCR dependencies into its private Python environment; Python versions below 3.15 use RapidOCR, while Python 3.15 on Windows uses Windows' built-in OCR and requires a compatible language pack.

ScholarIQ does not retrain the base model on your files. Uploaded documents are indexed locally and relevant passages are retrieved when needed (RAG), so you can add or remove knowledge without retraining and keep source files on your laptop.

## What it does

- Prof. Pilot: answers from your own library first, then general knowledge, with cited sources,
  live streaming, memory for long chats and an optional double-check mode.
- Knowledge library: PDF, PowerPoint (including flowchart arrows and speaker notes), Word, TXT, Markdown,
  CSV and pictures. Hybrid search (keywords plus meaning) and a built-in AI health check.
- Flashcards with spaced repetition that never repeat, practice quizzes, exam mode revision plans.
- Chrono-Regulator: deadlines, priority plan, deadline extraction from pasted messages.
- Wellbeing: daily check-in with burnout score, mood journal, habits, nutrition and water, focus timer, sleep wind-down.
- Campus life: day-by-day timetable, one-time present/absent/no-class lecture tracking, attendance-report PDF/image import with review, semester-aware safe-skip estimates (75% target), academic-calendar imports, hostel budget and placement prep.
- Today's dashboard greets you by name, shows your scheduled lectures and calendar events, and supports a local profile picture.
- Code: GitHub Sentinel and resume helper. Together: study group board and anonymous mentor view.

## Folders

- backend/  Python brain
- web/      the website
- library/  drop study files here, then press Scan in the app (core-pack is a starter knowledge base)
- data/     your private database (never uploaded to GitHub)
- demo/     test questions and the demo script
