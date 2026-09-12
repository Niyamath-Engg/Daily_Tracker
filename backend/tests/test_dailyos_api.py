"""Daily OS backend API tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://daily-os-23.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session_and_user():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_{uuid.uuid4().hex[:8]}@dailyos.app"
    pw = "Test1234!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Tester"})
    assert r.status_code == 200, r.text
    data = r.json()
    token = data["session_token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s, data["user"], token


def test_auth_me(session_and_user):
    s, user, _ = session_and_user
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == user["email"]


def test_login_existing():
    email = f"TEST_{uuid.uuid4().hex[:8]}@dailyos.app"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!"})
    assert r.status_code == 200
    r = s.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"})
    assert r.status_code == 200
    assert "session_token" in r.json()


def test_login_bad():
    r = requests.post(f"{API}/auth/login", json={"email": "nobody@x.com", "password": "wrong"})
    assert r.status_code == 401


def test_unauth_me():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_daily_crud(session_and_user):
    s, _, _ = session_and_user
    date = "2026-01-15"
    r = s.put(f"{API}/daily/{date}", json={
        "reading": {"book": "Test", "pages_read": 10},
        "writing": {"pages_written": 2, "word_count": 500, "topic": "x"},
        "workout": {"completed": True, "duration": 30, "calories": 200},
        "good_things": [{"what": "sun", "why": ""}],
        "challenges": [],
        "morning_journal": {"intention": "focus"},
        "night_journal": {"day": "good"},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["score"]["percent"] > 0
    r = s.get(f"{API}/daily/{date}")
    assert r.status_code == 200
    entry = r.json()["entry"]
    assert entry["reading"]["pages_read"] == 10
    assert entry["writing"]["pages_written"] == 2


def test_books_crud(session_and_user):
    s, _, _ = session_and_user
    r = s.post(f"{API}/books", json={"title": "TEST Book", "author": "A", "total_pages": 100})
    assert r.status_code == 200
    bid = r.json()["book_id"]
    r = s.put(f"{API}/books/{bid}", json={"pages_read": 50})
    assert r.status_code == 200
    assert r.json()["pages_read"] == 50
    r = s.get(f"{API}/books")
    assert any(b["book_id"] == bid for b in r.json())
    r = s.delete(f"{API}/books/{bid}")
    assert r.status_code == 200


def test_learning_crud(session_and_user):
    s, _, _ = session_and_user
    r = s.post(f"{API}/learning", json={"date": "2026-01-15", "topic": "TEST", "category": "AI", "what_learned": "stuff"})
    assert r.status_code == 200
    lid = r.json()["learning_id"]
    r = s.get(f"{API}/learning")
    assert any(x["learning_id"] == lid for x in r.json())
    r = s.delete(f"{API}/learning/{lid}")
    assert r.status_code == 200


def test_monitoring_crud(session_and_user):
    s, _, _ = session_and_user
    r = s.post(f"{API}/monitoring", json={"date": "2026-01-15", "metric": "TEST_Weight", "value": 72.5, "unit": "kg"})
    assert r.status_code == 200
    rid = r.json()["record_id"]
    r = s.get(f"{API}/monitoring")
    assert any(x["record_id"] == rid for x in r.json())
    r = s.delete(f"{API}/monitoring/{rid}")
    assert r.status_code == 200


def test_substack_crud(session_and_user):
    s, _, _ = session_and_user
    r = s.post(f"{API}/substack", json={"title": "TEST Article", "status": "IDEA"})
    assert r.status_code == 200
    aid = r.json()["article_id"]
    r = s.put(f"{API}/substack/{aid}", json={"status": "DRAFTING", "draft": "hi"})
    assert r.status_code == 200
    assert r.json()["status"] == "DRAFTING"
    r = s.delete(f"{API}/substack/{aid}")
    assert r.status_code == 200


def test_settings(session_and_user):
    s, _, _ = session_and_user
    r = s.get(f"{API}/settings")
    assert r.status_code == 200
    goals = r.json()["goals"]
    goals[0]["enabled"] = False
    r = s.put(f"{API}/settings", json={"goals": goals})
    assert r.status_code == 200
    assert r.json()["goals"][0]["enabled"] is False


def test_stats(session_and_user):
    s, _, _ = session_and_user
    r = s.get(f"{API}/stats")
    assert r.status_code == 200
    d = r.json()
    for k in ["reading_streak", "days_tracked", "total_pages_read"]:
        assert k in d


def test_demo_seed_and_clear(session_and_user):
    s, _, _ = session_and_user
    r = s.post(f"{API}/demo/seed")
    assert r.status_code == 200
    r = s.get(f"{API}/stats")
    assert r.json()["days_tracked"] >= 1
    r = s.post(f"{API}/demo/clear")
    assert r.status_code == 200


def test_ai_summary(session_and_user):
    s, _, _ = session_and_user
    # Seed then hit AI summary for today
    s.post(f"{API}/demo/seed")
    from datetime import date
    today = date.today().isoformat()
    # ensure today entry exists with some content
    s.put(f"{API}/daily/{today}", json={
        "reading": {"book": "Deep Work", "pages_read": 20, "takeaway": "focus"},
        "writing": {"pages_written": 1, "word_count": 300, "topic": "ideas"},
        "workout": {"completed": True, "type": "Run", "duration": 30, "calories": 250},
    })
    r = s.post(f"{API}/ai/daily-summary", json={"date": today})
    assert r.status_code in (200, 502), r.text
    if r.status_code == 200:
        assert "summary" in r.json()
        assert len(r.json()["summary"]) > 0


def test_daily_delete(session_and_user):
    s, _, _ = session_and_user
    date = "2026-01-20"
    s.put(f"{API}/daily/{date}", json={"reading": {"pages_read": 5}})
    r = s.delete(f"{API}/daily/{date}")
    assert r.status_code == 200
    r = s.get(f"{API}/daily/{date}")
    assert r.status_code == 200
    # After delete, GET returns default empty scaffold
    assert (r.json()["entry"].get("reading") or {}).get("pages_read", 0) in (0, None)
