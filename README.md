# ScholarIQ

A privacy-first student life and academic OS. A local AI model (LM Studio) reads your own
notes, slides and flowcharts, plans your deadlines, adapts to your wellbeing, and never
sends your data to the cloud.

## Run it (Windows)

1. Open LM Studio, load a chat model and the nomic embedding model, and turn the server on (port 1234).
2. Double-click `ScholarIQ.bat`. Your browser opens at http://localhost:8000.
   Nothing to install: it uses only Python (3.9 or newer).
3. Optional: double-click `ScholarIQ-Group.bat` instead to share only the Study Group board with friends on your Wi-Fi.

## What it does

- Prof. Pilot: answers from your own library first, then general knowledge, with cited sources,
  live streaming, memory for long chats and an optional double-check mode.
- Knowledge library: PDF, PowerPoint (including flowchart arrows and speaker notes), Word, TXT, Markdown,
  CSV and pictures. Hybrid search (keywords plus meaning) and a built-in AI health check.
- Flashcards with spaced repetition that never repeat, practice quizzes, exam mode revision plans.
- Chrono-Regulator: deadlines, priority plan, deadline extraction from pasted messages.
- Wellbeing: daily check-in with burnout score, mood journal, habits, nutrition and water, focus timer, sleep wind-down.
- Campus life: attendance guard (75% rule), hostel budget, placement prep.
- Code: GitHub Sentinel and resume helper. Together: study group board and anonymous mentor view.

## Folders

- backend/  Python brain (no pip install needed)
- web/      the website
- library/  drop study files here, then press Scan in the app (core-pack is a starter knowledge base)
- data/     your private database (never uploaded to GitHub)
- demo/     test questions and the demo script
