# SP-RPA application

React + Tailwind frontend, Node/Express backend, PostgreSQL, Firebase Auth (email/password + Google).

```
frontend (nginx :80)  --/api-->  backend (Express :4000)  -->  PostgreSQL
        |                              |
   Firebase Auth  <-- verifyIdToken ---+   (service account mounted at /secrets/firebase.json)
```

## Setup

Copy `.env.example` to `.env`, fill in your Firebase web config, and point `FIREBASE_SA_FILE` at your service-account JSON. Neither file is committed.

## Run with Docker

```powershell
docker compose up -d --build     # http://localhost:8080
docker compose down              # add -v to wipe the database
```

Set `MARKET_MODE=synthetic` to force labelled demo prices (default tries Yahoo Finance, falls back to synthetic).

## Run on Kubernetes

Enable *Settings → Kubernetes* in Docker Desktop (or use kind/minikube), then:

```powershell
./k8s/deploy.ps1                 # builds images, creates secrets, applies k8s/app.yaml
kubectl -n sprpa get pods,hpa
# http://localhost:30080   (or: kubectl -n sprpa port-forward svc/frontend 8081:80)
```

The service-account JSON never enters an image: Compose bind-mounts it, Kubernetes stores it in the `firebase-sa` Secret.

## Firebase console checklist

Authentication → Sign-in method: enable **Email/Password** and **Google**. Authentication → Settings → Authorized domains must include `localhost`.

## Local dev (no Docker for the app)

```powershell
cd backend;  npm i; $env:GOOGLE_APPLICATION_CREDENTIALS="..\firebase-service-account.json"; npm run dev   # needs Postgres on :5432
cd frontend; npm i; npm run dev   # http://localhost:5173, proxies /api to :4000
cd backend;  npm test
```
