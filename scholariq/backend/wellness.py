"""Burnout score: simple, explainable, 0 (fine) to 100 (burnt out)."""
from datetime import date, timedelta
import db


def workload_points():
    limit = (date.today() + timedelta(days=3)).isoformat()
    with db.conn() as c:
        n = c.execute(
            "SELECT COUNT(*) FROM tasks WHERE done=0 AND due_date<=?", (limit,)
        ).fetchone()[0]
    return min(26, n * 8), n


def burnout(sleep_h, mood, water):
    """sleep_h: hours slept, mood: 1 (low) to 5 (great), water: glasses."""
    sleep_pts = min(40, max(0.0, 8 - sleep_h) * 10)
    mood_pts = (5 - max(1, min(5, mood))) * 6
    water_pts = max(0, 8 - water) * 1.25
    work_pts, due_soon = workload_points()
    score = round(min(100, sleep_pts + mood_pts + water_pts + work_pts))
    if score >= 65:
        level = "High"
        advice = ("Burnout risk is high. Finish only your top 2 tasks today, "
                  "take a 20-minute walk, and sleep before 11 PM.")
    elif score >= 35:
        level = "Moderate"
        advice = "Manageable load. Study in 25-minute blocks with 5-minute breaks and drink water."
    else:
        level = "Low"
        advice = "You are in good shape. Start with your hardest task while your energy is high."
    return {
        "score": score, "level": level, "advice": advice,
        "breakdown": {"sleep": round(sleep_pts), "mood": round(mood_pts),
                      "water": round(water_pts), "workload": work_pts,
                      "tasks_due_in_3_days": due_soon},
    }
