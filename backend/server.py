from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Cookie
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ---------- Models ----------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SessionInput(BaseModel):
    session_id: str


# ---------- Auth utilities ----------
async def create_session(user_id: str) -> str:
    token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    return token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token", value=token, httponly=True, secure=True,
        samesite="none", path="/", max_age=7 * 24 * 60 * 60,
    )


async def _validate_token(token: Optional[str]):
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})


async def get_current_user(request: Request, session_token: Optional[str] = Cookie(default=None)):
    tokens = []
    if session_token:
        tokens.append(session_token)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        tokens.append(auth[7:])
    if not tokens:
        raise HTTPException(status_code=401, detail="Not authenticated")
    for t in tokens:
        user = await _validate_token(t)
        if user:
            return user
    raise HTTPException(status_code=401, detail="Invalid session")


DEFAULT_GOALS = [
    {"key": "reading", "label": "Read", "enabled": True},
    {"key": "writing", "label": "Write 1 page", "enabled": True},
    {"key": "exercise", "label": "Exercise", "enabled": True},
    {"key": "learning", "label": "Learn something", "enabled": True},
    {"key": "morning_journal", "label": "Morning journal", "enabled": True},
    {"key": "night_journal", "label": "Night journal", "enabled": True},
    {"key": "good_things", "label": "Good things", "enabled": True},
    {"key": "challenges", "label": "Challenges", "enabled": True},
]


