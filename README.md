<p align="center">
  <img src="docs/logo.svg" alt="AI Agent Tool Logo" width="140" height="140" />
</p>

<h1 align="center">AI Agent Tool</h1>

<p align="center">
  A full-stack multi-provider AI chat workspace and secure API proxy built with <strong>React 19</strong>, <strong>TypeScript</strong>, <strong>Spring Boot 3.5</strong>, and <strong>PostgreSQL</strong>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Java-25-orange?logo=openjdk" alt="Java 25" />
  <img src="https://img.shields.io/badge/Spring%20Boot-3.5.16-6DB33F?logo=springboot&logoColor=white" alt="Spring Boot 3.5.16" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 17" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.8" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
</p>

---

## Overview

**AI Agent Tool** provides a ChatGPT-style web interface backed by an enterprise-ready Spring Boot proxy gateway. Administrators centrally manage encrypted **OpenAI (ChatGPT)** and **Anthropic (Claude)** API tokens in PostgreSQL, while workspace users chat with models through JWT-authenticated endpoints without ever having access to raw provider keys.

---

## Key Features

### Chat Workspace (`ui/`)
- **ChatGPT-style Interface**: Collapsible left sidebar with grouped chat history, search, inline rename/delete, and user profile avatar.
- **Per-Chat Model Lock & Provider Icons**: Choose between OpenAI (`gpt-6.2-sol`, `gpt-5-nano`) and Anthropic (`claude-opus-5-5`, `claude-3-5-haiku`) when starting a new chat; the selected model is locked for that conversation and paired with a ChatGPT or Claude icon.
- **Rich Streaming Responses**: Real-time Server-Sent Events (SSE) streaming with stop-generation, regenerate response, and GitHub-Flavored Markdown code rendering.
- **Dual Adapter Mode**: Works out of the box in **Simulated Mode** for offline/UI testing, or connects to the Spring Boot **API Mode** backend.
- **Bilingual Localization (EN / RU)**: Instant switching between **English** and **Russian** (`Русский`) across the Chat Workspace, Auth screen, Settings modal, and Admin Console, persisted in `localStorage`.

### Authentication & User Management
- **Login & Registration (`AuthScreen`)**: JWT-secured sign-in and account registration, plus personal profile & password updates via `SettingsModal`.
- **Role-Based Access Control (RBAC)**: Strict `ADMIN` / `MEMBER` / `VIEWER` role enforcement; suspended accounts are blocked from logging in or sending messages.

### Secure AI Proxy & Storage (`src/`)
- **Server-Side Token Injection**: All user messages go through `/api/chat`, where Spring Boot injects the appropriate provider credential on the server. Users can never read or retrieve provider API keys.
- **AES-256-GCM Encryption**: Provider API keys are encrypted before storage in PostgreSQL (`provider_tokens` table) with Flyway-managed schema migrations.
- **Real OpenAI & Anthropic Integration**: Proxies both streaming SSE (`text/event-stream`) and synchronous JSON completions, persisting chat sessions, messages, and per-model token usage records.

