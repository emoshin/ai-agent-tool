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
- **Per-Chat Model Lock & Provider Icons**: Choose between OpenAI (`gpt-4o`, `o3-mini`) and Anthropic (`claude-sonnet-4`, `claude-opus-4`) when starting a new chat; the selected model is locked for that conversation and paired with a ChatGPT or Claude icon.
- **Rich Streaming Responses**: Real-time Server-Sent Events (SSE) streaming with stop-generation, regenerate response, and GitHub-Flavored Markdown code rendering.
- **Dual Adapter Mode**: Works out of the box in **Simulated Mode** for offline/UI testing, or connects to the Spring Boot **API Mode** backend.

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
  - Create users, suspend/activate accounts, delete users, and inspect or permanently delete user chat histories.
  - **Soft-Deleted Chat Visibility & Backups**: User-deleted chats are marked `deleted = true` in PostgreSQL (hidden from the user's chat list) and surfaced in the Admin Console with a deleted-chat icon badge; administrators can download JSON backups for any individual chat, all chats of a user, or the entire workspace.
- **API Tokens Tab**:
  - Configure, rotate (with masked preview), or remove OpenAI and Anthropic API keys and custom base URLs.
- **Cost Estimation & OpenAI Billing Check**:
  - Calculates approximate USD consumption per model, per user, and globally based on logged input/output tokens.
  - Includes an optional **OpenAI Organization Spend (30d)** lookup (`/api/admin/billing/openai-costs` → OpenAI `/v1/organization/costs` using an `sk-admin-...` key) and notes that OpenAI does not expose remaining prepaid credit balance via API.

---

## Architecture

```text
┌──────────────────────────┐        HTTP / SSE (JWT)       ┌───────────────────────────────┐
│   React + Vite UI (:5173)│ ────────────────────────────▶ │ Spring Boot Backend (:8080)   │
│  • Chat Workspace        │ ◀──────────────────────────── │  • JWT Auth & RBAC            │
│  • AuthScreen & Settings │   /api/users, /api/chats,     │  • AES-256-GCM Token Vault    │
│  • Admin Console         │   /api/chat, /api/admin       │  • OpenAI & Anthropic Proxy   │
└──────────────────────────┘                               │  • Token & USD Cost Tracking  │
                                                           └───────────┬────────────┬──────┘
                                                                       │            │
                                                    JPA / Flyway       ▼            ▼  HTTPS (Injected API Key)
                                                           ┌────────────────┐  ┌───────────────────────────┐
                                                           │ PostgreSQL 17  │  │ OpenAI API / Anthropic API│
                                                           └────────────────┘  └───────────────────────────┘
```

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Java 25, Spring Boot 3.5.16 (Web, Data JPA, Security, Validation), Flyway, Maven |
| **Database** | PostgreSQL 17 (runtime via Docker Compose), H2 (integration tests) |
| **Frontend** | React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, `react-markdown`, `remark-gfm`, `lucide-react` |
| **Testing** | JUnit 5, Spring Boot Test, Vitest, React Testing Library |

---

## Quick Start

### Prerequisites
- **Java 25** and **Maven 3.9+**
- **Node.js 20+** and **npm**
- **Docker** (for PostgreSQL)

### 1. Start PostgreSQL
```bash
docker compose up -d
```
This starts a `postgres:17-alpine` container on port `5432` with database `ai_agent_tool`, user `ai_agent`, and password `ai_agent_password`.

### 2. Start the Spring Boot Backend
```bash
mvn spring-boot:run
```
The backend listens on `http://localhost:8080` and automatically runs Flyway migrations in `src/main/resources/db/migration`.

### 3. Start the React Frontend
```bash
cd ui
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser. Vite proxies all `/api/*` requests to `http://localhost:8080`.

### Default Admin Credentials
When `APP_SEED_ENABLED=true` (enabled by default), the backend seeds an initial administrator account on startup:

- **Email**: `admin@ai-agent-tool.dev`
- **Password**: `admin123`

> **Security Note:** Change the seeded admin password, `APP_JWT_SECRET`, and `APP_TOKEN_ENCRYPTION_KEY` before deploying outside local development.

Next, sign in as Admin, open the **Admin Console → API Tokens** tab, and save your OpenAI and/or Anthropic API keys so users can start chatting in API mode.

---

## Configuration

Backend settings in [`src/main/resources/application.yml`](src/main/resources/application.yml) can be overridden via environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/ai_agent_tool` | PostgreSQL JDBC connection URL |
| `DB_USERNAME` | `ai_agent` | Database username |
| `DB_PASSWORD` | `ai_agent_password` | Database password |
| `APP_SEED_ENABLED` | `true` | Seeds the default admin user if absent |
| `APP_JWT_SECRET` | `dev-only-jwt-secret-...` | HMAC signing key for JWT tokens (min 32 bytes) |
| `APP_JWT_EXPIRATION_MS` | `86400000` (24h) | JWT access token expiration in milliseconds |
| `APP_TOKEN_ENCRYPTION_KEY` | `dev-only-aes-key-...` | AES-256-GCM key used to encrypt provider API tokens |

---

## Supported Models & Cost Estimation Rates

Approximate USD spend is calculated from logged prompt and completion tokens using the following list rates (per 1M tokens):

| Model ID | Provider | Input ($ / 1M) | Output ($ / 1M) |
| :--- | :--- | :---: | :---: |
| `gpt-4o` | OpenAI | $2.50 | $10.00 |
| `gpt-4o-mini` | OpenAI | $0.15 | $0.60 |
| `o3-mini` | OpenAI | $1.10 | $4.40 |
| `claude-sonnet-4` | Anthropic | $3.00 | $15.00 |
| `claude-opus-4` | Anthropic | $15.00 | $75.00 |
| `claude-haiku` | Anthropic | $0.80 | $4.00 |

---

## API Overview

| Endpoint Group | Endpoints | Access |
| :--- | :--- | :--- |
| **Auth & Profile** | `POST /api/users/register`, `POST /api/users/login`, `GET /api/users/me`, `PUT /api/users/me` | Public (`register`/`login`) / Authenticated |
| **Chat & Proxy** | `GET /api/health`, `POST /api/chat` (SSE or JSON), `GET /api/chats`, `PATCH /api/chats/{chatId}`, `DELETE /api/chats/{chatId}` (soft-delete) | Authenticated (Active users) |
| **Admin Users** | `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/{id}/status`, `DELETE /api/admin/users/{id}` | `ROLE_ADMIN` |
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
├── docker-compose.yml                # PostgreSQL 17 service
├── pom.xml                           # Maven build configuration
└── README.md
```