async def get_settings_doc(user_id: str):
    s = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    if not s:
        s = {
            "user_id": user_id,
            "goals": DEFAULT_GOALS,
            "weight_unit": "kg",
            "distance_unit": "km",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.settings.insert_one(dict(s))
        s.pop("_id", None)
    return s


def goal_completed(key: str, entry: dict, learning_count: int) -> bool:
    if key == "reading":
        return (entry.get("reading") or {}).get("pages_read", 0) not in (0, None) and (entry.get("reading") or {}).get("pages_read", 0) > 0
    if key == "writing":
        return (entry.get("writing") or {}).get("pages_written", 0) >= 1
    if key == "exercise":
        return bool((entry.get("workout") or {}).get("completed"))
    if key == "learning":
        return learning_count >= 1
    if key == "morning_journal":
        mj = entry.get("morning_journal") or {}
        return any(bool(str(mj.get(f, "")).strip()) for f in ["feeling", "intention", "priorities", "entry"])
    if key == "night_journal":
        nj = entry.get("night_journal") or {}
        return any(bool(str(nj.get(f, "")).strip()) for f in ["day", "went_well", "not_well", "grateful", "improve", "entry"])
    if key == "good_things":
        return len(entry.get("good_things") or []) >= 1
    if key == "challenges":
        return len(entry.get("challenges") or []) >= 1
    return False


async def compute_score(user_id: str, entry: dict) -> dict:
    settings = await get_settings_doc(user_id)
    goals = [g for g in settings.get("goals", DEFAULT_GOALS) if g.get("enabled")]
    date = entry.get("date")
    learning_count = await db.learning.count_documents({"user_id": user_id, "date": date})
    total = len(goals)
    completed = 0
    goal_status = {}
    for g in goals:
        done = goal_completed(g["key"], entry, learning_count)
        goal_status[g["key"]] = done
        if done:
            completed += 1
    percent = round((completed / total) * 100) if total else 0
    return {"completed": completed, "total": total, "percent": percent, "goals": goal_status}


# ---------- Auth Routes ----------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user_id = new_id("user")
    pw_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "user_id": user_id,
        "email": data.email.lower(),
        "name": data.name or data.email.split("@")[0],
        "picture": None,
        "password_hash": pw_hash,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    await get_settings_doc(user_id)
    token = await create_session(user_id)
    set_session_cookie(response, token)
    return {"user": {"user_id": user_id, "email": user["email"], "name": user["name"], "picture": None}, "session_token": token}


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return {"user": {"user_id": user["user_id"], "email": user["email"], "name": user.get("name"), "picture": user.get("picture")}, "session_token": token}


@api_router.post("/auth/session")
async def google_session(data: SessionInput, response: Response):
    async with httpx.AsyncClient() as http_client:
        r = await http_client.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": data.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Could not verify Google session")
    info = r.json()
    email = info["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = new_id("user")
        user = {
            "user_id": user_id,
            "email": email,
            "name": info.get("name"),
            "picture": info.get("picture"),
            "password_hash": None,
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        await get_settings_doc(user_id)
    else:
        user_id = user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": info.get("name"), "picture": info.get("picture")}})

    token = info.get("session_token") or f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    set_session_cookie(response, token)
    return {"user": {"user_id": user_id, "email": email, "name": info.get("name"), "picture": info.get("picture")}, "session_token": token}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user_id": user["user_id"], "email": user["email"], "name": user.get("name"), "picture": user.get("picture")}


@api_router.post("/auth/logout")
async def logout(response: Response, request: Request, session_token: Optional[str] = Cookie(default=None)):
    token = session_token
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Daily Entries ----------
@api_router.get("/daily/{date}")
async def get_daily(date: str, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    entry = await db.daily_entries.find_one({"user_id": uid, "date": date}, {"_id": 0})
    if not entry:
        entry = {"user_id": uid, "date": date, "reading": {}, "writing": {}, "workout": {},
                 "good_things": [], "challenges": [], "morning_journal": {}, "night_journal": {}}
    learning = await db.learning.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(100)
    score = await compute_score(uid, entry)
    return {"entry": entry, "learning": learning, "score": score}


@api_router.put("/daily/{date}")
async def save_daily(date: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    existing = await db.daily_entries.find_one({"user_id": uid, "date": date}, {"_id": 0})
    entry = existing or {"user_id": uid, "date": date, "created_at": now_iso()}
    for k in ["reading", "writing", "workout", "good_things", "challenges", "morning_journal", "night_journal", "notes"]:
        if k in payload:
            entry[k] = payload[k]
    entry["date"] = date
    entry["user_id"] = uid
    entry["updated_at"] = now_iso()
    score = await compute_score(uid, entry)
    entry["daily_score"] = score["percent"]
    await db.daily_entries.update_one({"user_id": uid, "date": date}, {"$set": entry}, upsert=True)
    entry.pop("_id", None)
    return {"entry": entry, "score": score}


@api_router.delete("/daily/{date}")
async def delete_daily(date: str, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    await db.daily_entries.delete_one({"user_id": uid, "date": date})
    await db.learning.delete_many({"user_id": uid, "date": date})
    return {"ok": True}


@api_router.get("/daily")
async def list_daily(user: dict = Depends(get_current_user), start: Optional[str] = None, end: Optional[str] = None):
    uid = user["user_id"]
    q = {"user_id": uid}
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = start
        if end:
            q["date"]["$lte"] = end
    entries = await db.daily_entries.find(q, {"_id": 0}).sort("date", -1).to_list(1000)
    return entries


# ---------- Books ----------
@api_router.get("/books")
async def list_books(user: dict = Depends(get_current_user)):
    return await db.books.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/books")
async def create_book(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    book = {
        "book_id": new_id("book"),
        "user_id": uid,
        "title": payload.get("title", ""),
        "author": payload.get("author", ""),
        "total_pages": int(payload.get("total_pages") or 0),
        "pages_read": int(payload.get("pages_read") or 0),
        "status": payload.get("status", "reading"),
        "start_date": payload.get("start_date"),
        "completion_date": payload.get("completion_date"),
        "rating": payload.get("rating"),
        "review": payload.get("review", {}),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.books.insert_one(dict(book))
    book.pop("_id", None)
    return book


@api_router.put("/books/{book_id}")
async def update_book(book_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    payload.pop("book_id", None)
    payload.pop("user_id", None)
    payload["updated_at"] = now_iso()
    res = await db.books.update_one({"user_id": uid, "book_id": book_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    book = await db.books.find_one({"user_id": uid, "book_id": book_id}, {"_id": 0})
    return book


@api_router.delete("/books/{book_id}")
async def delete_book(book_id: str, user: dict = Depends(get_current_user)):
    await db.books.delete_one({"user_id": user["user_id"], "book_id": book_id})
    return {"ok": True}


# ---------- Learning ----------
@api_router.get("/learning")
async def list_learning(user: dict = Depends(get_current_user), category: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if category:
        q["category"] = category
    return await db.learning.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@api_router.post("/learning")
async def create_learning(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    item = {
        "learning_id": new_id("learn"),
        "user_id": user["user_id"],
        "date": payload.get("date"),
        "topic": payload.get("topic", ""),
        "category": payload.get("category", "General"),
        "what_learned": payload.get("what_learned", ""),
        "source": payload.get("source", ""),
        "link": payload.get("link", ""),
        "notes": payload.get("notes", ""),
        "created_at": now_iso(),
    }
    await db.learning.insert_one(dict(item))
    item.pop("_id", None)
    return item


@api_router.put("/learning/{learning_id}")
async def update_learning(learning_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    payload.pop("learning_id", None)
    payload.pop("user_id", None)
    await db.learning.update_one({"user_id": user["user_id"], "learning_id": learning_id}, {"$set": payload})
    return await db.learning.find_one({"user_id": user["user_id"], "learning_id": learning_id}, {"_id": 0})


@api_router.delete("/learning/{learning_id}")
async def delete_learning(learning_id: str, user: dict = Depends(get_current_user)):
    await db.learning.delete_one({"user_id": user["user_id"], "learning_id": learning_id})
    return {"ok": True}


# ---------- Monitoring ----------
@api_router.get("/monitoring")
async def list_monitoring(user: dict = Depends(get_current_user), metric: Optional[str] = None):
    q = {"user_id": user["user_id"]}
    if metric:
        q["metric"] = metric
    return await db.monitoring.find(q, {"_id": 0}).sort("date", 1).to_list(5000)


@api_router.post("/monitoring")
async def create_monitoring(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    item = {
        "record_id": new_id("mon"),
        "user_id": user["user_id"],
        "date": payload.get("date"),
        "metric": payload.get("metric", ""),
        "value": float(payload.get("value") or 0),
        "unit": payload.get("unit", ""),
        "notes": payload.get("notes", ""),
        "created_at": now_iso(),
    }
    await db.monitoring.insert_one(dict(item))
    item.pop("_id", None)
    return item


@api_router.delete("/monitoring/{record_id}")
async def delete_monitoring(record_id: str, user: dict = Depends(get_current_user)):
    await db.monitoring.delete_one({"user_id": user["user_id"], "record_id": record_id})
    return {"ok": True}


# ---------- Substack ----------
@api_router.get("/substack")
async def list_substack(user: dict = Depends(get_current_user)):
    return await db.substack.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(1000)


@api_router.post("/substack")
async def create_substack(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    art = {
        "article_id": new_id("art"),
        "user_id": user["user_id"],
        "title": payload.get("title", "Untitled"),
        "category": payload.get("category", "General"),
        "status": payload.get("status", "IDEA"),
        "idea": payload.get("idea", ""),
        "draft": payload.get("draft", ""),
        "notes": payload.get("notes", ""),
        "target_date": payload.get("target_date"),
        "article_url": payload.get("article_url", ""),
        "published_date": payload.get("published_date"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.substack.insert_one(dict(art))
    art.pop("_id", None)
    return art


@api_router.put("/substack/{article_id}")
async def update_substack(article_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    payload.pop("article_id", None)
    payload.pop("user_id", None)
    payload["updated_at"] = now_iso()
    if payload.get("status") == "PUBLISHED" and not payload.get("published_date"):
        payload["published_date"] = now_iso()
    await db.substack.update_one({"user_id": user["user_id"], "article_id": article_id}, {"$set": payload})
    return await db.substack.find_one({"user_id": user["user_id"], "article_id": article_id}, {"_id": 0})


@api_router.delete("/substack/{article_id}")
async def delete_substack(article_id: str, user: dict = Depends(get_current_user)):
    await db.substack.delete_one({"user_id": user["user_id"], "article_id": article_id})
    return {"ok": True}


# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await get_settings_doc(user["user_id"])


@api_router.put("/settings")
async def update_settings(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    await get_settings_doc(uid)
    payload.pop("user_id", None)
    payload["updated_at"] = now_iso()
    await db.settings.update_one({"user_id": uid}, {"$set": payload})
    return await db.settings.find_one({"user_id": uid}, {"_id": 0})


# ---------- Stats ----------
def date_str_to_dt(d):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except Exception:
        return None


@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    entries = await db.daily_entries.find({"user_id": uid}, {"_id": 0}).to_list(5000)
    books = await db.books.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    learning = await db.learning.find({"user_id": uid}, {"_id": 0}).to_list(5000)

    entries_by_date = {e["date"]: e for e in entries}
    learning_dates = {}
    for l in learning:
        learning_dates.setdefault(l["date"], 0)
        learning_dates[l["date"]] += 1

    total_pages_read = sum((e.get("reading") or {}).get("pages_read", 0) or 0 for e in entries)
    total_pages_written = sum((e.get("writing") or {}).get("pages_written", 0) or 0 for e in entries)
    total_words = sum((e.get("writing") or {}).get("word_count", 0) or 0 for e in entries)
    total_workouts = sum(1 for e in entries if (e.get("workout") or {}).get("completed"))
    total_calories = sum((e.get("workout") or {}).get("calories", 0) or 0 for e in entries)
    books_completed = sum(1 for b in books if b.get("status") == "completed")

    def streak(pred):
        d = datetime.now(timezone.utc).date()
        count = 0
        # allow today missing -> start from today; if today not done, streak may start yesterday
        checked_today = False
        while True:
            ds = d.isoformat()
            e = entries_by_date.get(ds)
            done = pred(e, learning_dates.get(ds, 0)) if e is not None or ds in learning_dates else False
            if done:
                count += 1
            else:
                if not checked_today:
                    checked_today = True
                    d = d - timedelta(days=1)
                    continue
                break
            checked_today = True
            d = d - timedelta(days=1)
        return count

    reading_streak = streak(lambda e, lc: bool(e) and ((e.get("reading") or {}).get("pages_read", 0) or 0) > 0)
    writing_streak = streak(lambda e, lc: bool(e) and ((e.get("writing") or {}).get("pages_written", 0) or 0) >= 1)
    exercise_streak = streak(lambda e, lc: bool(e) and bool((e.get("workout") or {}).get("completed")))
    learning_streak = streak(lambda e, lc: lc >= 1)
    journal_streak = streak(lambda e, lc: bool(e) and any(str((e.get("night_journal") or {}).get(f, "")).strip() for f in ["day", "went_well", "grateful", "entry"]))

    avg_completion = round(sum(e.get("daily_score", 0) or 0 for e in entries) / len(entries)) if entries else 0

    return {
        "reading_streak": reading_streak,
        "writing_streak": writing_streak,
        "exercise_streak": exercise_streak,
        "journal_streak": journal_streak,
        "learning_streak": learning_streak,
        "total_books": len(books),
        "books_completed": books_completed,
        "total_pages_read": total_pages_read,
        "total_pages_written": total_pages_written,
        "total_words": total_words,
        "total_workouts": total_workouts,
        "total_calories": total_calories,
        "total_learning": len(learning),
        "avg_completion": avg_completion,
        "days_tracked": len(entries),
    }


# ---------- AI Daily Summary ----------
@api_router.post("/ai/daily-summary")
async def ai_daily_summary(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    date = payload.get("date")
    if not date:
        raise HTTPException(status_code=400, detail="date required")
    entry = await db.daily_entries.find_one({"user_id": uid, "date": date}, {"_id": 0}) or {}
    learning = await db.learning.find({"user_id": uid, "date": date}, {"_id": 0}).to_list(100)

    reading = entry.get("reading") or {}
    writing = entry.get("writing") or {}
    workout = entry.get("workout") or {}
    parts = [f"Date: {date}"]
    if reading.get("book"):
        parts.append(f"Reading: {reading.get('book')} - {reading.get('pages_read', 0)} pages, takeaway: {reading.get('takeaway', '')}")
    if writing.get("pages_written"):
        parts.append(f"Writing: {writing.get('pages_written')} pages on '{writing.get('topic', '')}' ({writing.get('word_count', 0)} words)")
    if workout.get("completed"):
        parts.append(f"Workout: {workout.get('type', '')} {workout.get('duration', 0)}min, {workout.get('calories', 0)} cal")
    if learning:
        parts.append("Learned: " + "; ".join(f"{l.get('topic')}: {l.get('what_learned')}" for l in learning))
    if entry.get("good_things"):
        parts.append("Good things: " + "; ".join(g.get("what", "") for g in entry.get("good_things", [])))
    if entry.get("challenges"):
        parts.append("Challenges: " + "; ".join(c.get("what", "") for c in entry.get("challenges", [])))
    mj = entry.get("morning_journal") or {}
    nj = entry.get("night_journal") or {}
    if mj:
        parts.append(f"Morning intention: {mj.get('intention', '')}")
    if nj:
        parts.append(f"Night reflection: {nj.get('day', '')} {nj.get('entry', '')}")

    context = "\n".join(parts)
    if len(context.strip()) < 30:
        return {"summary": "Not enough logged yet today to summarize. Add a few entries and try again."}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"daily-{uid}-{date}",
            system_message="You are a warm, concise personal reflection assistant. Given a person's raw daily log, write a short (3-4 sentence) encouraging summary of their day, acknowledging wins and gently noting one thing to build on tomorrow. Write in second person ('You'). No headers, no bullet points, just a warm paragraph.",
        ).with_model("anthropic", "claude-sonnet-4-6")
        resp = await chat.send_message(UserMessage(text=f"Here is my day:\n{context}\n\nWrite my daily reflection summary."))
        return {"summary": resp}
    except Exception as e:
        logger.error(f"AI summary failed: {e}")
        raise HTTPException(status_code=502, detail="Unable to generate summary right now. Please try again later.")


# ---------- Demo data ----------
@api_router.post("/demo/seed")
async def seed_demo(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    await clear_demo_internal(uid)
    import random
    today = datetime.now(timezone.utc).date()

    book1 = {"book_id": new_id("book"), "user_id": uid, "title": "Atomic Habits", "author": "James Clear",
             "total_pages": 320, "pages_read": 210, "status": "reading", "start_date": (today - timedelta(days=20)).isoformat(),
             "rating": None, "review": {}, "demo": True, "created_at": now_iso(), "updated_at": now_iso()}
    book2 = {"book_id": new_id("book"), "user_id": uid, "title": "Deep Work", "author": "Cal Newport",
             "total_pages": 296, "pages_read": 296, "status": "completed", "start_date": (today - timedelta(days=50)).isoformat(),
             "completion_date": (today - timedelta(days=30)).isoformat(), "rating": 5,
             "review": {"liked": "Actionable focus strategies", "disliked": "Some repetition", "lessons": "Time-block deep work sessions", "favourite_idea": "Depth over shallow busywork", "who_should_read": "Knowledge workers", "recommend": True, "full_review": "A must-read on focus in a distracted world.", "status": "completed"},
             "demo": True, "created_at": now_iso(), "updated_at": now_iso()}
    await db.books.insert_many([book1, book2])

    categories = ["Technology", "AI", "Business", "Finance", "Personal Development"]
    workout_types = ["Gym", "Running", "Walking", "Home Workout", "Cycling"]
    entries = []
    learnings = []
    monitoring = []
    weight = 74.0
    for i in range(21):
        d = (today - timedelta(days=i)).isoformat()
        did_workout = random.random() > 0.35
        weight += random.uniform(-0.3, 0.2)
        pages = random.randint(0, 30)
        pw = random.choice([0, 1, 1, 1, 2])
        entry = {
            "user_id": uid, "date": d, "demo": True,
            "reading": {"book": "Atomic Habits", "book_id": book1["book_id"], "author": "James Clear",
                        "pages_read": pages, "total_pages": 320, "minutes": pages * 2,
                        "takeaway": "Small habits compound over time." if pages else "", "completed": False},
            "writing": {"completed": pw >= 1, "pages_written": pw, "word_count": pw * random.randint(250, 400),
                        "topic": random.choice(["Habit systems", "Focus", "Weekly review", "Ideas"]), "content": "", "notes": ""},
            "workout": {"completed": did_workout, "type": random.choice(workout_types) if did_workout else "",
                        "duration": random.randint(30, 70) if did_workout else 0, "weight": round(weight, 1),
                        "calories": random.randint(200, 450) if did_workout else 0, "exercises": "", "notes": ""},
            "good_things": [{"what": "Had a productive morning", "why": "Felt focused", "notes": ""}] if random.random() > 0.4 else [],
            "challenges": [{"what": "Got distracted in the afternoon", "why": "Too many notifications", "learned": "Silence phone", "differently": "Use focus mode"}] if random.random() > 0.6 else [],
            "morning_journal": {"feeling": "Motivated", "intention": "Stay focused and present", "priorities": "1. Deep work\n2. Exercise\n3. Read", "entry": "Ready for a good day."} if random.random() > 0.4 else {},
            "night_journal": {"day": "Solid day overall", "went_well": "Finished key tasks", "not_well": "Slept late", "grateful": "Good health", "improve": "Earlier bedtime", "entry": ""} if random.random() > 0.4 else {},
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        # score
        score = await compute_score(uid, entry)
        entry["daily_score"] = score["percent"]
        entries.append(entry)

        if random.random() > 0.4:
            cat = random.choice(categories)
            learnings.append({"learning_id": new_id("learn"), "user_id": uid, "date": d, "demo": True,
                              "topic": cat + " insight", "category": cat,
                              "what_learned": "Discovered a useful concept about " + cat.lower() + " today.",
                              "source": "Article", "link": "", "notes": "", "created_at": now_iso()})
        monitoring.append({"record_id": new_id("mon"), "user_id": uid, "date": d, "demo": True,
                           "metric": "Weight", "value": round(weight, 1), "unit": "kg", "notes": "", "created_at": now_iso()})
        monitoring.append({"record_id": new_id("mon"), "user_id": uid, "date": d, "demo": True,
                           "metric": "Sleep", "value": round(random.uniform(6, 8.5), 1), "unit": "hrs", "notes": "", "created_at": now_iso()})

    await db.daily_entries.insert_many(entries)
    if learnings:
        await db.learning.insert_many(learnings)
    await db.monitoring.insert_many(monitoring)

    articles = [
        {"title": "Building Better Habits", "status": "DRAFTING", "category": "Personal Development", "idea": "How tiny habits compound."},
        {"title": "The Focus Advantage", "status": "IDEA", "category": "Productivity", "idea": "Why deep focus wins."},
        {"title": "My Reading System", "status": "EDITING", "category": "Learning", "idea": "How I track books."},
        {"title": "Weekly Reviews That Work", "status": "READY", "category": "Productivity", "idea": "A simple review template."},
        {"title": "One Year of Daily Writing", "status": "PUBLISHED", "category": "Writing", "idea": "Lessons from a writing streak."},
    ]
    subs = []
    for a in articles:
        subs.append({"article_id": new_id("art"), "user_id": uid, "title": a["title"], "category": a["category"],
                     "status": a["status"], "idea": a["idea"], "draft": "", "notes": "", "target_date": None,
                     "article_url": "https://example.substack.com" if a["status"] == "PUBLISHED" else "",
                     "published_date": now_iso() if a["status"] == "PUBLISHED" else None,
                     "demo": True, "created_at": now_iso(), "updated_at": now_iso()})
    await db.substack.insert_many(subs)
    return {"ok": True, "message": "Demo data seeded"}


async def clear_demo_internal(uid):
    for coll in [db.daily_entries, db.books, db.learning, db.monitoring, db.substack]:
        await coll.delete_many({"user_id": uid, "demo": True})


@api_router.post("/demo/clear")
async def clear_demo(user: dict = Depends(get_current_user)):
    await clear_demo_internal(user["user_id"])
    return {"ok": True, "message": "Demo data removed"}


@api_router.get("/")
async def root():
    return {"message": "Daily OS API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
