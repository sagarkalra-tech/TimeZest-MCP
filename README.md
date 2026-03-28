# 📅 TimeZest MCP Server

An MCP (Model Context Protocol) server that brings **TimeZest** scheduling data (confirmed appointments, pending invitations, and ticket-linked schedules) directly into your Claude conversations.

---

## 📋 Prerequisites (One-Time Setup)

Before you begin, ensure you have **Node.js** installed on your machine. This is what allows Claude to run the server.

1.  **Download Node.js**: [Download here (v18 or higher recommended)](https://nodejs.org/)
2.  **Verify**: Open a terminal and type `node -v` to confirm it's installed.

---

## 🚀 How to Install (For Colleagues)

You don't need to download or build any code. You can run this directly using `npx`.

### Option A — Claude Desktop (Standard)
Open your Claude Desktop configuration file:
- **Windows:** `%AppData%\Roaming\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add this entry to the `mcpServers` section:

**Windows:**
```json
{
  "mcpServers": {
    "timezest": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "timezest-mcp@latest"],
      "env": {
        "TIMEZEST_API_KEY": "YOUR_API_KEY_HERE",
        "TIMEZEST_DEFAULT_TZ": "America/Chicago"
      }
    }
  }
}
```

**macOS / Linux:**
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

### Option B — Claude Code (CLI)
If you use the terminal-based **Claude Code**, run this single command to add the server globally:

**Windows:**
```bash
claude mcp add-json timezest "{\"type\": \"stdio\", \"command\": \"cmd\", \"args\": [\"/c\", \"npx\", \"-y\", \"timezest-mcp@latest\"], \"env\": {\"TIMEZEST_API_KEY\": \"YOUR_API_KEY_HERE\", \"TIMEZEST_DEFAULT_TZ\": \"America/Chicago\"}}"
```

**macOS / Linux:**
```bash
claude mcp add-json timezest '{"type": "stdio", "command": "npx", "args": ["-y", "timezest-mcp@latest"], "env": {"TIMEZEST_API_KEY": "YOUR_API_KEY_HERE", "TIMEZEST_DEFAULT_TZ": "America/Chicago"}}'
```

---

## 💡 Example Prompts
Once connected, try asking Claude:
- *"What's the briefing for today?"*
- *"Show me Aaron's schedule for next week"*
- *"Find any TimeZest requests for ticket #964400"*
- *"Who has the oldest pending invitations?"*
- *"Give me the appointment stats for the last 14 days"*
- *"Show me recently cancelled appointments for Isam"*

---

## 🛠️ Available Tools

| Tool | What It Does |
|------|-------------|
| `get_todays_appointments` | Morning briefing: Confirmed today vs. pending unbooked |
| `list_appointments` | Flexible range search with engineer and status filters |
| `get_engineer_schedule` | Sorted timeline for a specific engineer |
| `list_pending_requests` | Follow up on `sent` and `new` (unbooked) invitations |
| `find_appointment_by_ticket` | Instant lookup using ConnectWise ticket numbers |
| `get_appointment_types` | List all available scheduling types (ID vs Name) |
| `get_appointment_stats` | Management summary: Counts, minutes, and oldest pending |
| `list_cancelled_appointments` | Triage cancelled requests for rebooking |

---

## 📦 Technical Info
- **Package Name:** `timezest-mcp`
- **Platform:** Node.js (v18+)
- **Environment Variables**:
    - `TIMEZEST_API_KEY` (Required): Your TimeZest Bearer token.
    - `TIMEZEST_DEFAULT_TZ` (Optional): Default IANA timezone (e.g. `America/Chicago`).
- **Developer:** Sagar Kalra

---

## 📄 License
MIT © 2026 Sagar Kalra.
