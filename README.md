# Light & Safe Port Scanner

A minimal, safety-first TCP connectivity checker with a React + Vite frontend and a Node.js backend. The scanner only performs TCP connect() checks on a short list of common service ports, blocks private/local targets, and rate-limits requests.

## Safety & Usage Disclaimer
- This is **not** a penetration-testing tool. It performs only basic TCP connect checks.
- Only a curated list of common ports (<=20) is allowed. The backend rejects other ports and more than 20 ports per request.
- Scans against private, loopback, link-local, multicast, or broadcast addresses are blocked.
- Only one target can be scanned at a time, with a minimum 1-second timeout per port and a 10-second rate limit per client.
- No UDP, SYN/stealth scans, banner grabbing, or aggressive behavior is implemented.

## Project Structure
- `backend/`: Node.js HTTP server that validates inputs, enforces safety rules, and runs TCP connect checks.
- `frontend/`: React + TypeScript + Vite UI styled with TailwindCSS.
- `docker-compose.yml`: Local orchestration for frontend and backend.

## Local Development
1. **Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   The API listens on `http://localhost:3001` with a `POST /scan` endpoint accepting `{ target, ports }`.

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   By default, the UI expects the API at `http://localhost:3001`. Adjust `VITE_API_URL` if needed.

## Docker
- Build and run with docker-compose:
  ```bash
  docker-compose up --build
  ```
  Frontend: `http://localhost:5173` (served from Nginx)
  Backend: `http://localhost:3001`

## Cloud Run Deployment (example)
1. Build images:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/portscanner-backend ./backend
   gcloud builds submit --tag gcr.io/PROJECT_ID/portscanner-frontend ./frontend
   ```
2. Deploy:
   ```bash
   gcloud run deploy portscanner-backend --image gcr.io/PROJECT_ID/portscanner-backend --platform managed --allow-unauthenticated --port 3001
   gcloud run deploy portscanner-frontend --image gcr.io/PROJECT_ID/portscanner-frontend --platform managed --allow-unauthenticated --set-env-vars VITE_API_URL=https://<backend-url>
   ```

## Testing
- Backend unit tests (validation and TCP checks):
  ```bash
  cd backend
  npm test
  ```
- The frontend currently relies on manual QA; add Vitest tests as needed.

## API Contract
- `POST /scan`
  - Body: `{ "target": "example.com", "ports": [80, 443] }`
  - Response: target info, resolved public IP, per-port status (`open`, `closed`, `filtered`), latency when available, ISO timestamp.

## Security Restrictions (enforced in backend)
- Rejects private/loopback/link-local/broadcast targets.
- Only allows predefined ports; max 20 ports per request.
- Only TCP connect() checks; minimum 1s timeout per port.
- Rate limit: one scan every 10 seconds per client IP.
