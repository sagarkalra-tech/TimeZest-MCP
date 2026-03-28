import { isWithinInterval, parseISO } from 'date-fns';
import { Appointment } from './transform.js';

export function matchEngineer(appointment: Appointment, query: string): boolean {
  const normQuery = query.toLowerCase();
  const engineerName = appointment.engineer.toLowerCase();
  
  if (engineerName.includes(normQuery)) return true;
  if (appointment.team_name?.toLowerCase().includes(normQuery)) return true;
  
  return false;
}

export function filterByDateRange(
  appointments: Appointment[],
  startDate: string,
  endDate: string
): Appointment[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  return appointments.filter(a => {
    // Use start_time for scheduled appointments, fall back to created_at for pending
    const dateStr = a.start_time || a.created_at;
    if (!dateStr) return false;
    const date = parseISO(dateStr);
    return isWithinInterval(date, { start, end });
  });
}
