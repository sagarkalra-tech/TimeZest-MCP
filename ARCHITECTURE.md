# TimeZest MCP — Complete System Reference

> **The definitive guide to the architecture, data flow, and implementation of the TimeZest Model Context Protocol (MCP) server.**

---

## 🛰️ System Overview

The **TimeZest MCP Server** is an integration bridge that exposes the TimeZest scheduling API to the Model Context Protocol. It allows LLMs (like Claude) to dynamically query, filter, and analyze scheduling data using natural language.

### Core Objectives
1. **Conversational Scheduling**: Enable users to "talk" to their schedule (e.g., "Summarize my day").
2. **Data Normalization**: Transform complex, nested TimeZest JSON into flat, AI-ready objects.
3. **Resilience**: Implement production-grade retry and rate-limiting logic for third-party API stability.
4. **Accuracy**: Ensure 100% timezone precision across global MSP teams.

---

## 🏗️ Architecture Design

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
│  ┌──────▼─────────────────▼───────────────────────────────────┐ │
│  │                 TIMEZEST API CLIENT                        │ │
│  │  Pagination • Retry Logic • Rate Limit Management         │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │ (src/client.ts)                       │
│  ┌──────────────────────▼─────────────────────────────────────┐ │
│  │               DATA TRANSFORMATION LAYER                    │ │
│  │  Timezone Math • Engineer Mapping • Ticket Linking        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         │ (src/utils/)                          │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTPS / REST
┌─────────────────────────▼──────────────────────────────────────┐
│                      TIMEZEST API (v1)                         │
│       Scheduling Requests • Appointment Types • Resources      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Directory Structure

```
timezest-mcp/
├── src/
│   ├── index.ts                # Server entry, tool registration, and high-level routing
│   ├── client.ts               # Resilient API client (Axios + auto-retry + pagination)
│   ├── __tests__/              # Vitest test suite
│   │   ├── client.test.ts      # API consumer tests
│   │   ├── filter.test.ts      # Search and interval logic tests
│   │   └── transform.test.ts   # Data normalization verification
│   └── utils/
│       ├── transform.ts        # Normalization logic (Team/Agent mapping, Status)
│       └── filter.ts           # Partial matching and date-math utilities
├── build/                      # Compiled ES6 output (Ready for npm)
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions: build + test on Node 20 & 22
├── package.json                # Dependency manifest and lifecycle scripts
├── tsconfig.json               # TypeScript compiler rules
└── vitest.config.ts            # Testing framework configuration
```

---

## 🛠️ Component Breakdown

### 1. Entry Point (`src/index.ts`)
The orchestrator of the server. It handles the MCP lifecycle:
- **Environment Check**: Verifies `TIMEZEST_API_KEY` on startup.
- **Tool Definition**: Registers 8 specialized JSON schemas (briefing, stats, lookups).
- **Tool Execution**: Routes incoming requests to the client and applies utility filters.
- **Context Management**: Passes user timezones from tool arguments down to the transformation layer.

### 2. Resilient Client (`src/client.ts`)
A production-grade wrapper for the TimeZest REST API:
- **`fetchWithRetry`**: Implements exponential backoff.
- **Rate-Limit Awareness**: Automatically honors `Retry-After` headers for `429` status codes.
- **Deep Pagination**: Recursively crawls paged endpoints (using 50-item chunks) to build a complete dataset before transformation.
- **Warm Cache**: Loads and caches `appointment_types` to reduce API overhead.

### 3. Normalization Layer (`src/utils/transform.ts`)
The most critical part of the server. TimeZest API objects are deeply nested; this layer flattens them for LLM efficiency:
- **Engineer Resolution**: Implements a "Highest-Confidence" search. It checks `scheduled_agents` first, then falls back to `resources` (if the resource is an agent), ensuring the correct human is identified even in complex team dispatches.
- **Ticket Linking**: Scans `associated_entities` to find and normalize ConnectWise Service or Project ticket numbers.
- **Timezone Precision**: 
  - Converts Unix timestamps to strict ISO.
  - Generates localized "Display Strings" (e.g., `2024-03-26 4:00 PM CST`) so Claude can speak in the user's relative time.
- **Aging Logic**: Calculates `age_hours` for unbooked requests to enable "aging request" triage.

---

## 🔄 Technical Data Flow

1. **Invoke**: Claude requests `get_todays_appointments`.
2. **Fetch**: `TimeZestClient` requests `/scheduling_requests` with a window filter (defaults to -14/+30 days).
3. **Paginate**: Client follows all `page` parameters to build the full array.
4. **Transform**: The `transformAppointment` function is mapped across the array, mapping IDs to Names and normalizing timezones.
5. **Prune**: Tool-specific filters (e.g., `engineer_name` match in `filter.ts`) are applied.
6. **Respond**: A clean, structured JSON array is returned to Claude.

---

## 🧪 Testing Infrastructure

We use **Vitest 4.x** to ensure the server is "Enterprise Ready." The suite contains **22 tests across 3 test files**, covering every major logic block:

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `transform.test.ts` | 8 | Engineer resolution priority, ticket extraction, timezone conversion, graceful handling of missing fields |
| `filter.test.ts` | 6 | Case-insensitive partial name matching, team name matching, date-range interval filtering, pending appointment fallback logic |
| `client.test.ts` | 8 | Appointment type caching, pagination termination, retry on 429/5xx, no-retry on 4xx client errors, retry exhaustion |

All tests use **mocked API responses** — no live TimeZest API calls are made during testing, making the suite fast and deterministic.

```bash
npm run test          # Single run
npm run test:watch    # Re-runs on file save
```

---

## 🚀 CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

Every push to `main` and every pull request triggers an automated pipeline on GitHub Actions:

| Step | Command | Purpose |
|------|---------|---------|
| Install | `npm ci` | Strict install from lock file (fails on mismatch) |
| Build | `npm run build` | TypeScript compilation via `tsc` |
| Test | `npm test` | Runs all 22 Vitest tests |

**Node.js Matrix:** `[20, 22]`
> Node 18 was dropped because Vitest 4.x internally uses `node:util.styleText`, which was introduced in Node 20.

**Key Design Decisions:**
- `npm ci` (not `npm install`) ensures reproducible builds with no lock file drift.
- The matrix strategy validates compatibility across current LTS (20) and latest (22) Node releases.
- Tests use mocked HTTP responses, so no API keys or secrets are required for CI to pass.

---

## ⚙️ Environment Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `TIMEZEST_API_KEY` | **Yes** | — | Bearer token for TimeZest API access. |
| `TIMEZEST_DEFAULT_TZ` | No | `America/Chicago` | Fallback IANA timezone for localized strings. |
| `TIMEZEST_WINDOW_BACK` | No | `14` | How many days back to fetch requests. |
| `TIMEZEST_WINDOW_FWD` | No | `30` | How many days forward to fetch requests. |

---

## 📄 License
MIT © 2026 Sagar Kalra.
