"""Wellness Core: 6-metric daily check-in and explainable Burnout Score (0-100)."""
from datetime import date, timedelta
import db


def workload_points():
    limit = (date.today() + timedelta(days=3)).isoformat()
    with db.conn() as c:
        row = c.execute(
            "SELECT COUNT(*) FROM tasks WHERE done=0 AND due_date<=?", (limit,)
        ).fetchone()
        n = row[0] if row else 0
    return min(25, n * 7), n


def burnout(sleep_h=7.0, mood=3, water=4, meals=3, exercise_m=20, screentime_h=6.0):
    """
    Computes an explainable 0-100 burnout index tailored for engineering students.
    - sleep_h: hours slept (target: 7-8h)
    - mood: 1 (exhausted/anxious) to 5 (great/energetic)
    - water: glasses of water (target: 8)
    - meals: proper meals eaten today (target: 3)
    - exercise_m: physical activity / walking minutes (target: 30m)
    - screentime_h: device screen time in hours (target: < 7h)
    """
    # Sleep points (up to 30)
    sleep_pts = min(30, max(0.0, 8.0 - sleep_h) * 7.5)

    # Mood points (up to 16)
    mood_pts = (5 - max(1, min(5, mood))) * 4.0

    # Hydration points (up to 12)
    water_pts = max(0, 8 - water) * 1.5

    # Meals deficit points (up to 15)
    meal_pts = max(0, 3 - min(3, meals)) * 5.0

    # Exercise deficit points (up to 10)
    exercise_pts = max(0.0, (30.0 - min(30, exercise_m)) / 3.0)

    # High screen time fatigue (up to 12)
    screen_pts = max(0.0, (screentime_h - 6.0) * 2.0) if screentime_h > 6 else 0.0
    screen_pts = min(12.0, screen_pts)

    # Workload pressure (up to 25)
    work_pts, due_soon = workload_points()

    raw_sum = sleep_pts + mood_pts + water_pts + meal_pts + exercise_pts + screen_pts + work_pts
    # Normalize gently to 0-100
    score = round(min(100.0, max(0.0, raw_sum)))

    if score >= 65:
        level = "High"
        advice = (
            "Burnout risk is critically high. Shrink today's schedule to your top 2 tasks only. "
            "Step away from the screen for 30 minutes, eat a warm meal, and commit to sleeping before 11 PM."
        )
    elif score >= 35:
        level = "Moderate"
        advice = (
            "Moderate fatigue detected. Maintain steady momentum: work in 25-minute Pomodoro blocks, "
            "practice 20-20-20 eye rests, and drink a tall glass of water."
        )
    else:
        level = "Optimal"
        advice = (
            "You are in your prime energy zone! Tackle your highest-priority or most challenging subject "
            "right now while cognitive stamina is high."
        )

    return {
        "score": score,
        "level": level,
        "advice": advice,
        "breakdown": {
            "sleep": round(sleep_pts, 1),
            "mood": round(mood_pts, 1),
            "water": round(water_pts, 1),
            "meals": round(meal_pts, 1),
            "exercise": round(exercise_pts, 1),
            "screen_time": round(screen_pts, 1),
            "workload": round(work_pts, 1),
            "tasks_due_in_3_days": due_soon,
        },
        "helplines": {
            "title": "National Student & Mental Health Support (India)",
            "telemanas": "14416 (24x7 Toll-Free Govt Helpline)",
            "kiran": "1800-599-0019",
            "note": "Guidance and awareness only; not a substitute for professional medical advice.",
        },
    }
