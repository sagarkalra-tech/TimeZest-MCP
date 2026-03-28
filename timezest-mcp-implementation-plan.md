
## What the Exploration Run Confirmed

Before finalising the architecture, the exploration script resolved four questions that affect
implementation directly.

### 1. Four statuses exist, not three

The Firebase function handles `scheduled`, `sent`, and `cancelled`. Live data contains a fourth:
**`new`** — created but the invitation email has not been dispatched yet. These records have
empty `scheduled_agents`, null `selected_start_time`, and null `scheduled_at`, identical to
`sent`. The MCP server must include `new` in all "pending/unbooked" logic.

### 2. All timestamps are Unix seconds integers

Every time field (`created_at`, `updated_at`, `scheduled_at`, `selected_start_time`) is a plain
integer like `1774650862`. The MCP server converts all of them to ISO 8601 at the boundary —
tools always return human-readable strings, never raw integers.

### 3. `resources` vs `scheduled_agents` is intentional and meaningful

| Field | Meaning |
|---|---|
| `resources[]` | Who the request was *assigned to* (can be a `team` object) |
| `scheduled_agents[]` | Who *accepted* and owns the confirmed appointment |

For team-based requests, `resources[0].object === "team"` and `scheduled_agents[0]` is the
individual. The MCP always returns the `scheduled_agents` name as the primary engineer; it
falls back to `resources` (if `object === "agent"`) only for unbooked requests where
`scheduled_agents` is empty.

### 4. The API filter is on `created_at`, not `selected_start_time`

There is no server-side filter to ask "what appointments start today." The only available filter
field is `created_at`. All time-of-day filtering (today's schedule, this week's appointments,
etc.) must be done client-side after fetching a wide window. The MCP server fetches a 45-day
window (14 days back, 30 days forward) and filters in memory. This is consistent with what the
Firebase function already does.

### 5. Ticket numbers have a `#` prefix in the API

Associated entity `number` fields return `"#964400"` not `"964400"`. The
`find_appointment_by_ticket` tool must accept both formats and normalise before matching.

### 6. Three appointment types share the name "Remote Access to PC"

IDs `apty_8iehurHu2L8JStxHAN2Fz`, `apty_61wD2QcMYFCTniVkQH77Jb`, and `apty_6aU73FoQwsd63Bc5vCRP9E`
are all named "Remote Access to PC" (one has a trailing space). Tools always surface the
`appointment_type_id` alongside the display name.

---

## MCP Tools — Final Design

Eight tools. All read-only. Auth via `TIMEZEST_API_KEY` environment variable.

---

### `get_todays_appointments`

**Purpose:** The morning briefing tool. Returns confirmed appointments for today grouped by
engineer, with pending unbooked requests listed separately.

**Parameters:**
```ts
timezone?: string  // default: "America/Chicago"
```

**Implementation:**
1. Fetch scheduling requests for the standard 45-day window
2. Filter by `selected_start_time` falling within today in `timezone`
3. Separately collect all `new` + `sent` requests (no `selected_start_time`) assigned to active
   engineers
4. Group scheduled records by `scheduled_agents[0].name`
5. Return both groups

**Example output:**
```
Today — 28 March 2026 (CST)

Confirmed:
  Aaron Stowe     10:00 AM  Remote Access to PC (30 min) — Ashley Butterworth, Integris Solutions, #964400
  Isam Hashim     11:30 AM  Remote Access to PC (60 min) — Ann Barnard, HBA Design Build, #963563
  Zack Venable     9:10 AM  Remote Access to PC (15 min) — Michae Thomas, Integris Solutions, #962982

Pending (not yet booked):
  Scout Kalra     — Bart Higgins (Shields Legal, #964695) — sent 28 Mar
  Scout Kalra     — Christian Holt (Gold Medal Pools, #962964) — sent 14 Mar [14 days old]
  Isam Hashim     — Cody Burdette (Beck Technology, #955708) — sent 27 Mar
  MSP Red Team    — Bruce Barclay (HBA Design Build, #963564) — new (invite not sent)
```

---

### `list_appointments`

**Purpose:** Flexible query across any date range with optional engineer and status filters.
The general-purpose lookup tool.

**Parameters:**
```ts
start_date: string        // YYYY-MM-DD
end_date: string          // YYYY-MM-DD
engineer_name?: string    // partial match, case-insensitive
status?: "scheduled" | "sent" | "new" | "cancelled"
timezone?: string         // default: "America/Chicago"
```