### Admin Console
- **User Statistics Tab**:
  - Workspace KPI cards (total/active/suspended users, prompt/completion tokens, **estimated USD spend**, conversations including user-deleted count, quota utilization).
  - Create users, set or reset passwords for any user account, suspend/activate accounts, delete users, and inspect or permanently delete user chat histories.
  - **Soft-Deleted Chat Visibility & Backups**: User-deleted chats are marked `deleted = true` in PostgreSQL (hidden from the user's chat list) and surfaced in the Admin Console with a deleted-chat icon badge; administrators can download JSON backups for any individual chat, all chats of a user, or the entire workspace.
- **API Tokens Tab**:
  - Configure, rotate (with masked preview), or remove OpenAI and Anthropic API keys and custom base URLs.
- **Cost Estimation & OpenAI Billing Check**:
  - Calculates approximate USD consumption per model, per user, and globally based on logged input/output tokens.
  - Includes an optional **OpenAI Organization Spend (30d)** lookup (`/api/admin/billing/openai-costs` → OpenAI `/v1/organization/costs` using an `sk-admin-...` key) and notes that OpenAI does not expose remaining prepaid credit balance via API.

---

## Architecture

```text
┌──────────────────────────┐        HTTP / SSE (JWT)       ┌──────────────────────────┐
│   React + Vite UI (:5173)│ ────────────────────────────▶ │ Nginx API Gateway (:8080)│
│  (Runs separately on     │ ◀──────────────────────────── │  • Docker DNS Round-Robin│
│   host / static host)    │   /api/users, /api/chats,     │  • Unbuffered SSE Proxy  │
└──────────────────────────┘   /api/chat, /api/admin       └────────────┬─────────────┘
                                                                        │
                                              ┌─────────────────────────┴─────────────────────────┐
                                              ▼                                                   ▼
                            ┌───────────────────────────────────┐               ┌───────────────────────────────────┐
                            │ Spring Boot API Replica 1 (:8080) │      ...      │ Spring Boot API Replica N (:8080) │
                            └─────────────────┬─────────────────┘               └─────────────────┬─────────────────┘
                                              └─────────────────────────┬─────────────────────────┘
                                                                        │
                                                     JPA / Flyway       ▼            HTTPS (Injected API Key)
                                                            ┌────────────────┐  ┌───────────────────────────┐
                                                            │ PostgreSQL 17  │  │ OpenAI API / Anthropic API│
                                                            └────────────────┘  └───────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Java 25, Spring Boot 3.5.16 (Web, Data JPA, Security, Validation), Flyway, Maven |
| **Gateway & Scaling** | Docker Compose, Nginx (`1.27-alpine` with dynamic Docker DNS & unbuffered SSE) |
| **Database** | PostgreSQL 17 (Docker Compose), H2 (integration tests) |
| **Frontend** | React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, `react-markdown`, `remark-gfm`, `lucide-react` |
| **Testing** | JUnit 5, Spring Boot Test, Vitest, React Testing Library |

---

## Quick Start

### Option A: Scalable Containerized Backend + Separate UI (Recommended)
Run **PostgreSQL + N Spring Boot REST replicas + Nginx gateway** in Docker (no UI container), and run the React UI separately on your host:

```bash
# 1. Start PostgreSQL, 2 REST API instances, and the Nginx gateway on http://localhost:8080
docker compose up -d --build --scale api=2

# Scale up or down dynamically at any time (no UI restart required)
docker compose up -d --scale api=4
```

```bash
# 2a. Production UI (Node server — recommended on host)
cd ui
npm ci
npm run start:prod
```
Open **`http://localhost:3000`** in your browser. `npm run start:prod` builds minified production assets (`dist/`) and runs [`ui/server.mjs`](ui/server.mjs) with gzip compression, immutable asset caching, SPA fallback, and an unbuffered `/api/*` proxy to `API_BASE_URL` (default `http://localhost:8080`).

```bash
# 2b. Production UI (Standalone Nginx container, separate from backend compose)
cd ui
docker compose up -d --build
```
Serves the production build via Nginx on **`http://localhost:3000`** (override port with `UI_PORT` and backend target with `API_UPSTREAM`).

```bash
# 2c. Development UI (Vite HMR dev server — for local development only)
cd ui
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser. Vite runs in development mode with hot-module reload and proxies `/api/*` to `http://localhost:8080` (`VITE_API_PROXY_TARGET`).

### Option B: Run Backend Locally via Maven (PostgreSQL in Docker)
```bash
# Start only PostgreSQL
docker compose up -d postgres

# Run Spring Boot locally
mvn spring-boot:run
```

### Default Admin Credentials
When `APP_SEED_ENABLED=true` (enabled by default), the backend seeds an initial administrator account on startup:

- **Email**: `admin@ai-agent-tool.dev`
- **Password**: `admin123`

> **Security Note:** Change the seeded admin password, `APP_JWT_SECRET`, and `APP_TOKEN_ENCRYPTION_KEY` before deploying outside local development.

Next, sign in as Admin, open the **Admin Console → API Tokens** tab, and save your OpenAI and/or Anthropic API keys so users can start chatting in API mode.

---

## Configuration

Backend and Docker settings in [`src/main/resources/application.yml`](src/main/resources/application.yml) and [`docker-compose.yml`](docker-compose.yml) can be overridden via environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `API_PORT` | `8080` | Host port exposed by the Nginx API gateway |
| `DB_URL` | `jdbc:postgresql://localhost:5432/ai_agent_tool` (`postgres:5432` in Docker) | PostgreSQL JDBC connection URL |
| `DB_USERNAME` | `ai_agent` | Database username |
| `DB_PASSWORD` | `ai_agent_password` | Database password |
| `DB_POOL_MAX_SIZE` | `10` | HikariCP max connections per `api` replica |
| `APP_SEED_ENABLED` | `true` | Seeds the default admin user if absent (concurrency-safe across replicas) |
| `APP_JWT_SECRET` | `dev-only-jwt-secret-...` | Shared HMAC signing key for stateless JWT tokens across replicas (min 32 bytes) |
| `APP_JWT_EXPIRATION_MS` | `86400000` (24h) | JWT access token expiration in milliseconds |
| `APP_TOKEN_ENCRYPTION_KEY` | `dev-only-aes-key-...` | Shared AES-256-GCM key used across replicas to encrypt provider API tokens |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed UI origins |

---

## Supported Models & Cost Estimation Rates

Approximate USD spend is calculated from logged prompt and completion tokens using the following list rates (per 1M tokens):

| Model ID | Provider | Input ($ / 1M) | Output ($ / 1M) |
| :--- | :--- | :---: | :---: |
| `gpt-6.2-sol` | OpenAI | $2.50 | $10.00 |
| `gpt-5-nano` | OpenAI | $0.05 | $0.40 |
| `claude-opus-5-5` | Anthropic | $15.00 | $75.00 |
| `claude-3-5-haiku` | Anthropic | $0.80 | $4.00 |

---

## API Overview

| Endpoint Group | Endpoints | Access |
| :--- | :--- | :--- |
| **Auth & Profile** | `POST /api/users/register`, `POST /api/users/login`, `GET /api/users/me`, `PUT /api/users/me` | Public (`register`/`login`) / Authenticated |
| **Chat & Proxy** | `GET /api/health`, `POST /api/chat` (SSE or JSON), `GET /api/chats`, `PATCH /api/chats/{chatId}`, `DELETE /api/chats/{chatId}` (soft-delete) | Authenticated (Active users) |
| **Admin Users** | `GET /api/admin/users`, `POST /api/admin/users`, `PUT /api/admin/users/{id}/password`, `PATCH /api/admin/users/{id}/status`, `DELETE /api/admin/users/{id}` | `ROLE_ADMIN` |
| **Admin Chats & Backups** | `GET /api/admin/users/{id}/chats`, `DELETE /api/admin/users/{userId}/chats/{chatId}`, `GET /api/admin/chats/backup`, `GET /api/admin/chats/{chatId}/backup`, `GET /api/admin/users/{userId}/chats/backup` | `ROLE_ADMIN` |
| **Provider Vault** | `GET /api/admin/provider-tokens`, `POST /api/admin/provider-tokens`, `DELETE /api/admin/provider-tokens/{provider}` | `ROLE_ADMIN` |
| **Stats & Billing** | `GET /api/admin/stats/tokens`, `POST /api/admin/billing/openai-costs` | `ROLE_ADMIN` |

---

## Running Tests & Builds

### Backend (Maven)
```bash
mvn test
```

### Frontend (Vitest + TypeScript + Vite)
```bash
cd ui
npm test
npm run build
```

---

## Project Structure

```text
ai-agent-tool/
├── docs/
│   └── logo.svg                      # Project vector logo
├── src/
│   ├── main/
│   │   ├── java/uk/emoshin/taf/aiagent/
│   │   │   ├── config/               # CORS, seeding, configuration
│   │   │   ├── domain/               # JPA entities (AppUser, ChatSession, ProviderToken, TokenUsageRecord)
│   │   │   ├── dto/                  # Request/response records
│   │   │   ├── proxy/                # OpenAI & Anthropic HTTP/SSE proxy clients
│   │   │   ├── repository/           # Spring Data JPA repositories
│   │   │   ├── security/             # JWT filter, SecurityConfig, AES-GCM encryption
│   │   │   ├── service/              # User, Admin, TokenStats, ModelPricing, OpenAiBilling services
│   │   │   └── web/                  # REST controllers & global error handling
│   │   └── resources/
│   │       ├── application.yml       # Server, datasource, Flyway, security config
│   │       └── db/migration/         # Flyway SQL migrations
│   └── test/                         # Backend integration & service tests
├── ui/
│   ├── src/
│   │   ├── components/               # ChatArea, Sidebar, AuthScreen, SettingsModal, Admin Console
│   │   ├── services/                 # API, auth, bot adapters, provider token clients
│   │   ├── types/                    # TypeScript interfaces
│   │   └── utils/                    # Token/cost math, storage, defaults
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   └── nginx.conf                    # Load-balancing SSE gateway for scaled API replicas
├── .dockerignore                     # Excludes UI and build artifacts from backend image
├── Dockerfile                        # Multi-stage Java 25 REST backend image (no UI)
├── docker-compose.yml                # PostgreSQL 17 + scalable REST API + Nginx gateway
├── pom.xml                           # Maven build configuration
└── README.md
```
