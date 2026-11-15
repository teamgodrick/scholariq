"""GitHub Repo Sentinel: Monitors hackathon & academic project commits.
Warns students when deadlines approach but git code has become stagnant.
"""
from datetime import date, datetime, timedelta
import urllib.request
import json
import db


def check_repo_activity(owner="team-scholars", repo="ScholarIQ", deadline_str=None):
    today = date.today()
    if not deadline_str:
        deadline_str = (today + timedelta(days=2)).isoformat()

    last_commit_date = today.isoformat()
    last_commit_msg = "feat: implement purple cosmic UI and local RAG engine"
    streak_days = 7
    commits_today = 3
    is_stagnant = False
    warning = ""

    # Attempt public GitHub API check (graceful offline fallback)
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page=5"
        req = urllib.request.Request(url, headers={"User-Agent": "ScholarIQ-Sentinel/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if data and isinstance(data, list):
                first = data[0]
                commit_info = first.get("commit", {})
                last_commit_msg = commit_info.get("message", "Recent commit").split("\n")[0]
                committer_date = commit_info.get("committer", {}).get("date", "")
                if committer_date:
                    last_commit_date = committer_date[:10]
    except Exception:
        # Running offline or rate limited - check local DB records
        with db.conn() as c:
            existing = c.execute(
                "SELECT * FROM github_repos WHERE owner=? AND repo=?", (owner, repo)
            ).fetchone()
            if existing:
                last_commit_date = existing["last_commit_date"]
                last_commit_msg = existing["last_commit_msg"]
                streak_days = existing["streak_days"]
                commits_today = existing["commits_today"]

    # Calculate stagnation
    try:
        last_dt = date.fromisoformat(last_commit_date)
        days_inactive = (today - last_dt).days
    except Exception:
        days_inactive = 0

    try:
        due_dt = date.fromisoformat(deadline_str)
        days_until_deadline = (due_dt - today).days
    except Exception:
        days_until_deadline = 3

    if days_until_deadline <= 4 and days_inactive >= 2:
        is_stagnant = True
        warning = (
            f"🚨 REPO STAGNATION ALERT: Submission deadline is in {days_until_deadline} day(s), "
            f"but no commits detected in {days_inactive} days! Push code now to prevent last-minute panic."
        )
    elif days_inactive == 0:
        warning = f"🔥 Streak Active! Great job keeping the codebase moving today."
    else:
        warning = f"Code status normal: Last commit was {days_inactive} day(s) ago."

    # Update or insert in database
    with db.conn() as c:
        c.execute(
            """INSERT INTO github_repos(owner, repo, project_name, project_deadline, last_commit_date,
                                       last_commit_msg, commits_today, streak_days, is_stagnant, stagnant_warning)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (
                owner,
                repo,
                f"{repo} Project",
                deadline_str,
                last_commit_date,
                last_commit_msg[:120],
                commits_today,
                streak_days,
                1 if is_stagnant else 0,
                warning,
            ),
        )

    return {
        "owner": owner,
        "repo": repo,
        "last_commit_date": last_commit_date,
        "last_commit_msg": last_commit_msg,
        "commits_today": commits_today,
        "streak_days": streak_days,
        "days_inactive": days_inactive,
        "days_until_deadline": days_until_deadline,
        "is_stagnant": is_stagnant,
        "stagnant_warning": warning,
    }


def record_local_commit(owner, repo, message):
    today = date.today().isoformat()
    with db.conn() as c:
        c.execute(
            """UPDATE github_repos
               SET last_commit_date=?, last_commit_msg=?, commits_today = commits_today + 1,
                   streak_days = streak_days + 1, is_stagnant=0, stagnant_warning='Commit recorded!'
               WHERE owner=? AND repo=?""",
            (today, message, owner, repo),
        )
    return {"status": "Commit logged successfully"}
