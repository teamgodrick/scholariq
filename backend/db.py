"""SQLite storage for ScholarIQ. One file, no server to install."""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scholariq.db")


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS chunks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc TEXT, page INTEGER, text TEXT, emb BLOB);
            CREATE TABLE IF NOT EXISTS tasks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT, due_date TEXT, type TEXT, done INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS checkins(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day TEXT, sleep_h REAL, mood INTEGER, water INTEGER, score INTEGER);
            """
        )
