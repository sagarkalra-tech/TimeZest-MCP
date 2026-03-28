import { format, formatInTimeZone } from 'date-fns-tz';
import { differenceInHours, fromUnixTime } from 'date-fns';

export interface Appointment {
  id: string;
  status: "scheduled" | "sent" | "new" | "cancelled";
  appointment_type: string;
  appointment_type_id: string;
  engineer: string;
  engineer_id: string;
  dispatched_from_team: boolean;
  team_name?: string;
  start_time: string | null;
  start_time_local: string | null;
  duration_mins: number;
  end_user_name: string;
  end_user_email: string;
  ticket_number: string | null;
  ticket_type: "service_ticket" | "project_ticket" | null;
  company_id: number | null;
  contact_id: number | null;
  scheduling_url: string;
  created_at: string;
  updated_at: string;
  age_hours: number;
}

export function transformAppointment(
  raw: any,
  appointmentTypes: Map<string, string>,
  timezone: string = 'America/Chicago'
): Appointment {
  const createdAt = fromUnixTime(raw.created_at);
  const updatedAt = fromUnixTime(raw.updated_at);
  const startTime = raw.selected_start_time ? fromUnixTime(raw.selected_start_time) : null;

  // Engineer logic as per implementation plan
  let engineer = 'Unassigned';
  let engineerId = 'unassigned';
  if (raw.scheduled_agents && raw.scheduled_agents.length > 0) {
    engineer = raw.scheduled_agents[0].name;
    engineerId = raw.scheduled_agents[0].id;
  } else if (raw.resources && raw.resources.length > 0) {
    // Only use resources for assignment name if it is an agent
    const firstResource = raw.resources[0];
    if (firstResource.object === 'agent') {
      engineer = firstResource.name;
      engineerId = firstResource.id;
    }
  }

  const dispatchedFromTeam = raw.resources?.some((r: any) => r.object === 'team') ?? false;
  const teamName = raw.resources?.find((r: any) => r.object === 'team')?.name;

  // Ticket logic
  const ticket = raw.associated_entities?.find((e: any) => e.type === 'connectwise_psa/service_ticket' || e.type === 'connectwise_psa/project_ticket');

  return {
    id: raw.id,
    status: raw.status,
    appointment_type: appointmentTypes.get(raw.appointment_type_id) ?? 'Unknown',
    appointment_type_id: raw.appointment_type_id,
    engineer,
    engineer_id: engineerId,
    dispatched_from_team: dispatchedFromTeam,
    team_name: teamName,
    start_time: startTime ? startTime.toISOString() : null,
    start_time_local: startTime ? formatInTimeZone(startTime, timezone, 'yyyy-MM-dd h:mm a zzz') : null,
    duration_mins: raw.duration_mins,
    end_user_name: raw.end_user_name,
    end_user_email: raw.end_user_email,
    ticket_number: ticket?.number ?? null,
    ticket_type: ticket?.type === 'connectwise_psa/service_ticket' ? 'service_ticket' : (ticket?.type === 'connectwise_psa/project_ticket' ? 'project_ticket' : null),
    company_id: raw.associated_entities?.find((e: any) => e.type === 'connectwise_psa/company')?.id ?? null,
    contact_id: raw.associated_entities?.find((e: any) => e.type === 'connectwise_psa/contact')?.id ?? null,
    scheduling_url: raw.scheduling_url,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    age_hours: differenceInHours(new Date(), createdAt)
  };
}
