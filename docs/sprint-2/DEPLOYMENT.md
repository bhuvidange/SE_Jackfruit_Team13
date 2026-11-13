# Deployment and operations

## Live services

| Service | Provider | URL / details |
|---|---|---|
| Frontend | Vercel | [https://se-jackfruit-team13.vercel.app](https://se-jackfruit-team13.vercel.app) |
| Backend API | Railway | [https://sejackfruitteam13-production.up.railway.app](https://sejackfruitteam13-production.up.railway.app) |
| Health check | Railway | [`/api/health`](https://sejackfruitteam13-production.up.railway.app/api/health) |
| Database | MongoDB Atlas | Managed cluster; no public application URL |

Railway's HTTP URL redirects to HTTPS. Use HTTPS for API calls. The Vercel client is configured with `VITE_API_URL=https://sejackfruitteam13-production.up.railway.app/api`. A live check on 13 November 2026 confirmed the health endpoint returns `{"status":"ok"}` and the API CORS preflight permits the exact production origin `https://se-jackfruit-team13.vercel.app`.

## Hosting layout and configuration

- **Frontend:** Vercel deploys the Vite app from the `client/` project root. `client/vercel.json` sets the static output directory, SPA fallback and response security headers. Vercel provides HTTPS.
- **Backend:** Railway runs the Express API from `server/`, connected to the GitHub repository's `main` branch. Railway provides public HTTPS and redirects plain HTTP to HTTPS. The root `render.yaml` is a Render-specific blueprint and does **not** configure the active Railway service.
- **Database:** MongoDB Atlas hosts the application database. The connection URI belongs in the Railway backend service's `MONGODB_URI` variable, not in Git.
- **Secrets and origins:** Railway must have `JWT_SECRET`, `MONGODB_URI` and `CORS_ORIGIN=https://se-jackfruit-team13.vercel.app` configured. Do not commit secret values. `JWT_SECRET` should remain stable; rotating it signs out active users.
- **Client URL:** `VITE_API_URL` is read during the Vercel build, so changing it requires a new frontend deployment.

## Automatic deployment

1. GitHub Actions CI runs for pushes to every branch and pull requests targeting `main`. It tests the client and server, collects coverage, uploads coverage artifacts and builds the client.
2. Railway and Vercel should both be connected to the repository with `main` selected as their production branch and automatic deployment enabled. Merging a reviewed change to `main` then triggers each provider's deployment.
3. Railway's **Wait for CI** option is optional. If enabled, check its behaviour against the workflow: the workflow runs on all branch pushes and PRs to `main`, not only `main` pushes.
4. After deployment, check the Vercel site, the Railway health endpoint, sign-in, and browser network/console for API or CORS errors.

Railway autodeploy prerequisites and the optional Wait for CI setting are documented in [Railway's GitHub autodeploy guide](https://docs.railway.com/deployments/github-autodeploys).

## Demo data / seed procedure

The backend seed command is destructive. It **deletes existing users, questions, materials, quizzes and quiz attempts** in the database configured by `MONGODB_URI`, then inserts the demo accounts and sample content. Run it only when deliberately refreshing a disposable demo database; never run it against data that must be retained.

When you have Node.js/npm locally and the Railway CLI installed, `railway run` executes the checked-out local script with variables fetched from the linked Railway environment. From the repository:

```bash
cd server
npm ci
railway login
railway link
railway run --service <backend-service-name> npm run seed
```

Select the correct Railway project and **production** environment when linking, then verify `MONGODB_URI` points at the intended Atlas demo database. The command runs the local checkout, not code inside the deployed container; use code matching the deployment. Railway SSH is an interactive shell into the deployed container and may not include `npm` or `node`, so don't assume those commands are available there. Do not change the production start command just to run the seed.

Seeded accounts all use `Demo@1234`. These are public demo credentials and must not be used for sensitive data.

## Rollback and recovery

- **Railway backend:** in the service's **Deployments** tab, open the menu on the last known-good successful deployment and select **Rollback**. Railway activates the prior deployment's code and custom variables, subject to the plan's image-retention window. Verify the health endpoint and sign-in afterwards; recheck `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN` and other variables because rollback restores prior variable values too.
- **Vercel frontend:** open **Deployments**, select the last known-good Production deployment, and promote it to Production (or redeploy it). Verify the frontend still reaches the API.
- **Git code correction:** for a lasting fix, revert the bad merged change through a reviewed PR to `main`; the providers will deploy the revert. Avoid force-pushing shared branches.
- **Atlas data:** do not switch production to a local/test database as a rollback. Restore Atlas data only from an available backup/export; writes since that backup may be lost.

Railway's current deployment actions are documented at [Railway Deployment Actions](https://docs.railway.com/deployments/deployment-actions).

## Demo deployment limitations and security notes

- **Temporary uploads:** the app saves files under `server/uploads/` on the backend's local filesystem. No Railway volume is configured for this service. Treat uploaded files as temporary and keep local copies; they can be lost if the deployment is replaced, moved or rebuilt. Don't store irreplaceable files there.
- **Atlas network access:** for this demo the Atlas IP access list currently contains `0.0.0.0/0`, allowing connection attempts from any IPv4 address. This was used because Railway's free tier doesn't provide a stable outbound IP. Database authentication is still required, but this is a broad network rule: use a strong unique database password, restrict database-user permissions, and remove the open rule when the demo no longer requires it or a narrower option is available. Railway static outbound IPs require a paid plan and are not configured here.
- **Free-tier availability:** Railway may sleep or restart an idle service, so the first request may be delayed. Atlas Free has provider limits and can pause after long inactivity. These services are used for a student demo, not production workloads; review current provider quotas before relying on them.
- **Login lockout:** failed-login tracking is stored in process memory, so a backend restart resets the counter. Keep a single backend instance; a scaled deployment should use shared storage for lockout state.
- **Data seeding:** the seed command clears application collections. Confirm the Railway environment and Atlas database before running it, and retain exports of any data that matters.
