# Repository Guidelines

## Project Structure & Module Organization

DevFast Manager is split into `backend/` and `frontend/`. The backend is a Fastify + TypeScript API: route modules live in `backend/src/routes/`, business logic in `backend/src/services/`, Prisma setup in `backend/src/db.ts`, declarations in `backend/src/types/`, and the data model in `backend/prisma/schema.prisma`. The frontend is a React + Vite app: pages are in `frontend/src/pages/`, shared UI in `frontend/src/components/`, hooks in `frontend/src/hooks/`, API access in `frontend/src/api/client.ts`, utilities in `frontend/src/utils/`, and assets in `frontend/public/` or `frontend/src/assets/`. Deployment files are at the root and in `scripts/`.

## Build, Test, and Development Commands

- `cd backend && npm run dev`: run Fastify with hot reload on port `3001` by default.
- `cd backend && npm run build`: compile backend TypeScript to `dist/`.
- `cd backend && npm run db:generate` / `npm run db:push`: update Prisma client and sync the local database.
- `cd frontend && npm run dev`: run Vite on port `5173`.
- `cd frontend && npm run build`: type-check and build the production frontend.
- `cd frontend && npm run lint`: run ESLint for TypeScript/React files.
- `docker compose up -d --build`: build and run the production-style stack.

## Coding Style & Naming Conventions

Use TypeScript and ES modules throughout. Keep 2-space indentation, semicolons, and the quote style already used in the file being edited. Name React components/pages in `PascalCase`, hooks as `useSomething`, and backend route files by domain, such as `projects.ts` or `finance.ts`. Backend local imports should follow the compiled ESM pattern, for example `./routes/projects.js`.

## Testing Guidelines

No dedicated test runner is configured yet. Before handing off changes, run backend `npm run build` and frontend `npm run build && npm run lint`. If adding tests, place them near the relevant module as `*.test.ts` or `*.test.tsx`, and add the matching `npm test` script.

## Commit & Pull Request Guidelines

Git history is sparse and mixed, with messages like `feat: add production Docker deployment` and `Update README.md`. Prefer short imperative messages; use `feat:`, `fix:`, or `docs:` when useful. PRs should describe scope, list verification commands, call out database or environment changes, link issues when available, and include screenshots for UI updates.

## Security & Configuration Tips

Do not commit real `.env` files, SQLite databases, logs, or generated `dist/` output. Start from `.env.example`, `backend/.env.example`, and `frontend/.env.example`. Production requires a strong `JWT_SECRET` and valid SMTP settings for OTP registration.