**Implementation:**
1. Fetch standard window; filter results client-side by `selected_start_time` date range
2. If `engineer_name` provided, match against `scheduled_agents[0].name` and
   `resources[0].name` (only when `resources[0].object === "agent"`)
3. If `status` provided, filter by `status` field

---

### `get_engineer_schedule`

**Purpose:** All upcoming appointments for a named engineer, sorted by time. Built for the
"what's on Aaron's plate this week?" question.

**Parameters:**
```ts
engineer_name: string     // partial match, case-insensitive
days_ahead?: number       // default: 7
include_pending?: boolean // default: true — include sent/new requests
```

**Implementation:**
- Match against `scheduled_agents[0].name` first; fall back to `resources[0].name` if
  `resources[0].object === "agent"`
- For pending requests, also check `resources` since `scheduled_agents` is empty

---

### `list_pending_requests`

**Purpose:** All unbooked invitations — `sent` and `new` status combined. The follow-up queue.
Returns age in days so stale ones are obvious.

**Parameters:**
```ts
days_back?: number          // how far back to look; default: 14
engineer_name?: string      // filter to one engineer
older_than_hours?: number   // only return requests older than N hours
```

**Key output fields per record:**
- `engineer` — from `resources[0].name` (scheduled_agents is empty for pending)
- `age_hours` — computed from `(now - created_at)`
- `end_user_name`, `end_user_email`
- `ticket_number` — from `associated_entities`
- `scheduling_url` — the link to resend to the client
- `status` — `"sent"` or `"new"` (new = invite not dispatched yet)

---

### `find_appointment_by_ticket`

**Purpose:** Given a ConnectWise ticket number, return all TimeZest requests linked to it.
Eliminates the tab-switching described in Use Case 2.

**Parameters:**
```ts
ticket_number: string    // accepts "964400" or "#964400"
```

**Implementation:**
- Fetch full 45-day window
- Normalise input: strip leading `#`, coerce to string
- Scan every record's `associated_entities` for an entry where `number === "#" + normalised`
- Return full enriched record for each match, including `appointment_type`, resolved engineer
  name, and status

---

### `get_appointment_types`

**Purpose:** List all appointment type definitions — ID, name, duration. Used by Claude to
resolve type IDs in other tool responses and to let users query by appointment kind.

**Parameters:** None

**Implementation:**
- `GET /appointment_types` with pagination
- Deduplicate display names, flag duplicates with their IDs
- Cache per session

**Note on duplicates:** Three types share the name "Remote Access to PC". The tool output
includes the full ID for each so they can be distinguished.

---

### `get_appointment_stats`

**Purpose:** Aggregate summary — counts by status, counts by engineer, total scheduled minutes
today. The "give me the picture" tool for management questions.

**Parameters:**
```ts
days_back?: number    // default: 14
days_forward?: number // default: 30
```

**Returns:**
```ts
{
  total: number,
  by_status: { scheduled: n, sent: n, new: n, cancelled: n },
  by_engineer: { [name]: { scheduled: n, pending: n } },
  today: { confirmed: n, pending: n, total_minutes: n },
  oldest_pending_days: number,
  type_breakdown: { [appointment_type_name]: n }
}
```

---

### `list_cancelled_appointments`

**Purpose:** Cancelled requests with their scheduling URLs so rebooking can happen in the same
conversation without switching to the dashboard.

**Parameters:**
```ts
days_back?: number    // default: 7
engineer_name?: string
```

**Key output fields:** `end_user_name`, `end_user_email`, `ticket_number`, `cancelled_at`
(from `updated_at` on cancelled records), `scheduling_url`, `engineer` (from `resources`)

---

## Data Model

### Normalised Appointment Object (all tools return this shape)

```ts
interface Appointment {
  id: string;                    // "sreq_6yBk67KgdENZzQwWvibUUu"
  status: "scheduled" | "sent" | "new" | "cancelled";
  appointment_type: string;      // resolved from appointment_type_id
  appointment_type_id: string;   // kept for disambiguation
  engineer: string;              // scheduled_agents[0].name ?? resources[0].name (agent only)
  engineer_id: string;
  dispatched_from_team: boolean; // true when resources[0].object === "team"
  team_name?: string;            // resources[0].name when dispatched_from_team
  start_time: string | null;     // ISO 8601 UTC (null if not booked)
  start_time_local: string | null; // formatted in requested timezone
  duration_mins: number;
  end_user_name: string;
  end_user_email: string;
  ticket_number: string | null;  // "#964400" — null if no ticket entity
  ticket_type: "service_ticket" | "project_ticket" | null;
  company_id: number | null;     // connectwise_psa/company id
  contact_id: number | null;     // connectwise_psa/contact id
  scheduling_url: string;
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  age_hours: number;             // (now - created_at) in hours, always present
}
```

