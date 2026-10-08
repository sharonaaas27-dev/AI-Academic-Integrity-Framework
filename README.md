# AI Academic Integrity Framework

A privacy-first academic integrity platform for online examinations. It captures behavioral signals from students during exams, scores suspicious activity with a risk engine, and presents evidence to instructors in a live dashboard.

This project combines:
- a FastAPI backend for authentication, exam orchestration, behavior ingestion, and risk analysis
- a Next.js frontend for student and teacher workflows
- a behavior event pipeline for tab switches, keyboard activity, focus changes, and mouse patterns
- ML/rule-based risk scoring with explainable summaries and timelines

## Overview

The framework is designed to help educators detect potential misconduct in remote or hybrid assessments without relying on invasive webcam surveillance. Instead of automatically declaring a student dishonest, it surfaces explainable risk indicators that teachers can review.

Key goals:
- monitor student exam behavior in real time
- reduce false positives with multi-signal risk scoring
- provide evidence and timelines to instructors
- preserve privacy with minimal personal data capture
- support teacher and student dashboards

## Features

- Student exam flow with start/submission lifecycle
- Teacher dashboard for suspicious students and alert review
- Behavior event ingestion from browser or SDK
- Risk scoring with rule-based + ML-style signals
- Explainable AI summaries and event timelines
- Institution-aware access control
- Live polling and real-time activity updates
- SQLite-first local development mode with graceful fallback behavior

## Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy 2.0 (async)
- Pydantic v2
- SQLite for local/dev fallback
- JWT-based authentication
- Async task processing for background recalculation

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- Zustand
- Framer Motion

### Infrastructure / Services
- Docker Compose for Postgres, Redis, and MinIO
- Redis used for queue/cache best-effort behavior
- PostgreSQL intended for production/compose setup
- MinIO for object storage support

## Repository Structure

```text
.
├── .env.example
├── docker-compose.yml
├── docs/
│   └── architecture/
│       └── overview.md
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── admin
│   │   │       ├── analytics
│   │   │       ├── auth
│   │   │       ├── behavior
│   │   │       ├── courses
│   │   │       ├── exams
│   │   │       ├── notifications
│   │   │       ├── risk
│   │   │       ├── students
│   │   │       └── teachers
│   │   ├── core
│   │   ├── domain
│   │   ├── middleware
│   │   ├── models
│   │   ├── repositories
│   │   ├── services
│   │   ├── workers
│   │   └── main.py
│   ├── alembic
│   ├── ml
│   ├── requirements.txt
│   ├── requirements-full.txt
│   └── requirements-local.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── next.config.js
│   └── ...
├── index.html
├── vercel.json
├── AGENTS.md
└── README.md
```

## Architecture Summary

The backend exposes a set of API routes for:
- authentication and session management
- exam creation, publishing, and student enrollment
- student exam lifecycle
- behavior event intake
- risk calculation and alert generation
- teacher analytics and suspicious student monitoring

The system is designed around a behavior event pipeline:

1. Student interactions are captured as behavior events
2. Events are validated and stored
3. Feature extraction converts raw actions into risk-relevant metrics
4. Rule and ML logic produce a risk score
5. Explanation and timeline generation provide teacher-readable evidence
6. Alerts and dashboards surface suspicious activity

## Backend Design

The backend entry point is `backend/app/main.py`. It initializes:
- database connections
- cache connection
- ML model loading
- background risk job queue

Main backend areas:
- `backend/app/api/v1/*` — endpoint modules
- `backend/app/services/*` — ML, risk engine, feature engineering, timeline, explainability
- `backend/app/models/*` — SQLAlchemy/Pydantic models
- `backend/app/core/*` — database, config, cache, security, logging
- `backend/app/domain/*` — domain enums and behavior event types

## Frontend Design

The frontend is a Next.js app under `frontend/src`. It contains:
- login and role-based landing flows
- teacher dashboards
- student exam experiences
- polling and real-time updates
- charts and summary views

The landing page at `frontend/src/app/page.tsx` presents the product story and points users to sign-in.

## Default Local Login

The repository notes these demo credentials for local development:

- Student: `student@demo.edu` / `student123`
- Teacher: `teacher@demo.edu` / `teacher123`

## Running the Project

### Prerequisites
- Python 3.11+
- Node.js 20+
- npm
- optionally Docker for Postgres/Redis/MinIO

### Backend
From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The project runtime notes indicate the backend is served at:

```text
http://localhost:8000
```

### Frontend
From the repository root:

```bash
cd frontend
npm install
npm run dev
```

The frontend is expected at:

```text
http://localhost:3000
```

## Environment

The project includes `.env.example` with standard settings for:
- app name and environment
- server host and port
- CORS
- database
- Redis
- MinIO
- JWT secret and expiry
- risk model configuration

For local SQLite-only execution, the repo notes that Redis and Docker services may be unavailable and that Redis calls are best-effort rather than fatal.

## Docker Setup

The repository includes a `docker-compose.yml` file with:
- PostgreSQL
- Redis
- MinIO

This is intended for a fuller environment with production-style services. In local development scenarios, the project can run without Docker using SQLite fallback.

## Risk Engine

The architecture documentation describes a risk score that blends:
- rule-based signals
- ML anomaly scoring
- contextual exam factors

This is consistent with the code and services under:
- `backend/app/services/risk`
- `backend/app/services/feature_engineering`
- `backend/app/services/explainable_ai`
- `backend/app/services/timeline`

The risk logic produces:
- overall score
- risk level
- explanation summary
- timeline-based evidence
- suspicious event triggers

## Behavior Monitoring

Behavior data is collected through event ingestion endpoints and processed in batches. This is designed to detect:
- tab switches
- focus loss
- keyboard irregularities
- suspicious navigation patterns
- abnormal mouse and typing behavior

These are stored and later analyzed to produce risk summaries for teachers.

## Security & Privacy Notes

The project emphasizes privacy-first monitoring:
- no automatic accusation
- explanation-first review
- teacher-facing evidence rather than opaque scoring
- JWT session protection
- rate limiting and middleware security hooks
- institution scoping

The architecture docs explicitly describe the system as avoiding webcam-based surveillance and instead focusing on behavior analysis.

## Known Project Notes

The repository includes operational notes for a working local setup:
- backend runs on port 8000
- frontend runs on port 3000
- local Redis/PostgreSQL/MinIO containers are not always running
- SQLite is the default local fallback
- Redis operations are intentionally best-effort and fail without crashing the app

## License

No explicit license file was found in the repository snapshot reviewed here.

## Summary

This project is a full-stack academic integrity system focused on exam behavior monitoring, explainable risk scoring, and teacher oversight. It is built around FastAPI + Next.js and is designed to support live dashboards, behavioral analytics, and fair review workflows without relying on invasive surveillance.
