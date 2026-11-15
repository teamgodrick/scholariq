# ScholarIQ — Study · Plan · Thrive
### Privacy-First Student Life & Academic Operating System

ScholarIQ is an on-device, local-first Operating System designed specifically for College students across India. It consolidates syllabus notes, WhatsApp deadlines, GitHub code commits, attendance requirements, and mental/physical wellness into a single, cohesive daily cockpit.

Powered encryptedly & locally by **Meta Llama 3.2 8B Instruct** (reasoning & chat) and **nomic-embed-text** (vector retrieval) through **LM Studio**. Zero student data leaves the machine, therefore is private and secured upto student and cloud API cost is exactly ₹0.

---

## 👥 Team ScholarIQ (3 Developers)
1. **Jeet Thakar** — Architect & AI Lead(Local RAG Engine, Chroma/SQLite Vector Memory, Chrono-Regulator Algorithms)
2. **Sayan Saha** — Systems & Backend Lead(FastAPI Server, SQLite Migrations, GitHub Sentinel Radar, Hardware Optimization)
3. **Aarush Dutta Majumdar** — Frontend & Prooftesting lead (Testing hthe website and features , testing profpilot with enough amount of test cases)

---

## 🚀 Key Modules Built & Active

### 1. 🎓 Prof. Pilot (Local Ground-Truth Academic Copilot)
- **Local PDF Ingestion**: Drops syllabus, lecture slides, and lab manuals directly into on-device vector storage.
- **Strict Context Answering**: Answers queries strictly using the student's own material, citing exact document names and page numbers (e.g. `(DBMS_Unit1.pdf, p.4)`).
- **Spaced-Repetition Flashcards**: Generates interactive 3D flip-cards from notes for active recall revision.
- **Viva Voce Simulator**: Roleplays a rigorous college viva examiner with evaluation benchmarks and follow-up counter-questions.
- **Exam Quiz & Rapid Summaries**: Generates 5-mark and 10-mark model questions with answers and unit-wise cheat sheets.
- **Voice Input (Web Speech)**: Speak questions directly using the browser microphone.

### 2. ⚡ Chrono-Regulator (Smart Priority & Deadline Engine)
- **WhatsApp Notice Extractor**: Paste raw WhatsApp group messages, CR announcements, or emails. The local LLM extracts the true ISO date, subject, and urgency.
- **Dynamic Priority Matrix**: Urgency + Academic Weighting (Exams > Labs > Assignments > Projects).
- **Auto Re-plan Missed Tasks**: Re-sequences overdue deadlines and offers instant catch-up slots.
- **Class Timetable & Clash Detector**: Weekly lecture schedule with conflict alerts and room navigation.

### 3. 🛡️ GitHub Repo Sentinel (Project & Hackathon Anti-Stagnation)
- **Commit Radar**: Monitors active project repositories (e.g. `ScholarIQ`).
- **Anti-Stagnation Alerts**: Warns students when a project or hackathon deadline is approaching (≤ 4 days) but code has remained stagnant (≥ 48h).
- **Streak & Velocity Counters**: Visualizes daily commit streaks and commits pushed today.

### 4. 💜 Wellness Core & Focus
- **6-Metric Vital Check-in**: Sleep (h), Mood (1-5), Hydration (glasses), Meals (0-4), Exercise (min), Screen Time (h).
- **Explainable Burnout Score (0-100)**: Mathematically combines physical deficits and upcoming academic workload.
- **Dynamic Plan Adaptation**: High burnout automatically compresses the daily schedule to the top 2 tasks only and defers non-essentials.
- **Integrated Pomodoro Timer**: 25-minute study focus with 5-minute break cycles.
- **20-20-20 Eye Break & Posture Prompts**: Prevents digital eye fatigue during late-night study sessions.
- **Helpline Card**: Indian student mental health support (Tele-MANAS toll-free `14416` & KIRAN).

