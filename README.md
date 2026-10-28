# CSMQP - Collaborative Study Material & Quiz Platform

MERN application built from the team's SRS, Software Architecture & Design Specification and Software Test Plan
(SE_Jackfruit_Team13). This repository contains **Sprint 1**:

| Area | Requirements |
| --- | --- |
| Authentication & roles | CSMQP-F-001..003, CSMQP-SR-001..003 (+ SR-004 sanitising) |
| Question bank | CSMQP-F-020..023 |
| Study materials | CSMQP-F-010..013 |
| Quizzes | CSMQP-F-030..035 (create from bank, time limit, publish, attempt, auto-score, per-question result) |

Analytics (F-040..042) and admin screens (F-050..051) are Sprint 2. Differences from the design documents are listed in
[docs/sprint-1/DEVIATIONS.md](docs/sprint-1/DEVIATIONS.md).

```
server/   Express + Mongoose REST API (Jest, Supertest, mongodb-memory-server)
client/   React + Vite single page app (Vitest, React Testing Library)
docs/     Sprint documentation
.github/  CI workflow
```

## Prerequisites

* Node.js 20 or newer (22 recommended) and npm
* MongoDB 6+ running locally (or a MongoDB Atlas connection string) - **only needed to run the app**.
  The automated tests download and use a temporary in-memory MongoDB, so they need no installation.

## Setup

```powershell
# API
cd server
npm install
Copy-Item .env.example .env      # then edit JWT_SECRET (and MONGODB_URI if needed)

# Web client
cd ..\client
npm install
```

## Run

Start MongoDB, then in two terminals:

```powershell
# terminal 1 - API on http://localhost:5000
cd server
npm run seed     # optional demo data (see below); clears users/questions/materials/quizzes/attempts
npm start

# terminal 2 - web app on http://localhost:5173 (proxies /api to the API)
cd client
npm run dev
```

### Demo accounts (after `npm run seed`)

All demo accounts use the password **`Demo@1234`**.

| Role | Email |
| --- | --- |
| Administrator | admin@csmqp.test |
| Instructor | ira@csmqp.test, ivan@csmqp.test |
| Student | sam@csmqp.test, sara@csmqp.test, sid@csmqp.test |

The seed also creates 10 questions (MCQ and True/False), one sample PDF study material and one **published** quiz
("Data Structures & Algorithms - Quick Check", 10 minutes).

### Try the full flow

1. Register at `/register` (choose Student or Instructor) or log in with a demo account.
2. As an instructor: **Question Bank** -> add questions; **Study Materials** -> upload a PDF/DOCX/PPTX/JPG (max 15 MB);
   **Quizzes** -> *Create a quiz* (pick questions, set the time limit) -> *Publish*.
3. As a student: **Study Materials** -> search and download; **Quizzes** -> *Start*, answer within the countdown
   (it auto-submits at zero) -> the result page shows the score and which answers were right or wrong.

## Tests

```powershell
cd server ; npm test      # unit + integration (Jest, Supertest, in-memory MongoDB; first run downloads mongod)
cd client ; npm test      # unit + component tests (Vitest, React Testing Library)
cd client ; npm run build # production build
```

Tests are named after the Test Plan IDs (`TC-Auth-01` ... `TC-Sec-05`), e.g. `TC-Mat-02` covers the 15 MB boundary
(exactly 15 MB accepted, 15 MB + 1 byte rejected) and `TC-Sec-02` covers expired and tampered JWTs.
GitHub Actions (`.github/workflows/ci.yml`) installs, tests both apps and builds the client on every push and pull
request to `main`.

## API summary

| Method & path | Who | Purpose |
| --- | --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | public / any | Register, log in (JWT), current user |
| `GET/POST /api/questions`, `GET/PUT/DELETE /api/questions/:id` | instructor (admin read) | Question bank, filters `subject`, `topic`, `difficulty`, `type`, `q` |
| `GET /api/materials?query=`, `GET /api/materials/:id`, `GET /api/materials/:id/download` | any user | Search, view, download |
| `POST /api/materials` (multipart: `file`, `title`, `subject`, `topic`, `description`) | instructor | Upload |
| `POST /api/quizzes`, `GET /api/quizzes`, `GET /api/quizzes/:id`, `POST /api/quizzes/:id/publish` | instructor (list also student) | Create, list, view, publish |
| `POST /api/quizzes/:id/start`, `POST /api/quizzes/:id/submit` | student | Begin timed attempt, submit and auto-grade |
| `GET /api/quizzes/attempts/:attemptId` | attempt owner / quiz instructor | Result with per-question correctness |

Errors are JSON: `{ "message": "...", "errors": [...] }`. Authenticated calls send `Authorization: Bearer <jwt>`.

## Configuration (`server/.env`)

See `server/.env.example`. `JWT_SECRET` is mandatory in production. Uploads are stored in `server/uploads/`
(git-ignored).
