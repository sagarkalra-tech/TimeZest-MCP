# 📅 TimeZest MCP Server

Bring your **TimeZest** scheduling data directly into Claude through the Model Context Protocol (MCP). Perform real-time scheduling lookups, engineer briefings, and ticket-linked appointment management without leaving your chat.

---

## 🌟 Features

- **Morning Briefings**: Instantly get confirmed vs. pending invitations for today, grouped by engineer.
- **Ticket Lookups**: Look up appointments by their original ConnectWise ticket number (e.g. #964400).
- **Engineer Schedules**: View upcoming timelines for specific staff members.
- **Pending Follow-ups**: Identify aging, unbooked invitations to prevent ticket stall.
- **Cancellation Insights**: Quickly triage cancelled requests for rebooking.
- **Enterprise Ready**: Full support for timezone transformations (TZ) and automated Vitest testing suite.

---

## 📋 Prerequisites

- **Node.js** (v18 or higher) — Required to run the server via `npx`.
- **TimeZest API Key** — A Bearer token from your TimeZest integration page.

---

## 🚀 Installation & Setup

You don't need to download or build the source code to use this. You can run it directly using `npx`.

### Option 1: Claude Desktop (GUI)
Open your Claude Desktop configuration file:
- **Windows:** `%AppData%\Roaming\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following entry to the `mcpServers` object:

```json
{
  "mcpServers": {
    "timezest": {
      "command": "npx",
      "args": ["-y", "timezest-mcp@latest"],
      "env": {
        "TIMEZEST_API_KEY": "YOUR_API_KEY_HERE",
        "TIMEZEST_DEFAULT_TZ": "America/Chicago"
      }
    }
  }
}
```
*(Windows Users: If `npx` is not in your system path, you can use `"command": "cmd", "args": ["/c", "npx", "-y", "timezest-mcp@latest"]` instead.)*

### Option 2: Claude Code (CLI)
Run this single command in your terminal to add the server globally:

```bash
# Windows
claude mcp add-json timezest "{\"type\": \"stdio\", \"command\": \"cmd\", \"args\": [\"/c\", \"npx\", \"-y\", \"timezest-mcp@latest\"], \"env\": {\"TIMEZEST_API_KEY\": \"YOUR_API_KEY\", \"TIMEZEST_DEFAULT_TZ\": \"America/Chicago\"}}"

# macOS / Linux
claude mcp add-json timezest '{"type": "stdio", "command": "npx", "args": ["-y", "timezest-mcp@latest"], "env": {"TIMEZEST_API_KEY": "YOUR_API_KEY", "TIMEZEST_DEFAULT_TZ": "America/Chicago"}}'
```

---

## 💡 Example Prompts

Once connected, try asking Claude:
- *"What's the briefing for today?"*
- *"Show me Scout's schedule for next week"*
- *"Find any TimeZest requests for ticket #964400"*
- *"Provide appointment stats for the last 14 days"*
- *"Show me recently cancelled appointments for rebooking"*

---

## 🛠️ Available Tools

| Tool | Purpose |
|------|---------|
| `get_todays_appointments` | Morning briefing: Confirmed today vs. pending unbooked |
| `list_appointments` | Flexible range search with engineer and status filters |
| `get_engineer_schedule` | Sorted timeline for a specific engineer |
| `list_pending_requests` | Follow up on `sent` and `new` (unbooked) invitations |
| `find_appointment_by_ticket` | Instant lookup using source ticket numbers |
| `get_appointment_stats` | Management summary: Counts, minutes, and aging requests |
| `list_cancelled_appointments` | Triage cancelled requests with rebooking URLs |

---

## ⚙️ Configuration

- `TIMEZEST_API_KEY` (Required): Your TimeZest Bearer token.
- `TIMEZEST_DEFAULT_TZ` (Optional): Default IANA timezone (e.g. `America/Chicago`).

---

## 📄 License

MIT © 2026 Sagar Kalra.
