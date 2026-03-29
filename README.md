# ⏰ TimeZest MCP Server

[![npm version](https://img.shields.io/npm/v/timezest-mcp.svg)](https://www.npmjs.com/package/timezest-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![CI](https://github.com/sagarkalra-tech/TimeZest-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/sagarkalra-tech/TimeZest-MCP/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **Bring your TimeZest scheduling data directly into Claude** through the Model Context Protocol (MCP). Perform real-time appointment lookups, engineer briefings, and ticket-linked schedule management — all with natural language.

**Registry ID:** `io.github.sagarkalra-tech/timezest-mcp`

---

## 🌟 Why TimeZest MCP?

If you manage a team that uses **TimeZest** with **ConnectWise**, you know the pain: toggling between tabs, manually checking who's booked, chasing unbooked scheduling requests, and cross-referencing ticket numbers.

This MCP server turns Claude into a **scheduling assistant** that can:

- 🗓️ Give you a **morning briefing** of today's confirmed appointments grouped by engineer
- 🔍 **Find appointments by ticket number** — just say "find appointments for ticket #964400"
- ⏳ Surface **aging unbooked requests** that need follow-up
- 📊 Generate **aggregate scheduling stats** across your team
- 🕐 Handle **timezone-accurate** reporting across global MSP teams

---

## 🚀 Get Started in 30 Seconds

### Prerequisites

- **Node.js 20+** — [Download here](https://nodejs.org/)
- **TimeZest API Key** — Found in TimeZest → Settings → API

### Option 1: Claude Desktop (Recommended)

Add this to your Claude Desktop configuration file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "timezest": {
      "command": "npx",
      "args": ["-y", "timezest-mcp@latest"],
      "env": {
        "TIMEZEST_API_KEY": "your-timezest-api-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. You're done.

### Option 2: Claude Code CLI

```bash
claude mcp add-json timezest-mcp '{
  "command": "npx",
  "args": ["-y", "timezest-mcp@latest"],
  "env": {
    "TIMEZEST_API_KEY": "your-timezest-api-key-here"
  }
}'
```

### Option 3: VS Code (Copilot)

Add to your `.vscode/settings.json` or User Settings:

```json
{
  "mcp": {
    "servers": {
      "timezest": {
        "command": "npx",
        "args": ["-y", "timezest-mcp@latest"],
        "env": {
          "TIMEZEST_API_KEY": "your-timezest-api-key-here"
        }
      }
    }
  }
}
```

---

## 🛠️ Available Tools

The server exposes **8 specialized tools** that Claude can call:

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_todays_appointments` | Morning briefing — today's confirmed appointments grouped by engineer, plus pending unbooked requests | `timezone` |
| `list_appointments` | Flexible query across any date range with optional filters | `start_date`, `end_date`, `engineer_name`, `status` |
| `get_engineer_schedule` | All upcoming appointments for a specific engineer, sorted by time | `engineer_name`, `days_ahead`, `include_pending` |
| `list_pending_requests` | Unbooked invitations (sent/new) with age tracking in hours/days | `days_back`, `engineer_name`, `older_than_hours` |
| `find_appointment_by_ticket` | Find appointments linked to a ConnectWise ticket number | `ticket_number` (e.g., `964400` or `#964400`) |
| `get_appointment_types` | List all appointment type definitions configured in TimeZest | — |
| `get_appointment_stats` | Aggregate summary: counts by status, by engineer, today's load, oldest pending | `days_back`, `days_forward` |
| `list_cancelled_appointments` | Cancelled requests with scheduling URLs for rebooking | `days_back`, `engineer_name` |

---

## 💬 Example Prompts

Once connected, just talk to Claude naturally:

```
"Who are my top engineers today and what are they booked for?"

"Find any TimeZest requests for ticket #964400."

"Give me a morning briefing of today's confirmed vs. unbooked requests."

"Show me all pending scheduling requests older than 48 hours."

"What's the scheduling volume breakdown for the last two weeks?"

"Pull up Sarah's schedule for the next 5 days."

"List all cancelled appointments from last week — any we should rebook?"
```

---

## ⚙️ Configuration

| Environment Variable | Required | Default | Purpose |
|---------------------|----------|---------|---------|
| `TIMEZEST_API_KEY` | **Yes** | — | Your TimeZest Bearer token (Settings → API) |
| `TIMEZEST_DEFAULT_TZ` | No | `America/Chicago` | Default IANA timezone for localized display strings |
| `TIMEZEST_WINDOW_DAYS_BACK` | No | `14` | How many days back to fetch scheduling requests |
| `TIMEZEST_WINDOW_DAYS_FORWARD` | No | `30` | How many days forward to fetch scheduling requests |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP CLIENT (Claude)                      │
│        Desktop App  •  Claude Code CLI  •  IDE Plugin           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Stdio (JSON-RPC)
┌──────────────────────────▼──────────────────────────────────────┐
│                     TIMEZEST MCP SERVER                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │ Tool Handler │  │  MCP SDK     │  (index.ts)                 │
│  │ (8 Tools)    │  │  Registry    │                             │
│  └──────┬───────┘  └──────────────┘                             │
│         │                                                       │
│  ┌──────▼────────────────────────────────────────────────────┐  │
│  │                 TIMEZEST API CLIENT                        │  │
│  │  Pagination • Retry Logic • Rate Limit Management         │  │
│  └──────────────────────┬────────────────────────────────────┘  │
│                         │ (client.ts)                            │
│  ┌──────────────────────▼────────────────────────────────────┐  │
│  │               DATA TRANSFORMATION LAYER                    │  │
│  │  Timezone Math • Engineer Mapping • Ticket Linking         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                         │ (utils/)                               │
└─────────────────────────┼────────────────────────────────────────┘
                          │ HTTPS / REST
┌─────────────────────────▼──────────────────────────────────────┐
│                      TIMEZEST API (v1)                          │
│       Scheduling Requests • Appointment Types • Resources       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Read-Only**: Intentionally kept read-only — no mutations to your scheduling data
- **Resilient Client**: Exponential backoff with automatic `Retry-After` header support for 429/5xx errors
- **Deep Pagination**: Recursively crawls all pages (50-item chunks) to build complete datasets
- **Timezone Precision**: Converts Unix timestamps to strict ISO with localized display strings using IANA timezone identifiers
- **Engineer Resolution**: Uses a "highest-confidence" search — checks `scheduled_agents` first, then falls back to `resources`
- **Warm Cache**: Appointment types are cached after first fetch to reduce API overhead

---

## 🧪 Testing

The server ships with a comprehensive **Vitest** test suite — **22 tests across 3 files**:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `transform.test.ts` | 8 | Engineer resolution, ticket extraction, timezone conversion, graceful handling of missing fields |
| `filter.test.ts` | 6 | Case-insensitive partial matching, team name matching, date-range filtering |
| `client.test.ts` | 8 | Appointment type caching, pagination, retry on 429/5xx, no-retry on 4xx |

All tests use **mocked API responses** — no live API calls, no secrets needed.

```bash
npm test            # Single run
npm run test:watch  # Re-runs on file save
```

---

## 🔒 Security & Trust

- **NPM Provenance**: Every release is cryptographically signed via GitHub Actions OIDC
- **CI/CD Pipeline**: Automated build → test → publish on tagged releases (no manual `npm publish`)
- **No Secrets in CI**: Tests require no API keys — fully deterministic with mocked responses
- **Node.js Matrix**: Tested on Node 20 (LTS) and 22 (Current)

---

## 📦 Distribution

| Channel | Link |
|---------|------|
| **NPM** | [`timezest-mcp`](https://www.npmjs.com/package/timezest-mcp) |
| **MCP Registry** | [`io.github.sagarkalra-tech/timezest-mcp`](https://registry.modelcontextprotocol.io) |
| **GitHub** | [`sagarkalra-tech/TimeZest-MCP`](https://github.com/sagarkalra-tech/TimeZest-MCP) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes and ensure tests pass (`npm test`)
4. Submit a pull request

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deep dive into the data flow, component design, and transformation logic.

---

## 📄 License

MIT © 2026 [Sagar Kalra](https://github.com/sagarkalra-tech)
