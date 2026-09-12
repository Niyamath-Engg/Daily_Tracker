# Daily OS — Product Requirements & Progress

## Original problem statement
Build "Daily OS" (subtitle: "Track the day. Build the life.") — a private, minimal, premium personal daily productivity & life-tracking web app. Open it daily and record reading, 1-page writing, exercise/weight/calories, book reviews, learning, good things, challenges, morning & night journals, daily tasks, custom monitoring metrics, and a Substack article pipeline. Core UX: complete the daily record in ~3–5 minutes. Requested stack: React + charts + Google Sheets + Netlify + Google auth. Must be fully functional (not a prototype): data persists, edit/delete work, charts use stored data.

## Platform adaptation & user choices
- Stack: React + FastAPI + MongoDB (this platform). Clean data-service layer (`frontend/src/services/api.js`) keeps DB swappable to Google Sheets later. Netlify config (`netlify.toml`, `_redirects`) included for the frontend.
- Auth: BOTH email/password (session token) AND Emergent-managed Google OAuth.
- Demo data: seedable & removable (tagged `demo:true`).
- Design: slate-blue minimal (Outfit/DM Sans/JetBrains Mono), light theme.
- AI: AI daily summary via Emergent LLM key (Claude sonnet-4-6).

## Architecture
- Backend `/app/backend/server.py`: auth (register/login/session/me/logout, cookie OR Bearer), daily_entries (per user+date, computed daily_score), books (embedded review+rating), learning, monitoring, substack, settings (goal config), stats (streaks/totals), ai/daily-summary, demo seed/clear. All scoped by user_id, `_id` excluded.
- Frontend `/app/frontend/src`: AuthContext + Protected routes; Layout (desktop sidebar, mobile bottom nav + FAB, Quick Add); pages: Dashboard, DailyEntry, DailyReview, Reading, Writing, Exercise, Learning, Journal, Reviews, Monitoring, Substack (Kanban drag-drop + editor), History (calendar), Settings (goals/units/demo/export). Recharts for charts; autosave with Saving/Saved status.

## User persona
A single private user tracking personal habits, reading, writing and reflections daily.

## Implemented (2026-06-12)
- All 12+ pages, full CRUD, persistence, streaks & stats, charts from stored data.
- Email/password + Google auth; AI daily summary.
- Demo data seed/clear; CSV per-collection + JSON backup export; goal enable/disable affecting progress %.
- Netlify SPA deploy config; README with setup/deploy/migration docs.
- Verified: backend 14/14 pytest pass; frontend E2E 100% pass (testing agent iteration_1).

## Backlog / future (not built)
- P1: Google Sheets storage adapter behind existing service layer.
- P2: AI weekly review, AI writing/book-review assistant, PWA/offline, notifications, PDF journal export, mood/financial tracking, calendar & Drive integration.
- Polish: replace native date inputs with shadcn Calendar for visual consistency.

## Next tasks
- Await user feedback after first review; prioritize Google Sheets adapter or AI weekly review next.
