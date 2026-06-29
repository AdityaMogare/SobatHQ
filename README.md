# SobatHQ

**Your AI Chief of Staff for modern work.**

SobatHQ connects to Gmail, Calendar, Slack, Drive, and Sheets to understand your work across applications. It proactively prioritizes emails, summarizes updates, tracks workflows, drafts responses, and suggests next actions — with your approval on every important action.

## Architecture

```
SobatHQ/
├── backend/          # Node.js + Express API
│   ├── agents/       # Multi-agent orchestrator + specialists
│   ├── tools/        # Tool registry (Gmail, Calendar, Drive, Sheets, Slack)
│   ├── memory/       # Redis-compatible memory store
│   ├── queue/        # Async task queue
│   └── api/          # REST endpoints + WebSocket
├── frontend/         # React + Tailwind dashboard
└── slack/            # Slack bot + MCP manifest
```

## Quick Start

### Prerequisites

- Node.js 20+
- Redis (optional — falls back to in-memory)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start Redis (optional)
docker compose up redis -d

# Run backend + frontend
npm run dev
```

- **Dashboard:** http://localhost:5173
- **API:** http://localhost:3001
- **Health:** http://localhost:3001/health

### Slack Bot

1. Create a Slack app at https://api.slack.com/apps
2. Import `slack/manifest.json` or configure manually
3. Enable Socket Mode and add bot + app tokens to `.env`
4. Run: `npm run dev -w slack`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + queue stats |
| POST | `/api/orchestrate` | Send message to multi-agent coordinator |
| POST | `/api/orchestrate/briefing` | Get daily briefing |
| GET | `/api/tasks?userId=` | List user tasks |
| GET | `/api/approvals?userId=` | List pending approvals |
| POST | `/api/approvals/:id/approve` | Approve an action |
| POST | `/api/approvals/:id/reject` | Reject an action |
| GET | `/api/agents` | List agent statuses |
| GET | `/api/tools` | List registered tools |
| GET | `/api/auth/google` | Google OAuth flow |
| GET | `/api/auth/slack` | Slack OAuth flow |

## WebSocket Events

Connect to `ws://localhost:3001` and emit `subscribe` with your userId.

| Event | Payload |
|-------|---------|
| `agent:status` | Agent state update |
| `task:updated` | Task created or status changed |
| `approval:new` | New approval request |
| `approval:resolved` | Approval approved/rejected |
| `briefing:ready` | Daily briefing compiled |
| `orchestrator:progress` | Orchestration step update |

## Multi-Agent System

| Agent | Role | Tools |
|-------|------|-------|
| Coordinator | Routes requests, builds briefings | All |
| Email | Prioritizes inbox, drafts replies | Gmail |
| Calendar | Manages meetings and events | Calendar |
| Documents | Scans Drive files | Drive |
| Reporting | Prepares reports | Sheets, Drive |
| Slack | Workspace messaging | Slack |

## Development

```bash
npm run dev:backend    # Backend only (port 3001)
npm run dev:frontend   # Frontend only (port 5173)
npm run build          # Build all packages
npm run lint           # Type-check all packages
```


