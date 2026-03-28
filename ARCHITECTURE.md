# 🏗️ Architecture: TimeZest MCP Server

This document outlines the system design, data flow, and technical implementation of the TimeZest Model Context Protocol (MCP) server.

---

## 🛰️ System Overview

The server acts as a bridge between **Claude (the MCP Client)** and the **TimeZest REST API**. It follows the Model Context Protocol standard, allowing LLMs to perform structured scheduling operations using natural language.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (ESModules)
- **SDK**: `@modelcontextprotocol/sdk`
- **Networking**: `Axios` with automatic retry and rate-limiting logic.
- **Date Handling**: `date-fns` and `date-fns-tz` for precise timezone math.
- **Testing**: `Vitest` for unit testing transformations and filtering logic.

---

## 📂 Core Components

### 1. The Entry Point (`src/index.ts`)
- Initializes the `Server` instance from `@modelcontextprotocol/sdk`.
- Defines all JSON schemas for available tools.
- Maps tool calls to `TimeZestClient` methods and utility functions.
- Handles environment variable verification (`TIMEZEST_API_KEY`).

### 2. TimeZest API Client (`src/client.ts`)
- **Resilience**: Implements a `fetchWithRetry` wrapper that handles network errors, `5xx` server errors, and `429` Rate Limiting (honoring `Retry-After` headers).
- **Pagination**: Automatically crawls paged API results until the entire requested window is fetched.
- **Caching**: Maintains an in-memory map of `appointment_types` to avoid redundant API calls.

### 3. Normalization & Transformation (`src/utils/transform.ts`)
The TimeZest API returns complex, multi-object responses. This layer normalizes those objects into a flat, AI-friendly `Appointment` interface:
- **Engineer Logic**: Intelligently identifies the assigned resource, whether it came from a direct agent assignment or a Team Dispatch.
- **Ticket Mapping**: Extracts and labels ConnectWise service/project tickets from linked entities.
- **Timezone Math**: Converts Unix timestamps into both ISO format (for AI logic) and human-readable local strings (for the UI briefing).

### 4. Search & Filtering (`src/utils/filter.ts`)
- **Intelligent Matching**: Implements case-insensitive, partial-match searching for engineer and team names.
- **Interval Filtering**: Uses `isWithinInterval` to prune results based on flexible date ranges.

---

## 🔄 Data Flow

1. **Prompt**: User asks: *"Find the schedule for Engineer Aaron."*
2. **Analysis**: Claude identifies the `get_engineer_schedule` tool and extracts `engineer_name: "Aaron"`.
3. **Execution**: The MCP Server calls its internal client, fetches paged results from TimeZest, and normalizes them.
4. **Reduction**: The normalized array is filtered for "Aaron" and sorted.
5. **Response**: The server returns a clean JSON summary. Claude uses this to answer: *"Aaron has 3 appointments scheduled for today..."*

---

## 🧪 Testing Strategy

Stability is ensured via **Vitest**. We focus on:
- **Date Correctness**: Verifying that timezone offsets don't drift during transformation.
- **Pattern Matching**: Ensuring engineer names are found regardless of case or team affiliation.
- **Error Grace**: Verifying that the server returns friendly MCP error messages when API keys are invalid or quotas are hit.

---

## 📄 License

MIT © 2026 Sagar Kalra.
