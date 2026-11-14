# CSMQP — Collaborative Study Material & Quiz Platform

![CI](https://github.com/bhuvidange/SE_Jackfruit_Team13/actions/workflows/ci.yml/badge.svg?branch=main)

CSMQP is a web platform where students find study materials, take quizzes and review their progress. Instructors share materials, manage questions, publish quizzes and review class performance. Administrators manage accounts and review reports about content.

## Live demo

| Part | Link |
| --- | --- |
| Student and instructor app | [https://se-jackfruit-team13.vercel.app](https://se-jackfruit-team13.vercel.app) |
| Admin and sign-in page | [Open the app sign-in page](https://se-jackfruit-team13.vercel.app/login) |
| Backend health check | [https://sejackfruitteam13-production.up.railway.app/api/health](https://sejackfruitteam13-production.up.railway.app/api/health) |

The backend's HTTP URL redirects to HTTPS. The Vercel app calls the API at `https://sejackfruitteam13-production.up.railway.app/api`. The Railway health check currently returns `{"status":"ok"}`, and the live API's CORS preflight allows the exact Vercel production origin.

This is a student demo deployment. Railway's free service can sleep while idle and stores uploaded study files on temporary disk; files can disappear after a restart, sleep or redeployment. Keep local copies of files used in the demo.

## Features

- Sign up as a student or instructor and sign in with an account.
- Upload, search and download study materials (PDF, DOCX, PPTX or JPG; up to 15 MB).
- Add, organize and manage multiple-choice and true/false questions.
- Create and publish timed quizzes; students can take quizzes and see automatic scores and answer feedback.
- Students can view personal progress and weaker topics; instructors can review class results.
- Administrators can find, block, restore or delete accounts and review reports about materials or questions.

## Try the demo

1. Open the [app sign-in page](https://se-jackfruit-team13.vercel.app/login).
2. The live demo has been seeded with sample accounts, questions, material and a quiz. The sample accounts all use password **`Demo@1234`**:

   | Role | Email |
   | --- | --- |
   | Administrator | `admin@csmqp.test` |
   | Instructor | `ira@csmqp.test`, `ivan@csmqp.test` |
   | Student | `sam@csmqp.test`, `sara@csmqp.test`, `sid@csmqp.test` |

3. Instructors can add questions, upload study materials and create or publish quizzes. Students can search and download materials, take published quizzes and check their results. Administrators can manage users and moderate reports.

These are public demo credentials. Do not use them for personal or sensitive information.

## Run locally

Requirements: Node.js 20 or newer (22 recommended), npm and MongoDB 6+ (local or Atlas).

```bash
# Terminal 1: backend
cd server
npm ci
cp .env.example .env
# Set JWT_SECRET and MONGODB_URI in server/.env; never commit real secrets.
npm start

# Terminal 2: frontend
cd client
npm ci
npm run dev
```

The frontend runs at `http://localhost:5173`; in development, Vite proxies `/api` requests to the backend at `http://localhost:5000`.

### Demo seed data

To load the sample accounts, questions, material and quiz into your **configured local database**, run this once from the `server/` directory:

```bash
npm run seed
```

**Warning:** the seed script clears existing users, questions, materials, quizzes and quiz attempts in the database configured by `MONGODB_URI`, then inserts demo data. Never run it against a database whose data you need to keep. Seeded accounts share the public password `Demo@1234`.

## Tests and CI

```bash
cd server && npm test
cd client && npm test
cd client && npm run build
```

GitHub Actions runs on every branch push and every pull request to `main`. It runs server and client tests with coverage, builds the client and uploads `server-coverage` and `client-coverage` artifacts. Coverage artifacts can be downloaded from the workflow run.

## Deployment overview

- **Frontend:** Vercel, project root `client`, production branch `main`.
- **Backend:** Railway, connected to the repository's `main` branch; HTTP requests redirect to HTTPS. Railway service variables include `MONGODB_URI`, `JWT_SECRET` and `CORS_ORIGIN`.
- **Database:** MongoDB Atlas. `MONGODB_URI` is stored as a Railway service variable, not in the repository.
- **Browser access:** `CORS_ORIGIN` is set to the exact frontend origin `https://se-jackfruit-team13.vercel.app`.
- **Automatic deploys:** after merging a reviewed change to `main`, the connected hosting services deploy the new commit. Railway's **Wait for CI** setting is optional; if enabled, verify its behaviour against this workflow, which runs on every branch push and pull requests to `main`.
- **Health check:** `https://sejackfruitteam13-production.up.railway.app/api/health` should return `{"status":"ok"}`.
- **Rollback:** in Railway, open the backend service's Deployments tab, use the previous successful deployment's menu and choose **Rollback**. Railway restores that deployment's code and custom variables, subject to retention; recheck secrets and URLs after rollback. In Vercel, promote the last known-good production deployment. See [deployment instructions](docs/sprint-2/DEPLOYMENT.md).

The demo currently allows the API to connect to Atlas using an open Atlas IP access entry (`0.0.0.0/0`) because Railway's free tier does not provide a stable outbound IP address. This is less restrictive than allowlisting specific IPs. Use a strong database password and remove the open entry when the demo no longer requires it or when a narrower, workable network setup is available.

## Project documentation

- [User stories and acceptance checks](docs/requirements/CSMQP_User_Stories.pdf)
- [Software Requirements Specification](docs/requirements/TEAM13_CSMQP_SRS.pdf)
- [Architecture and Design Specification (Word source)](docs/design/TEAM13_CSMQP_Software_Architecture_and_Design_Specification.docx)
- [Software Test Plan (Word source)](docs/testing/TEAM13_CSMQP_Software_Test_Plan.docx)
- [Test report](docs/testing/TEST_REPORT.md)
- [Performance test report](docs/testing/PERFORMANCE.md)
- [Requirements traceability matrix](docs/testing/TRACEABILITY_MATRIX.md)
- [Project deviations](docs/project/DEVIATIONS.md)
- [Sprint 1 deviations](docs/sprint-1/DEVIATIONS.md)
- [Deployment details and limitations](docs/sprint-2/DEPLOYMENT.md)
- [Project demo video](demo/CSMQP_Demo.mp4)

## Scope notes

The initial release is a standalone web app; integration with an external university learning system and payment processing are not included. Load testing showed that the stated response-time and 500-user targets were not met at heavier loads; see the [performance report](docs/testing/PERFORMANCE.md).
