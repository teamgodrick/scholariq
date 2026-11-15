"""SQLite storage for ScholarIQ. Zero cloud storage, 100% private local DB."""
import os
import sqlite3
from datetime import date

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scholariq.db")


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _migrate(c):
    """Safely adds newly required columns to existing tables without ever crashing."""
    try:
        # Check checkins columns
        existing_checkins = [col[1] for col in c.execute("PRAGMA table_info(checkins)").fetchall()]
        new_checkins_cols = [
            ("level", "TEXT DEFAULT 'Low'"),
            ("advice", "TEXT DEFAULT ''"),
            ("meals", "INTEGER DEFAULT 3"),
            ("exercise_m", "INTEGER DEFAULT 20"),
            ("screentime_h", "REAL DEFAULT 6.0"),
            ("created_at", "TEXT DEFAULT ''"),
        ]
        for col_name, col_type in new_checkins_cols:
            if col_name not in existing_checkins:
                try:
                    c.execute(f"ALTER TABLE checkins ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass
    except Exception:
        pass

    try:
        # Check tasks columns
        existing_tasks = [col[1] for col in c.execute("PRAGMA table_info(tasks)").fetchall()]
        new_tasks_cols = [
            ("priority_override", "INTEGER DEFAULT NULL"),
            ("created_at", "TEXT DEFAULT ''"),
        ]
        for col_name, col_type in new_tasks_cols:
            if col_name not in existing_tasks:
                try:
                    c.execute(f"ALTER TABLE tasks ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass
    except Exception:
        pass

    try:
        # Check attendance columns
        existing_attendance = [col[1] for col in c.execute("PRAGMA table_info(attendance)").fetchall()]
        new_attendance_cols = [
            ("short_code", "TEXT DEFAULT ''"),
            ("color", "TEXT DEFAULT '#a855f7'"),
            ("total_semester", "INTEGER DEFAULT 60"),
        ]
        for col_name, col_type in new_attendance_cols:
            if col_name not in existing_attendance:
                try:
                    c.execute(f"ALTER TABLE attendance ADD COLUMN {col_name} {col_type}")
                except Exception:
                    pass
    except Exception:
        pass


def init():
    with conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS chunks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc TEXT,
                page INTEGER,
                text TEXT,
                emb BLOB
            );

            CREATE TABLE IF NOT EXISTS documents(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE,
                chunks_count INTEGER DEFAULT 0,
                file_size INTEGER DEFAULT 0,
                uploaded_at TEXT
            );

            CREATE TABLE IF NOT EXISTS tasks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                due_date TEXT,
                type TEXT DEFAULT 'assignment',
                done INTEGER DEFAULT 0,
                priority_override INTEGER DEFAULT NULL,
                created_at TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS checkins(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day TEXT,
                sleep_h REAL DEFAULT 7,
                mood INTEGER DEFAULT 3,
                water INTEGER DEFAULT 4,
                meals INTEGER DEFAULT 3,
                exercise_m INTEGER DEFAULT 20,
                screentime_h REAL DEFAULT 6,
                score INTEGER DEFAULT 25,
                level TEXT DEFAULT 'Low',
                advice TEXT DEFAULT '',
                created_at TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS timetable(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day_of_week TEXT,
                subject TEXT,
                start_time TEXT,
                end_time TEXT,
                room TEXT,
                professor TEXT,
                type TEXT DEFAULT 'Lecture'
            );

            CREATE TABLE IF NOT EXISTS holidays(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT UNIQUE,
                name TEXT,
                type TEXT DEFAULT 'Public Holiday'
            );

            CREATE TABLE IF NOT EXISTS academic_calendars(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT,
                description TEXT,
                uploaded_at TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS github_repos(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner TEXT,
                repo TEXT,
                project_name TEXT,
                project_deadline TEXT,
                last_commit_date TEXT,
                last_commit_msg TEXT,
                commits_today INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                is_stagnant INTEGER DEFAULT 0,
                stagnant_warning TEXT
            );

            CREATE TABLE IF NOT EXISTS attendance(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT UNIQUE,
                short_code TEXT DEFAULT '',
                color TEXT DEFAULT '#a855f7',
                attended INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                total_semester INTEGER DEFAULT 60,
                target_pct REAL DEFAULT 75.0
            );

            CREATE TABLE IF NOT EXISTS attendance_logs(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject_id INTEGER,
                date TEXT,
                mark TEXT,
                note TEXT DEFAULT '',
                created_at TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS habits(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                category TEXT DEFAULT 'Study',
                streak INTEGER DEFAULT 0,
                completed_today INTEGER DEFAULT 0,
                last_completed_date TEXT
            );

            CREATE TABLE IF NOT EXISTS flashcards(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc TEXT,
                topic TEXT,
                question TEXT,
                answer TEXT,
                confidence INTEGER DEFAULT 0,
                next_review TEXT,
                reviews_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS budget(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                amount REAL,
                category TEXT,
                type TEXT DEFAULT 'expense',
                date TEXT
            );

            CREATE TABLE IF NOT EXISTS app_settings(
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS exam_plans(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT,
                exam_date TEXT,
                syllabus_topics TEXT,
                plan_json TEXT,
                created_at TEXT DEFAULT ''
            );
            """
        )
        _migrate(c)
        _seed_defaults(c)


def _seed_defaults(c):
    """Seed helpful sample data if starting fresh for instant demo experience."""
    if c.execute("SELECT COUNT(*) FROM timetable").fetchone()[0] == 0:
        c.executemany(
            """INSERT INTO timetable(day_of_week, subject, start_time, end_time, room, professor, type)
               VALUES(?,?,?,?,?,?,?)""",
            [
                ("Monday", "AI Assisted Problem Solving using Python", "08:30", "09:30", "Room 8008", "Dr. Anupam", "Lecture"),
                ("Monday", "Calculus and Differential Equations", "09:45", "10:45", "Hall A", "Prof. Verma", "Lecture"),
                ("Monday", "Applied Physics Lab", "11:00", "13:00", "Physics Lab 2", "Dr. Rao", "Practical"),
                ("Tuesday", "Computational Biology", "10:00", "11:30", "Room 10104", "Dr. Iyer", "Lecture"),
                ("Tuesday", "Heritage, Democracy and Ecology", "13:00", "14:30", "Hall B", "Prof. Reddy", "Lecture"),
                ("Wednesday", "AI Python Hands-on Lab", "09:30", "11:30", "Lab 302", "Dr. Anupam", "Practical"),
                ("Wednesday", "Calculus Tutorial", "14:00", "15:00", "Hall A", "Prof. Verma", "Tutorial"),
                ("Thursday", "Applied Physics Theory", "11:00", "12:30", "Hall A", "Dr. Rao", "Lecture"),
                ("Thursday", "Computational Biology Lab", "14:00", "16:00", "Bio Lab 1", "Dr. Iyer", "Practical"),
                ("Friday", "Heritage & Democracy", "09:00", "10:30", "Room 401", "Prof. Reddy", "Lecture"),
                ("Friday", "Minor Project Review", "14:00", "16:30", "Auditorium", "Panel", "Project"),
            ],
        )

    if c.execute("SELECT COUNT(*) FROM attendance").fetchone()[0] == 0:
        c.executemany(
            """INSERT INTO attendance(subject, short_code, color, attended, total, total_semester, target_pct)
               VALUES(?,?,?,?,?,?,?)""",
            [
                ("AI Assisted Problem Solving using Python", "AI Python", "#8A4FE0", 37, 47, 72, 75.0),
                ("Calculus and Differential Equations", "Calculus", "#E0473D", 26, 31, 48, 75.0),
                ("Applied Physics", "Physics", "#3B6FF0", 34, 40, 60, 75.0),
                ("Computational Biology", "Comp Bio", "#22A55A", 36, 40, 60, 75.0),
                ("Heritage, Democracy and Ecology", "Heritage", "#F0902B", 18, 25, 36, 75.0),
            ],
        )

    if c.execute("SELECT COUNT(*) FROM holidays").fetchone()[0] == 0:
        c.executemany(
            """INSERT OR IGNORE INTO holidays(date, name, type) VALUES(?,?,?)""",
            [
                ("2026-10-02", "Gandhi Jayanti", "National Holiday"),
                ("2026-10-31", "Diwali Festival", "Holiday"),
                ("2026-11-01", "Diwali Balipratipada", "Holiday"),
                ("2026-11-15", "Sunday / Weekend Break", "Weekend"),
                ("2026-11-20", "University Sports Fest", "College Event"),
                ("2026-12-25", "Christmas Day", "Public Holiday"),
            ],
        )

    if c.execute("SELECT COUNT(*) FROM habits").fetchone()[0] == 0:
        c.executemany(
            """INSERT INTO habits(title, category, streak, completed_today, last_completed_date) VALUES(?,?,?,?,?)""",
            [
                ("Solve 1 LeetCode Problem", "Placement", 8, 1, date.today().isoformat()),
                ("Git Commit Daily Code", "Code", 12, 1, date.today().isoformat()),
                ("Review Prof. Pilot Notes", "Study", 5, 0, None),
                ("Drink 3L Water", "Wellness", 6, 1, date.today().isoformat()),
                ("20-min Evening Walk / Exercise", "Wellness", 4, 0, None),
            ],
        )

    if c.execute("SELECT COUNT(*) FROM github_repos").fetchone()[0] == 0:
        c.execute(
            """INSERT INTO github_repos(owner, repo, project_name, project_deadline, last_commit_date, last_commit_msg, commits_today, streak_days, is_stagnant, stagnant_warning)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (
                "team-scholars",
                "ScholarIQ",
                "ScholarIQ Final Project / Hackathon",
                date.today().isoformat(),
                date.today().isoformat(),
                "feat: purple cosmic UI and local RAG engine",
                5,
                7,
                0,
                "",
            ),
        )

    # Seed default monthly allowance in app_settings
    c.execute(
        """INSERT OR IGNORE INTO app_settings(key, value) VALUES('monthly_allowance', '6000')"""
    )
