## Objective
Get the AI Academic Integrity Framework running so student exam behavior (tab switches, etc.) is captured and suspicious activity is shown to teachers in real-time on the live dashboard.

## Running
- Backend: `http://localhost:8000` (uvicorn, no --reload, use `--reload` during development)
- Frontend: `http://localhost:3000` (npm run dev)
- Login: `student@demo.edu` / `student123` or `teacher@demo.edu` / `teacher123`
- Docker containers (Redis, PostgreSQL, MinIO) are NOT running — SQLite only
- All Redis operations are best-effort (try/except, no crash)

## Known Issues (resolved in code, just need restart if reverting)
- Port 8000 zombie: `netstat -ano | findstr :8000` → `taskkill /F /PID <PID>`. If PID 0 shows, run `Get-Process -Name "python*" | Stop-Process -Force` to kill all python processes
- npm audit fix --force was accidentally run and downgraded Next.js — reverted via `npm install next@16.2.10`

## Work Completed

### Backend

| File | Change |
|---|---|
| `exams/router.py` | New `POST /{exam_id}/start` endpoint — sets `enrollment.status = "active"` + `started_at` |
| `exams/router.py` | `POST /{exam_id}/submit` already had `calculate_risk_for_submission()` background task |
| `students/router.py` | Filtered completed/submitted from upcoming exams (`status.notin_(["completed", "submitted"])`) |
| `teachers/router.py` | Events ordered by `client_timestamp DESC` (was `server_timestamp` which had UTC bug) |
| `teachers/router.py` | Alerts ordered by `client_timestamp DESC`, timestamp sent as `client_timestamp` |
| `behavior/router.py` | New `_recalculate_risk_background()` — background risk calc after every event batch via `asyncio.create_task` |
| `behavior/router.py` | Granular try/except around each risk step (feature extraction, risk calc, timeline/explanation) with specific error logging |
| `behavior/router.py` | Removed stale `from sqlalchemy import select, desc` inside GET endpoint |
| `behavior/event_handler.py` | `datetime.now(timezone.utc).timestamp()` instead of `datetime.utcnow().timestamp()` (wrong on non-UTC systems) |
| `behavior/event_handler.py` | `uuid.UUID()` wrapping for exam_id/student_id (was `str` → `'str' object has no attribute 'hex'`) |
| `core/database.py` | `except PendingRollbackError` handler, SQLite WAL mode + `busy_timeout=5000` pragmas |
| `core/cache.py` | Redis `ping()` verification, `_call()` wrapper, `socket_connect_timeout=2` |
| `main.py` | `ensure_cors_headers` middleware |
| `feature_engine.py` | Fixed `_idle_ratio`: `e.get("event_data", {}).get("duration", 0)` — was returning the whole dict instead of duration |
| `explainer.py` | Fixed `EventType.PASTE` → `EventType.KEY_PASTE` (2 occurrences) |
| `explainer.py` | Fixed `EventType.COPY` → `EventType.KEY_COPY` |
| `exams/router.py` | `/start` auto-creates enrollment if missing (was returning 404) |
| `teachers/router.py` | `/suspicious` includes `low` risk level + scoped to `institution_id` |
| `ml/training/train.py` | Fixed model paths, XGBoost saves as `.json`; trained on synthetic data |
| `main.py` | Loads ML models at startup via `model_registry.load_default_ensemble()` |
| `risk/router.py` | Changed tuple return to `JSONResponse(status_code=500)` |
| `risk/router.py` | UUID conversion in GET events comparison |

### Frontend

| File | Change |
|---|---|
| `app/page.tsx` | Removed "Get Started", "Start Free Trial", "Learn More" buttons — only "Sign In" remains |
| `app/(dashboard)/student/exam/[examId]/page.tsx` | `startExam` now calls `POST /api/v1/exams/{id}/start` before starting timer |
| `app/(dashboard)/teacher/dashboard/page.tsx` | Suspicious students query now has `refetchInterval: 10000` |

## Current Behavior (as of 2026-07-14)
- Events POST works (200 accepted), stored in SQLite `raw_behavior_events` table
- `_recalculate_risk_background` runs after each batch:
  - Feature extraction: ✅ works
  - Risk calculation: ✅ works (score=2.00 level=safe for minimal events, ML falls back to rules since no model files)
  - Timeline/explanation: ✅ fixed (was crashing on EventType.PASTE)
  - RiskReport stored: ✅
- `enrollment.status` set to "active" when student clicks "Start Exam" → teacher sees "In Progress"
- Teacher dashboard polls every 10s for suspicious students
- Live dashboard polls every 5s via `setInterval` + `pollKey` for summary, students, alerts
- Live student detail page has `refetchInterval: 5000`
- Risk score shows as "safe" (2.00) for minimal events — need more tab switches/events to trigger higher risk levels

## Potential Future Issues
- Redis down — feature engineering queue fails gracefully (logged as WARNING)
- Risk level stays "safe" until enough suspicious events accumulate — may not show in "Suspicious Students" section
- If 8000 port won't release: `Get-Process -Name "python*" | Stop-Process -Force`
