# 🏗️ System Architecture — Schema Documenter
### WM-01 Design Evidence

---

## 1. System Overview

The Schema Documenter is a three-tier web application consisting of:

- **Presentation Tier** — Next.js 15 App Router (React, TypeScript, Tailwind CSS)
- **Application Tier** — Next.js API Routes + Server Components (Node.js runtime)
- **Data Tier** — Target PostgreSQL database (the one being documented)

---

## 2. Full System Architecture Flowchart

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                              │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  /login      │───▶│  /dashboard      │───▶│  ERD Visual Map  │  │
│  │  (public)    │    │  (protected)     │    │  (React Flow)    │  │
│  └──────────────┘    └──────────────────┘    └──────────────────┘  │
│         │                    │                        │             │
│         ▼                    ▼                        ▼             │
│  POST /api/auth/login  GET /api/schema          Export (PNG/SVG/PDF)│
└─────────────┬──────────────────┬──────────────────────┬────────────┘
              │ HTTPS            │ HTTPS                │
              ▼                  ▼                      │
┌─────────────────────────────────────────────────────────────────────┐
│                         NGINX (Port 443)                            │
│               Reverse Proxy + SSL Termination                       │
│                     (Let's Encrypt / Certbot)                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP (localhost:3000)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 15 APP ROUTER  (PM2 Cluster)               │
│                                                                     │
│  ┌──────────────────────┐   ┌───────────────────────────────────┐  │
│  │  src/middleware.ts   │   │  src/app/api/schema/route.ts      │  │
│  │  (Edge Runtime)      │   │  GET /api/schema                  │  │
│  │                      │   │                                   │  │
│  │  - Reads auth_token  │   │  → calls SchemaExtractorService   │  │
│  │    cookie            │   │  → returns JSON                   │  │
│  │  - Verifies JWT      │   └───────────────┬───────────────────┘  │
│  │  - Redirects to      │                   │                      │
│  │    /login if invalid │   ┌───────────────▼───────────────────┐  │
│  └──────────────────────┘   │  SchemaExtractorService.ts        │  │
│                             │  (WM-02 Core)                     │  │
│  ┌──────────────────────┐   │                                   │  │
│  │  /api/auth/login     │   │  - extractTables()     → SQL 1   │  │
│  │                      │   │  - extractColumns()    → SQL 2   │  │
│  │  - Validates creds   │   │  - extractForeignKeys() → SQL 3  │  │
│  │  - Signs JWT         │   │  - Multi-tenant flags  → SQL 4   │  │
│  │  - Sets HTTP-only    │   └───────────────┬───────────────────┘  │
│  │    cookie            │                   │                      │
│  └──────────────────────┘   ┌───────────────▼───────────────────┐  │
│                             │  src/lib/db/client.ts             │  │
│                             │  Singleton pg.Pool (max: 10)      │  │
│                             └───────────────┬───────────────────┘  │
└─────────────────────────────────────────────┼───────────────────────┘
                                              │ TCP:5432
                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   TARGET POSTGRESQL DATABASE                        │
│                                                                     │
│   information_schema.tables       pg_stat_user_tables              │
│   information_schema.columns      pg_class                         │
│   information_schema.key_column_usage                              │
│   information_schema.table_constraints                             │
│   information_schema.referential_constraints                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. CI/CD Pipeline Architecture

```
Developer Laptop
      │
      │  git push origin main
      ▼
┌─────────────────────────────────────────────────────┐
│              GITHUB ACTIONS RUNNER                  │
│                 (ubuntu-latest)                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  JOB 1: test                                 │  │
│  │  - Spins up postgres:16 service container    │  │
│  │  - npm ci                                    │  │
│  │  - npm test (Jest against test DB)           │  │
│  │  - Fails pipeline if any test fails          │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │ only if tests pass            │
│  ┌──────────────────▼───────────────────────────┐  │
│  │  JOB 2: deploy                               │  │
│  │  - SSH into VPS using GitHub Secret key      │  │
│  │  - git pull origin main                      │  │
│  │  - npm ci --omit=dev                         │  │
│  │  - npm run build                             │  │
│  │  - pm2 reload (zero-downtime)                │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │ SSH (port 22)
                         ▼
              ┌─────────────────────┐
              │   UBUNTU VPS        │
              │   /var/www/         │
              │   schema-documenter │
              └─────────────────────┘
```

---

## 4. Request Lifecycle (Happy Path)

```
1. User visits https://yourdomain.com/dashboard
2. Nginx receives request, terminates SSL, forwards to localhost:3000
3. Next.js middleware (Edge) intercepts the request
4. Middleware reads the `auth_token` HTTP-only cookie
5. Middleware verifies the JWT signature using JWT_SECRET
6. If valid → request passes through to the Server Component
7. Server Component calls schemaExtractor.extractFullSchema()
8. SchemaExtractorService runs 3 parallel SQL queries via pg.Pool
9. Results are mapped to typed TypeScript objects
10. Server Component renders ERDCanvas with the schema data
11. React Flow renders interactive nodes and edges in the browser
12. User can pan, zoom, and export the diagram as PNG/SVG/PDF
```

---

## 5. Security Architecture

| Layer | Control | Implementation |
|---|---|---|
| Transport | TLS 1.2/1.3 | Certbot + Nginx |
| Authentication | JWT (HS256, 8h expiry) | `jose` library, HTTP-only cookie |
| Route Protection | Edge Middleware | `src/middleware.ts` |
| Secrets | Never in code | GitHub Secrets + `.env.local` |
| Firewall | Port whitelist | UFW: allow 80, 443, 22 |
| Headers | Security headers | X-Frame-Options, X-Content-Type-Options |

---

## 6. Technology Justification

| Decision | Alternative Considered | Reason Chosen |
|---|---|---|
| Next.js App Router | CRA, Vite, Express | Server Components remove need for separate API server |
| React Flow | Mermaid.js, D3 | Interactive drag/zoom, built for node-edge graphs |
| `jose` JWT | `jsonwebtoken` | Edge Runtime compatible (no Node.js crypto) |
| PM2 Cluster | Docker, raw Node | Lightweight, zero-downtime reloads, built-in monitoring |
| `information_schema` | Direct `pg_catalog` | ANSI SQL standard — portable across PostgreSQL versions |
