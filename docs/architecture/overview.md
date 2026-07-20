# AI Academic Integrity Framework — Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────────┐   │
│  │ Next.js  │  │ Behavior │  │   Third-party (LMS)     │   │
│  │ Frontend │  │ SDK      │  │   LTI Integration       │   │
│  └────┬─────┘  └────┬─────┘  └───────────┬─────────────┘   │
└───────┼──────────────┼──────────────────┼───────────────────┘
        │              │                  │
┌───────┼──────────────┼──────────────────┼───────────────────┐
│       │         ┌────┴────┐             │   Gateway Layer   │
│       │         │ WebSocket             │                   │
│       │         │ Gateway │             │                   │
│       │         └─────────┘             │                   │
│       │              │                  │                   │
│       ▼              ▼                  ▼                   │
│  ┌─────────────────────────────────────────────┐           │
│  │           API Gateway (Nginx/Traefik)        │           │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌────────┐  │           │
│  │  │ Auth  │ │ Rate  │ │ Load  │ │  WAF   │  │           │
│  │  │ Proxy │ │Limit  │ │Balancer│ │        │  │           │
│  │  └───────┘ └───────┘ └───────┘ └────────┘  │           │
│  └─────────────────────────────────────────────┘           │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────┐           │
│  │           FastAPI Backend                    │           │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │           │
│  │  │ REST API│ │WebSocket │ │  Background   │  │           │
│  │  │ Handlers│ │Handlers  │ │  Workers      │  │           │
│  │  └────┬────┘ └────┬─────┘ └──────┬───────┘  │           │
│  │       │           │              │           │           │
│  │       ▼           ▼              ▼           │           │
│  │  ┌──────────────────────────────────────┐    │           │
│  │  │         Service Layer                │    │           │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐ │    │           │
│  │  │  │Auth   │ │Exam  │ │Risk  │ │ML   │ │    │           │
│  │  │  │Service│ │Service│ │Engine│ │Engine│ │    │           │
│  │  │  └──────┘ └──────┘ └──────┘ └─────┘ │    │           │
│  │  └──────────────────────────────────────┘    │           │
│  └─────────────────────────────────────────────┘           │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────┐           │
│  │           Data Layer                         │           │
│  │  ┌──────────┐ ┌──────┐ ┌──────┐ ┌────────┐ │           │
│  │  │PostgreSQL│ │Redis │ │MinIO │ │RabbitMQ│ │           │
│  │  │(Primary) │ │Cache │ │(Blob) │ │(Queue) │ │           │
│  │  └──────────┘ └──────┘ └──────┘ └────────┘ │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Layered Architecture (Clean Architecture)

```
┌──────────────────────────────────────────────────┐
│  Interfaces Layer (API controllers, WebSockets)  │
├──────────────────────────────────────────────────┤
│  Application Layer (Use Cases, DTOs)             │
├──────────────────────────────────────────────────┤
│  Domain Layer (Entities, Value Objects, Events)  │
├──────────────────────────────────────────────────┤
│  Infrastructure Layer (DB, Cache, ML, Storage)   │
└──────────────────────────────────────────────────┘
```

## Data Flow: Event Processing Pipeline

```
Behavior SDK → WebSocket → Event Queue → Feature Engineering → Rule Engine
                                                                     │
                                                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Risk Scoring Engine                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │  Rule Score  │  │  ML Score    │  │  Context Score          │  │
│  │  (0-100)     │  │  (0-100)     │  │  (time remaining, diff) │  │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘  │
│                                                                     │
│  Final Score = w1 × RuleScore + w2 × MLScore + w3 × ContextScore  │
│  where w1 + w2 + w3 = 1.0                                         │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Explainable AI → Timeline Engine → Notification → Audit Log      │
└────────────────────────────────────────────────────────────────────┘
```

## Risk Score Formula

```
RiskScore = α × S_rules + β × S_ml + γ × S_context

Where:
  S_rules   = normalized rule-based score (0-100)
  S_ml      = anomaly score from ensemble (0-100)
  S_context = exam context score based on difficulty, time remaining

  α, β, γ are dynamic weights:
  - Default: α=0.3, β=0.5, γ=0.2
  - Configurable per institution/exam

Risk Levels:
  - 0-20:   Safe
  - 21-40:  Low Risk
  - 41-60:  Medium Risk
  - 61-80:  High Risk
  - 81-100: Critical
```

## Authentication Architecture

```
┌──────────┐     ┌────────────┐     ┌──────────────┐
│  Client  │────▶│  /auth/*   │────▶│  Auth Service │
└──────────┘     └────────────┘     └──────┬───────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                        ┌────────┐  ┌──────────┐  ┌────────┐
                        │Access  │  │ Refresh  │  │ 2FA/   │
                        │Token   │  │ Token    │  │ Email  │
                        │(15min) │  │(7 days)  │  │ Verify │
                        └────────┘  └──────────┘  └────────┘

JWT Claims:
{
  sub: user_id,
  role: role_enum,
  institution_id: uuid,
  session_id: uuid,
  iat: timestamp,
  exp: timestamp
}
```

## Key Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| API Framework | FastAPI | Async, auto-docs, validation via Pydantic |
| ORM | SQLAlchemy 2.0 | Mature, async support, repository pattern |
| Validation | Pydantic v2 | Fast, integrated with FastAPI |
| Queue | Redis + RQ | Simple, fast, good for moderate throughput |
| ML Runtime | ONNX + sklearn | Fast inference, portable models |
| Feature Store | Redis + PostgreSQL | Hot features in Redis, cold in PG |
| Real-time | WebSockets (FastAPI) | Native async support |
| Frontend State | React Query + Zustand | Server cache + client state |
| Behavior SDK | Vanilla JS | Zero dependencies, embed everywhere |
| Monitoring | Prometheus + Grafana | Industry standard |

## Security Architecture

```
┌──────────────────────────────────────┐
│  TLS 1.3 (End-to-end encryption)     │
├──────────────────────────────────────┤
│  JWT Access + Refresh Token Rotation │
├──────────────────────────────────────┤
│  CSRF Double-Submit Cookie Pattern   │
├──────────────────────────────────────┤
│  Rate Limiting (per user, per IP)    │
├──────────────────────────────────────┤
│  Input Validation (Pydantic)         │
├──────────────────────────────────────┤
│  SQL Injection (ORM prevents)        │
├──────────────────────────────────────┤
│  XSS (CSP headers, output encoding)  │
├──────────────────────────────────────┤
│  Audit Logs (immutable, signed)      │
└──────────────────────────────────────┘
```

## Scalability Strategy

- **Horizontal Scaling**: Stateless API servers behind load balancer
- **Database**: Read replicas, connection pooling (PgBouncer)
- **Caching**: Multi-tier (Redis for hot data, CDN for static)
- **Async Processing**: Background workers for ML inference, notifications
- **SDK**: Client-side buffering, batch upload, offline queue
