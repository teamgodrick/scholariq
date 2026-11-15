# ScholarIQ — Study · Plan · Thrive
### Privacy-First Universal Academic & Student Life Operating System

ScholarIQ is an on-device, local-first Operating System designed specifically for college and engineering students. It unifies attendance tracking with the 75% rule, holiday-aware timetables, RAG-grounded syllabus notes, WhatsApp deadlines, GitHub commit velocity, and physical/mental wellness into a single daily command cockpit.

---

## ⚡ Accessible to Every Student on Any Laptop (No High-End GPU or LM Studio Required)

Unlike traditional AI projects that demand 16GB+ RAM, gaming GPUs, or downloading 6GB models in LM Studio:
1. **Universal Smart Engine (Default)**: Runs 100% locally with **0 setup, 0 downloads, and 0 GPU requirements**. Works instantly even on an entry-level i3 or Celeron laptop!
2. **Optional Free Cloud AI**: Support for Google Gemini (Free Tier) with a one-click API key toggle in the UI.
3. **Optional Offline LM Studio**: For students with AI laptops who prefer local Llama 3.2 8B / nomic-embed models.
4. **Single-Click Launcher (`run.bat`)**: Double-click `run.bat` — it starts the backend, starts the frontend, and automatically opens your web browser to `http://localhost:5173`. No more multiple terminals or complex command lines!

---

## 🛠️ Key Features & Modules

### 1. 📊 College OS: Attendance & 75% Safe-to-Skip (Modeled on *The Thing*)
- **Complete Subject Control**: Add your real college subjects, edit attendance counts, or delete default courses with one click.
- **P / A / C Class Marking**:
  - **P (Present)**: Attended +1, Held +1.
  - **A (Absent)**: Attended +0, Held +1.
  - **C (No Class / Cancelled)**: Class cancelled or teacher absent — neutral, does not hurt attendance!
- **Accurate 75% Safe-to-Skip Rule**:
  - *If attendance ≥ 75%*: Tells you exact classes you can miss: `You can miss N class(es) and still stay at 75% right now.`
  - *If attendance < 75%*: Tells you exact consecutive classes you must attend to restore 75%.
- **Semester Target Tracker**: Track total classes held versus expected semester totals.

### 2. 📅 Academic Calendar, Weekly Timetable & Holiday Detection
- **Academic Calendar Import**: Paste your college's academic calendar; automatically extracts holidays and semester breaks.
- **Holiday Detection & Alert**: When a day is a holiday, the dashboard shows a celebratory **"🎉 Holiday: No Classes Today!"** banner and clears class schedules so you can relax or study at your own pace.
- **Weekly Schedule Customizer**: View and edit class periods for Monday, Tuesday, Wednesday, Thursday, Friday, and Saturday with room numbers and professor names.

### 3. 🎓 Prof. Pilot (Multi-PDF Ingest & RAG Copilot)
- **Unlimited Multi-PDF Ingestion**: Drag and drop as many syllabus, lecture slides, and lab PDFs as you want at once!
- **Strict Context Answering**: Answers queries strictly from your notes with exact document and page citations (e.g. `(Operating_Systems.pdf, p.4)`).
- **🗂️ Active-Recall Flashcards**: 3D interactive flip cards with question/answer toggle.
- **🎙️ Viva Voce Drill**: Roleplays a rigorous college viva examiner with evaluation points and follow-up counter-questions.
- **📝 Exam Quizzes & Summaries**: High-yield model exam questions and rapid topic cheat sheets.
- **🎙️ Voice Input (Web Speech API)**: Dictate doubts directly through your browser microphone.

### 4. ⚡ Chrono-Regulator (Smart Priority & Deadline Engine)
- **WhatsApp Notice Extractor**: Paste raw WhatsApp group messages, club notices, or CR emails. AI extracts true ISO dates, subjects, and urgency.
- **Ranked Priority Matrix**: Dynamic priority scoring (Exams > Labs > Assignments > Projects).
- **🔄 Auto Re-plan Missed Tasks**: 1-click button to re-prioritize overdue items.

### 5. 🛡️ GitHub Repo Sentinel (Project & Hackathon Anti-Stagnation)
- **Solves the "Sunday Night Sprint"**: Prevents team panic where students don't push code for days before evaluation.
- **Velocity Health Score (0–100%)**: Dynamically measures daily commit frequency against remaining time until deadline.
- **🚨 Stagnation Early Warning Radar**: Triggers an alert when deadline is ≤ 4 days and no commits occurred in 48 hours.
- **Actionable AI Recovery Plan**: Concrete steps (break tasks into small PRs, commit test scripts) to restore team velocity.

### 6. 💜 Wellness Core & Customizable Focus Timer
- **6-Metric Vital Check-in**: Sleep (hours), Mood (1–5), Water (`X / 12` glasses), Meals (`X / 4` meals), Exercise (`X / 90` mins), and Screen Time (`X / 16` hours).
- **Cosmic Burnout Gauge (0–100)**: Auto-compresses the daily schedule to top 2 tasks when burnout is high.
- **⏱️ Fully Customizable Focus Timer**: Preset buttons (15m, 25m, 45m, 60m) or type any custom minutes.
- **20-20-20 Eye Break & Posture Alerts**: Prompts you to look 20 feet away for 20 seconds during long sessions.
- **Helpline Card**: Tele-MANAS toll-free `14416` support.

---

## 🚀 How to Run (1-Click)

1. Double-click **`run.bat`** (or `start-scholariq.bat`).
2. That's it! The backend and frontend will start and automatically launch **`http://localhost:5173`** in your browser.