---

## File Structure

```
timezest-mcp/
├── src/
│   ├── index.ts          # MCP server entry point — tool registration, stdio transport
│   ├── client.ts         # TimeZest API client — fetch, paginate, type map cache
│   ├── tools/
│   │   ├── get-todays-appointments.ts
│   │   ├── list-appointments.ts
│   │   ├── get-engineer-schedule.ts
│   │   ├── list-pending-requests.ts
│   │   ├── find-appointment-by-ticket.ts
│   │   ├── get-appointment-types.ts
│   │   ├── get-appointment-stats.ts
│   │   └── list-cancelled-appointments.ts
│   └── utils/
│       ├── transform.ts  # raw API record → Appointment; timestamp conversion
│       └── filter.ts     # engineer match, date range, status helpers
├── package.json
├── tsconfig.json
└── setup.bat             # one-click Windows install for MSP staff
```

---

## Implementation Notes for the Builder

These are the concrete decisions the LLM implementing this should bake in from the start — each
one is validated against the live exploration data.

**Appointment type cache:** Fetch `/appointment_types` once at startup and store in a `Map<id,
name>`. Every `scheduling_request` record references a type ID; resolving it without a cache
would double the API calls. The type list is stable during a session.

**Timestamp conversion:** All four time fields (`created_at`, `updated_at`, `scheduled_at`,
`selected_start_time`) are Unix second integers in every record observed. Multiply by 1000 for
`new Date()`. Produce ISO 8601 output with `.toISOString()`. Accept a `timezone` string (IANA
format, e.g. `America/Chicago`) for display-formatted fields using `Intl.DateTimeFormat`.

**Engineer name matching:** Use case-insensitive `includes()` — engineers go by first name
in conversation ("Is Aaron free?"). Match against both `scheduled_agents[0].name` and
`resources[0].name`, but only use `resources` as a match source when
`resources[0].object === "agent"` (not `"team"`).

**Status `new` behaviour:** `new` records have `scheduled_agents: []`, `selected_start_time:
null`, and `scheduled_at: null` — identical to `sent`. The semantic difference: `sent` means
the invitation email has gone to the client; `new` means it hasn't. Group both as "pending/
unbooked" in tools, but preserve the distinction in output so management can see requests that
are stuck before even being sent.

**Ticket number normalisation:** The `number` field in `associated_entities` is always
`"#964400"` style. The `find_appointment_by_ticket` tool must accept both `964400` and
`#964400` from the user and strip the `#` before constructing the match string.

**Scheduling URL is always populated.** Every record in the live data has a non-null
`scheduling_url`. Surface it on every tool response — it is the primary action surface for
rebooking, follow-up, and cancellation recovery, and the current dashboard does not render it
anywhere visible to the user.

**No server-side filter for `selected_start_time`.** The API only filters on `created_at`.
All date-of-appointment queries must fetch the 45-day window and filter in memory by
`selected_start_time`. This is O(34) for the current data volume — not a performance concern.

**`setup.bat` requirements:** Follow the Team GPS pattern. The script should check for Node,
run `npm install -g timezest-mcp`, write the Claude Desktop `claude_desktop_config.json` entry
with the `TIMEZEST_API_KEY` prompt inline, and print a success confirmation. No Python, no
virtual environments.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TIMEZEST_API_KEY` | Yes | Bearer token — `IViu8ZqgFMgY74mAbqYjHnrg9ieUHf0g` |
| `TIMEZEST_DEFAULT_TZ` | No | Default timezone for display; default `America/Chicago` |
| `TIMEZEST_WINDOW_DAYS_BACK` | No | Days back for main fetch window; default `14` |
| `TIMEZEST_WINDOW_DAYS_FORWARD` | No | Days forward for main fetch window; default `30` |

---

## Claude Desktop Config (post-install)

```json
{
  "mcpServers": {
    "timezest": {
      "command": "npx",
      "args": ["-y", "timezest-mcp"],
      "env": {
        "TIMEZEST_API_KEY": "your-key-here"
      }
    }
  }
}
```

---
