# TaskFlow

A small task board app, purpose-built as the "app under test" for a full CI/CD + GitOps DevOps portfolio project.

**Stack:** React (frontend) → Node/Express (backend API) → PostgreSQL (data) → Redis (cache-aside caching on `GET /api/tasks`).

## Why this app

- Small enough to fully understand and explain in an interview.
- Has all 4 tiers your pipeline needs to prove out: frontend, backend, database, cache.
- Has real health/readiness endpoints (`/healthz`, `/readyz`) for Kubernetes probes.
- Redis caching is visible in the UI — the header badge shows whether the task list was served from cache or DB, so you can literally demo cache invalidation working.
- Clean Dockerfiles (multi-stage, non-root user) that give Trivy and OWASP something real to scan.

## Run locally

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api/tasks
- Postgres: localhost:5432 (user/pass: taskflow/taskflow)
- Redis: localhost:6379

## Project layout

```
taskflow/
├── backend/          # Express API (Node 20)
│   ├── src/
│   │   ├── routes/tasks.js
│   │   ├── db.js
│   │   ├── redisClient.js
│   │   ├── server.js
│   │   └── __tests__/
│   └── Dockerfile
├── frontend/         # React + Vite, served via nginx in prod
│   ├── src/
│   └── Dockerfile
├── k8s/              # Plain k8s manifests (also your ArgoCD source, ideally in a separate GitOps repo)
│   ├── 00-namespace.yaml
│   ├── 10-postgres.yaml
│   ├── 20-redis.yaml
│   ├── 30-backend.yaml
│   └── 40-frontend.yaml
├── docker-compose.yml
└── Jenkinsfile       # checkout → test → sonarqube → owasp → build → trivy → dockerhub → update gitops repo
```

## Where this fits in the bigger pipeline

```
git push (this repo)
   → Jenkins webhook trigger
   → npm test → SonarQube scan + quality gate
   → OWASP Dependency-Check
   → docker build (backend + frontend)
   → Trivy image scan
   → push images to Docker Hub
   → update image tags in taskflow-gitops repo
   → ArgoCD auto-syncs taskflow-gitops → EKS
   → Prometheus scrapes /healthz-adjacent metrics, Grafana dashboards
```

## Next steps for your portfolio project

1. Push this repo to GitHub as-is (`taskflow`).
2. Create a **second, separate** repo `taskflow-gitops` containing just the `k8s/` folder — ArgoCD should watch that repo, not this one. Keeping app code and deploy manifests separate is the actual point of GitOps.
3. Replace `<YOUR_DOCKERHUB_USERNAME>` in `k8s/30-backend.yaml`, `k8s/40-frontend.yaml`, and `Jenkinsfile`.
4. Wire up Jenkins credentials: `dockerhub-creds` (username/password) and `github-creds` (for pushing to the GitOps repo).
5. Point Terraform-provisioned EKS + ArgoCD at the `taskflow-gitops` repo.
6. Install `kube-prometheus-stack` via Helm into the cluster and add a Grafana dashboard for the `backend`/`frontend` deployments.

## Notes on the caching behavior (useful for demos/interviews)

- `GET /api/tasks` checks Redis first (`taskflow:tasks:all`, 30s TTL). Cache miss → query Postgres → populate cache.
- Any `POST`/`PATCH`/`DELETE` invalidates the cache key immediately (`redisClient.del`), so writes are always consistent on the next read — a simple, explainable cache-aside + invalidation pattern.