### 5. 📊 Academic Toolkit
- **75% Attendance & Safe-to-Skip Calculator**:
  - *If attendance ≥ 75%*: Calculates exact number of upcoming classes you can safely skip (`Safe to skip N classes`).
  - *If attendance < 75%*: Calculates exact number of consecutive classes required to restore 75% attendance.
- **Exam Mode Revision Planner**: Synthesizes a structured day-by-day revision roadmap before finals.
- **Daily Discipline Streaks**: Track LeetCode solving, GitHub commits, and hydration.
- **Hostel Budget Manager**: Track pocket money, expenses, and daily safe spending limit.

---

## 🛠️ Step-by-Step Setup Guide

### Hardware & Software Prerequisites
- Modern laptop running Windows 10/11 with Python 3.10+ and Node.js 18+.
- **LM Studio** installed.

### Step 1: Start LM Studio (Local AI Server)
1. Open **LM Studio**.
2. Download / Load:
   - Chat Model: **`Llama-3.2-8B-Instruct`** (or `Llama-3-8B-Instruct` / `Mistral-7B`)
   - Embedding Model: **`nomic-embed-text-v1.5`**
3. In the Developer / Local Server tab, click **Start Server** on port **`1234`**.

### Step 2: One-Click Environment Setup (First Time Only)
1. Double-click **`1-setup-backend.bat`** (Installs FastAPI, Uvicorn, NumPy, PyPDF, and OpenAI SDK cleanly without Cython/compiler dependencies).
2. Double-click **`3-setup-frontend.bat`** (Installs frontend packages via npm).

### Step 3: Run the Application
1. Double-click **`2-run-backend.bat`** (Starts FastAPI backend on `http://localhost:8000`).
2. Double-click **`4-run-frontend.bat`** (Starts Vite React frontend on `http://localhost:5173`).
3. Open your browser at **`http://localhost:5173`**.

---

## 📁 Repository Structure :
```
ScholarIQ/
├── 0-check-tools.bat       # Environment verification script
├── 1-setup-backend.bat     # One-click backend setup (pip dependencies)
├── 2-run-backend.bat       # Starts FastAPI server (Port 8000)
├── 3-setup-frontend.bat    # Installs npm dependencies
├── 4-run-frontend.bat      # Starts Vite server (Port 5173)
├── backend/
│   ├── db.py               # SQLite schema & automatic migrations
│   ├── github_sentinel.py  # Git commit tracker & stagnation alerts
│   ├── llm.py              # LM Studio OpenAI-compatible client
│   ├── main.py             # FastAPI REST endpoints
│   ├── planner.py          # Chrono-Regulator priority matrix & timetable
│   ├── rag.py              # PDF chunking, nomic vector search & citations
│   ├── requirements.txt    # Python dependencies
│   ├── toolkit.py          # 75% Attendance, Habits, Budget & Exam Mode
│   └── wellness.py         # 6-metric burnout scoring & advice
├── frontend/
│   ├── public/             # logo-scholarIQ.jpeg, banner-scholarIQ.jpeg
│   ├── src/
│   │   ├── App.jsx         # Navigation shell & engine monitor
│   │   ├── Logo.jsx        # Glowing purple ScholarIQ crest
│   │   ├── api.js          # Backend API client
│   │   ├── index.css       # Purple cosmic theme, glassmorphism & motions
│   │   └── pages/
│   │       ├── Dashboard.jsx  # Today's Plan, Timetable, WhatsApp Extractor
│   │       ├── Chat.jsx       # Prof. Pilot, Flashcards, Quizzes, Viva
│   │       ├── CheckIn.jsx    # Wellness Core & 25m Pomodoro Timer
│   │       ├── Sentinel.jsx   # GitHub Repo Sentinel Radar
│   │       ├── Toolkit.jsx    # 75% Attendance, Habits, Budget, Exam Mode
│   │       └── Team.jsx       # 3-Member Team Showcase & Hardware Specs
├── demo/                   # Test questions & 3-minute demo script
└── docs/                   # Round 2 documentation & screenshots
```
