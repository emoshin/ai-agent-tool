# AI Agent Tool — Chat UI Module (`ui/`)

A ChatGPT-inspired React + TypeScript + Tailwind CSS UI module for interacting with an AI bot.

## Features

- **Collapsible Left Sidebar**:
  - Smooth expand/collapse on desktop and slide-over drawer on mobile
  - Grouped conversation history (`Today`, `Yesterday`, `Previous 7 Days`, `Older`)
  - Instant search filter, New Chat creation, inline chat rename, and delete
  - User profile footer with user avatar image and Settings trigger
- **Center & Right Chat Region**:
  - Model selector dropdown (`Agent 4o`, `Agent o3-mini`, `Custom Backend Bot`)
  - Empty-state greeting with starter prompt cards
  - User pill bubbles and left-aligned AI bot Markdown responses (GFM tables, lists, copyable code blocks)
  - Token-by-token streaming with **Stop generating**, **Copy**, and **Regenerate** actions
- **Dual AI Bot Adapter (`src/services/botClient.ts`)**:
  - **Simulated Mode** (default): works immediately out-of-the-box with realistic streaming responses
  - **REST / SSE API Mode**: sends `POST` `{ model, stream: true, messages }` and parses both SSE (`data: {"delta": ...}` / OpenAI `choices[0].delta.content`) and plain JSON responses

## Commands

```bash
cd ui
npm install
npm run dev      # Start Vite dev server on http://localhost:5173
npm test         # Run Vitest unit & component tests
npm run build    # Type-check and build production bundle into ui/dist
```

## Connecting to a Java Backend

Vite is configured in `vite.config.ts` to proxy `/api/*` requests to `http://localhost:8080`.
To connect a live backend:
1. Click **Settings** in the bottom-left user profile or top-right status badge.
2. Switch **AI Bot Adapter** to **REST / SSE API**.
3. Use `/api/chat` (or a full URL) and optionally provide a Bearer token.
