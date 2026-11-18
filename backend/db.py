"""SQLite helpers. All data lives in data/scholariq.db inside the project folder."""
import os
import sqlite3
from contextlib import closing
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.environ.get("SCHOLARIQ_DB") or os.path.join(ROOT, "data", "scholariq.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, doc TEXT, page INTEGER, text TEXT, emb BLOB);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, title TEXT, due_date TEXT, type TEXT, done INTEGER DEFAULT 0, done_on TEXT);
CREATE TABLE IF NOT EXISTS checkins(id INTEGER PRIMARY KEY, day TEXT, sleep_h REAL, mood INTEGER, water INTEGER, score INTEGER);
CREATE TABLE IF NOT EXISTS class_checkins(id INTEGER PRIMARY KEY, day TEXT, sleep_h REAL, mood INTEGER, water INTEGER, score INTEGER);
CREATE TABLE IF NOT EXISTS habits(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS habit_logs(habit_id INTEGER, day TEXT, PRIMARY KEY(habit_id, day));
CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY, name TEXT, attended INTEGER DEFAULT 0, total INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY, day TEXT, category TEXT, amount REAL, note TEXT);
CREATE TABLE IF NOT EXISTS prep(id INTEGER PRIMARY KEY, category TEXT, title TEXT, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS focus(id INTEGER PRIMARY KEY, day TEXT, minutes INTEGER, label TEXT);
CREATE TABLE IF NOT EXISTS journal(id INTEGER PRIMARY KEY, day TEXT, mood INTEGER, text TEXT);
CREATE TABLE IF NOT EXISTS cards(id INTEGER PRIMARY KEY, deck TEXT, front TEXT, back TEXT, due TEXT, interval INTEGER DEFAULT 0, ease REAL DEFAULT 2.5, reps INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS meals(id INTEGER PRIMARY KEY, day TEXT, slot TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS water(day TEXT PRIMARY KEY, glasses INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, ts TEXT, name TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS used_chunks(deck TEXT, chunk_id INTEGER, PRIMARY KEY(deck, chunk_id));
CREATE TABLE IF NOT EXISTS quiz_log(id INTEGER PRIMARY KEY, q TEXT);
"""


def conn():
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    c = sqlite3.connect(PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init():
    with closing(conn()) as c:
        c.executescript(SCHEMA)
        if "label" not in [r[1] for r in c.execute("PRAGMA table_info(chunks)")]:
            c.execute("ALTER TABLE chunks ADD COLUMN label TEXT")
        c.commit()


def q(sql, args=()):
    with closing(conn()) as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def one(sql, args=()):
    rows = q(sql, args)
    return rows[0] if rows else None


def run(sql, args=()):
    with closing(conn()) as c:
        with c:
            return c.execute(sql, args).lastrowid


def many(sql, rows):
    with closing(conn()) as c:
        with c:
            c.executemany(sql, rows)


def today():
    return date.today().isoformat()


def get_setting(key, default=""):
    r = one("SELECT value FROM settings WHERE key=?", (key,))
    return r["value"] if r else default


def set_setting(key, value):
    run("INSERT INTO settings(key,value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
