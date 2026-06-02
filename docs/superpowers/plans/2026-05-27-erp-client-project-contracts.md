# ERP Client Project Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or equivalent swarm workers with disjoint file ownership. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make client ownership mandatory for projects, reserve a future Contracts entity, align backend/frontend DTOs, and add a safe operational reset that preserves users, roles, and company settings.

**Architecture:** Prisma remains the source of truth. Backend routes validate and normalize all business links, while frontend screens expose the same workflow: client first, then project, proposal, finance. Contracts are intentionally schema-only for now.

**Tech Stack:** TypeScript, Fastify, Prisma, SQLite, React, Vite, TanStack Query, Tailwind CSS.

---

### Task 1: Backend Schema and API Contract

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/routes/projects.ts`
- Modify: `backend/src/routes/clients.ts`
- Modify: `backend/src/routes/leads.ts`
- Modify: `backend/src/routes/proposals.ts`
- Modify: `backend/src/routes/finance.ts`
- Modify: `backend/src/index.ts`

- [ ] Add schema fields used by the UI: client document, lead value, proposal validity/client name, required project client, and empty Contract model.
- [ ] Update project create/update/read paths so client is required and returned.
- [ ] Update lead/proposal status flows so backend owns financial side effects.
- [ ] Update finance create so project-linked transactions inherit or validate the project client.
- [ ] Add foreign-key conflict handling for client deletes.

### Task 2: Safe Operational Reset

**Files:**
- Create: `backend/src/scripts/resetOperationalData.ts`
- Modify: `backend/package.json`

- [ ] Add a Prisma script that deletes operational data in dependency order.
- [ ] Preserve `User`, `Role`, and `Settings`.
- [ ] Add npm script `db:reset:operational`.

### Task 3: Frontend Client and Project Flow

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/pages/Projects.tsx`
- Modify: `frontend/src/pages/ProjectManager.tsx`
- Modify: `frontend/src/pages/Clients.tsx`

- [ ] Add DTOs for client/project/proposal/lead payloads.
- [ ] Make `clientId` a required field in project creation.
- [ ] Add client display, filters, and client-first creation flow.
- [ ] Add direct client-to-project action from Clients.
- [ ] Show project client context in Project Manager.

### Task 4: Frontend CRM and Proposals Flow

**Files:**
- Modify: `frontend/src/pages/CRM.tsx`
- Modify: `frontend/src/pages/Proposals.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] Align CRM lead conversion with backend `contractValue`.
- [ ] Remove frontend duplicate finance creation on accepted proposals.
- [ ] Make proposal acceptance choose a project where needed.
- [ ] Expose Proposals in navigation.

### Task 5: Verification

- [ ] Run `./node_modules/.bin/prisma validate` in `backend`.
- [ ] Run `./node_modules/.bin/tsc --noEmit` or `npm run build` in `backend`.
- [ ] Install frontend dependencies if needed, then run `npm run build` in `frontend`.
- [ ] Run Docker build/restart only after local validation.
- [ ] Run the operational reset only after backup and only against the intended Docker volume/database.
