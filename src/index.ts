#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { TimeZestClient } from "./client.js";
import { transformAppointment, Appointment } from "./utils/transform.js";
import { matchEngineer, filterByDateRange } from "./utils/filter.js";
import { 
  format,
  startOfDay,
  endOfDay,
  parseISO,
  isSameDay,
  differenceInHours,
  formatDistanceToNow
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const API_KEY = process.env.TIMEZEST_API_KEY || '';
if (!API_KEY) {
  process.stderr.write("Error: TIMEZEST_API_KEY is required.\n");
  process.exit(1);
}

const client = new TimeZestClient(API_KEY);

const server = new Server(
  {
    name: "timezest-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS: Tool[] = [
  {
    name: "get_todays_appointments",
    description: "The morning briefing tool. Returns confirmed appointments for today grouped by engineer, with pending unbooked requests listed separately.",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "Default: America/Chicago" }
      }
    }
  },
  {
    name: "list_appointments",
    description: "Flexible query across any date range with optional engineer and status filters.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        engineer_name: { type: "string", description: "Partial match, case-insensitive" },
        status: { type: "string", enum: ["scheduled", "sent", "new", "cancelled"] },
        timezone: { type: "string", description: "Default: America/Chicago" }
      },
      required: ["start_date", "end_date"]
    }
  },
  {
    name: "get_engineer_schedule",
    description: "All upcoming appointments for a named engineer, sorted by time.",
    inputSchema: {
      type: "object",
      properties: {
        engineer_name: { type: "string" },
        days_ahead: { type: "number", default: 7 },
        include_pending: { type: "boolean", default: true }
      },
      required: ["engineer_name"]
    }
  },
  {
    name: "list_pending_requests",
    description: "All unbooked invitations (sent and new). Returns age in hours/days.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", default: 14 },
        engineer_name: { type: "string" },
        older_than_hours: { type: "number" }
      }
    }
  },
  {
    name: "find_appointment_by_ticket",
    description: "Find appointments linked to a ConnectWise ticket number.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_number: { type: "string", description: "e.g. 964400 or #964400" }
      },
      required: ["ticket_number"]
    }
  },
  {
    name: "get_appointment_types",
    description: "List all appointment type definitions.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_appointment_stats",
    description: "Aggregate summary of appointment data.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", default: 14 },
        days_forward: { type: "number", default: 30 }
      }
    }
  },
  {
    name: "list_cancelled_appointments",
    description: "Cancelled requests with scheduling URLs for rebooking.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", default: 7 },
        engineer_name: { type: "string" }
      }
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let appointmentTypes: Map<string, string>;
  let all: Appointment[];
  const tz = (args?.timezone as string) || process.env.TIMEZEST_DEFAULT_TZ || 'America/Chicago';

  try {
    appointmentTypes = await client.getAppointmentTypes();

    // Determine fetch window from tool-specific args
    const daysBack = args?.days_back as number | undefined;
    const daysForward = args?.days_forward as number | undefined;
    const rawRequests = await client.getSchedulingRequests(daysBack, daysForward);
    all = rawRequests.map(r => transformAppointment(r, appointmentTypes, tz));
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }

  switch (name) {
    case "get_todays_appointments": {
      const today = new Date();
      const scheduled = all.filter(a => a.status === 'scheduled' && a.start_time && isSameDay(parseISO(a.start_time), today));
      const pending = all.filter(a => (a.status === 'sent' || a.status === 'new'));

      const grouped: any = {};
      scheduled.forEach(s => {
        if (!grouped[s.engineer]) grouped[s.engineer] = [];
        grouped[s.engineer].push(`${s.start_time_local} ${s.appointment_type} - ${s.end_user_name}, ${s.ticket_number}`);
      });

      let response = `Today's Briefing (${formatInTimeZone(today, tz, 'yyyy-MM-dd')})\n\nConfirmed:\n`;
      if (Object.keys(grouped).length === 0) response += "  None\n";
      for (const [eng, apps] of Object.entries(grouped)) {
        response += `  ${eng}:\n`;
        (apps as string[]).forEach(a => response += `    ${a}\n`);
      }

      response += `\nPending (Not yet booked):\n`;
      if (pending.length === 0) response += "  None\n";
      pending.forEach(p => {
        response += `  ${p.engineer} — ${p.end_user_name} (${p.status}) — sent ${format(parseISO(p.created_at), 'MMM dd')} [${formatDistanceToNow(parseISO(p.created_at))} old]\n`;
      });

      return { content: [{ type: "text", text: response }] };
    }

    case "list_appointments": {
      const start = args?.start_date as string;
      const end = args?.end_date as string;
      const engName = args?.engineer_name as string;
      const status = args?.status as string;

      let filtered = all;
      if (start && end) filtered = filterByDateRange(filtered, start, end);
      if (engName) filtered = filtered.filter(a => matchEngineer(a, engName));
      if (status) filtered = filtered.filter(a => a.status === status);

      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }

    case "get_engineer_schedule": {
      const engName = args?.engineer_name as string;
      const includePending = args?.include_pending !== false;
      
      let filtered = all.filter(a => matchEngineer(a, engName));
      if (!includePending) filtered = filtered.filter(a => a.status === 'scheduled');
      
      filtered.sort((a, b) => {
        const timeA = a.start_time || a.created_at;
        const timeB = b.start_time || b.created_at;
        return timeA.localeCompare(timeB);
      });

      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }

    case "list_pending_requests": {
      const engName = args?.engineer_name as string;
      const hours = args?.older_than_hours as number;
      
      let pending = all.filter(a => a.status === 'sent' || a.status === 'new');
      if (engName) pending = pending.filter(a => matchEngineer(a, engName));
      if (hours) pending = pending.filter(a => a.age_hours >= hours);
      
      return { content: [{ type: "text", text: JSON.stringify(pending, null, 2) }] };
    }

    case "find_appointment_by_ticket": {
      const tNum = (args?.ticket_number as string).replace('#', '');
      const filtered = all.filter(a => a.ticket_number?.replace('#', '') === tNum);
      
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }

    case "get_appointment_types": {
      const sorted = Array.from(appointmentTypes.entries()).sort((a, b) => a[1].localeCompare(b[1]));
      let text = "ID | Name\n---|---\n";
      sorted.forEach(([id, name]) => {
        text += `${id} | ${name}\n`;
      });
      return { content: [{ type: "text", text }] };
    }

    case "get_appointment_stats": {
      const stats = {
        total: all.length,
        by_status: { scheduled: 0, sent: 0, new: 0, cancelled: 0 },
        by_engineer: {} as Record<string, { scheduled: number; pending: number }>,
        today: { confirmed: 0, pending: 0, total_minutes: 0 },
        oldest_pending_days: 0,
        type_breakdown: {} as Record<string, number>
      };

      const today = new Date();
      all.forEach(a => {
        // @ts-ignore
        if (stats.by_status[a.status] !== undefined) stats.by_status[a.status]++;
        
        if (!stats.by_engineer[a.engineer]) stats.by_engineer[a.engineer] = { scheduled: 0, pending: 0 };
        if (a.status === 'scheduled') stats.by_engineer[a.engineer].scheduled++;
        else if (a.status === 'sent' || a.status === 'new') stats.by_engineer[a.engineer].pending++;

        if (a.status === 'scheduled' && a.start_time && isSameDay(parseISO(a.start_time), today)) {
          stats.today.confirmed++;
          stats.today.total_minutes += a.duration_mins;
        } else if ((a.status === 'sent' || a.status === 'new') && isSameDay(parseISO(a.created_at), today)) {
          stats.today.pending++;
        }

        if (a.status === 'sent' || a.status === 'new') {
          const days = Math.floor(a.age_hours / 24);
          if (days > stats.oldest_pending_days) stats.oldest_pending_days = days;
        }

        stats.type_breakdown[a.appointment_type] = (stats.type_breakdown[a.appointment_type] || 0) + 1;
      });

      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    }

    case "list_cancelled_appointments": {
      const engName = args?.engineer_name as string;
      let cancelled = all.filter(a => a.status === 'cancelled');
      if (engName) cancelled = cancelled.filter(a => matchEngineer(a, engName));
      
      return { content: [{ type: "text", text: JSON.stringify(cancelled, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("TimeZest MCP Server started.\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
