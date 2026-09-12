# Daily OS — Track the day. Build the life.

A private, minimal personal dashboard to record and review your day: reading, writing, exercise, learning, journaling, reflections, custom monitoring metrics, and a Substack writing pipeline. Designed so you can complete your daily record in ~3–5 minutes.

---

## 1. Project overview
Daily OS is a full-stack personal life-tracking app with:
- **Dashboard** — greeting, today's completion %, tracker cards, streaks, weekly progress, AI daily summary.
- **Daily Entry** — one page with collapsible sections (reading, writing, workout, learning, good things, challenges, morning & night journal) and autosave.
- **Daily Review** — end-of-day snapshot of goals, highlights, learning, reading, writing, workout + AI reflection.
- **Reading** — currently reading / completed books, add book, progress, reading stats.
- **Book Reviews** — rating, likes/dislikes, lessons, favourite idea, recommend, full review.
- **Writing** — daily goal, distraction-free editor with word count & autosave, streaks, charts.
- **Exercise** — weight / calories / duration / workouts-per-week charts and history.
- **Learning** — filterable timeline of everything you've learned.
- **Journal** — morning & night journals with autosave and a searchable history.
- **Monitoring** — create any custom metric; automatic trend charts.
- **Substack** — 7-column Kanban pipeline (IDEA→PUBLISHED) with drag-and-drop and a distraction-free article editor with autosave.
- **History** — monthly calendar heat-map; open any day to view / edit / delete.
- **Settings** — configure daily goals (enable/disable), units, demo data, and CSV/JSON export.

## 2. Technology stack
- **Frontend:** React 19, React Router 7, Tailwind CSS, shadcn/ui, Recharts, lucide-react, sonner.
- **Backend:** FastAPI (Python), Motor (async MongoDB).
- **Database:** MongoDB (data-service layer keeps the DB swappable — see §12).
- **Auth:** Email/password (session token) **and** Emergent-managed Google OAuth.
- **AI:** AI daily summary via the Emergent LLM key (Claude).

## 3. Local installation
```bash
cd backend && pip install -r requirements.txt
cd ../frontend && yarn install
```

## 4. Environment variables
**backend/.env** (see `backend/.env.example`)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="dailyos"
CORS_ORIGINS="*"
EMERGENT_LLM_KEY="your-emergent-llm-key"
```
**frontend/.env** (see `frontend/.env.example`)
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
```
No secrets are hard-coded; the frontend only calls the backend via `REACT_APP_BACKEND_URL`.

## 5. Google Sheets setup (future/optional)
Data currently persists in MongoDB behind a clean service layer (`frontend/src/services/api.js`). To move to Google Sheets later, implement the same service functions against the Sheets API (sheets: `DailyEntries`, `Books`, `Learning`, `Monitoring`, `Substack`, `Settings`) — the UI needs no changes.

## 6. Google Cloud OAuth setup
Uses **Emergent-managed Google Auth** — the "Continue with Google" button redirects to `https://auth.emergentagent.com`, which returns a session the backend exchanges at `/api/auth/session`. No custom OAuth client needed for the preview.
For self-hosting with your own Google OAuth: create a Web OAuth client, set Authorized origins to your site origin and redirect URI to `<origin>/dashboard`, then swap the `/auth/session` exchange for Google's token endpoint.

## 7. Local development
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

## 8. Production build
```bash
cd frontend && yarn build   # outputs to frontend/build
```

## 9. Netlify deployment
`netlify.toml` + `frontend/public/_redirects` are included for SPA routing.
- Base directory: `frontend` · Build command: `yarn build` · Publish directory: `build`
- Env var: `REACT_APP_BACKEND_URL` = deployed backend URL.
- The `/*  /index.html  200` redirect ensures deep links (`/reading`, `/history`, …) never 404.
> Netlify hosts the frontend only; deploy the FastAPI backend separately and point `REACT_APP_BACKEND_URL` at it.

## 10. Troubleshooting
- Auth 401/redirect: verify `REACT_APP_BACKEND_URL` and backend reachability.
- AI summary fails: set a valid `EMERGENT_LLM_KEY`.
- Empty charts: add entries or load demo data in Settings → Data.

## 11. Database structure (MongoDB collections)
`users`, `user_sessions`, `daily_entries` (one per user per date), `books` (embedded `review` + `rating`), `learning`, `monitoring`, `substack`, `settings`. All scoped by `user_id`; demo records tagged `demo: true` for clean removal.

## 12. Future migration strategy
The UI talks only to `frontend/src/services/api.js`. To migrate to Google Sheets / Supabase / Firebase / PostgreSQL, reimplement those functions against the new backend — no page/component changes required.

## Test account
- Email: `tester@dailyos.app` · Password: `Test1234!`
