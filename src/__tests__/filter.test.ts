import { describe, it, expect } from 'vitest';
import { matchEngineer, filterByDateRange } from '../utils/filter.js';
import { Appointment } from '../utils/transform.js';

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'sreq_1',
    status: 'scheduled',
    appointment_type: 'Remote Access to PC',
    appointment_type_id: 'apty_1',
    engineer: 'Scout Kalra',
    engineer_id: 'agnt_1',
    dispatched_from_team: false,
    start_time: '2026-03-25T15:00:00.000Z',
    start_time_local: '2026-03-25 10:00 AM GMT-5',
    duration_mins: 30,
    end_user_name: 'John Doe',
    end_user_email: 'john@example.com',
    ticket_number: '#12345',
    ticket_type: 'service_ticket',
    company_id: 100,
    contact_id: 200,
    scheduling_url: 'https://test.timezest.com/schedule/abc',
    created_at: '2026-03-24T12:00:00.000Z',
    updated_at: '2026-03-24T12:00:00.000Z',
    age_hours: 24,
    ...overrides,
  };
}

describe('matchEngineer', () => {
  it('matches by partial engineer name (case-insensitive)', () => {
    expect(matchEngineer(makeAppointment(), 'scout')).toBe(true);
    expect(matchEngineer(makeAppointment(), 'Scout')).toBe(true);
    expect(matchEngineer(makeAppointment(), 'KALRA')).toBe(true);
  });

  it('matches by team name', () => {
    const appt = makeAppointment({ dispatched_from_team: true, team_name: 'MSP Red Team' });
    expect(matchEngineer(appt, 'red team')).toBe(true);
    expect(matchEngineer(appt, 'MSP')).toBe(true);
  });

  it('returns false for non-matching query', () => {
    expect(matchEngineer(makeAppointment(), 'Aaron')).toBe(false);
  });
});

describe('filterByDateRange', () => {
  const appointments = [
    makeAppointment({ id: '1', start_time: '2026-03-24T10:00:00.000Z' }),
    makeAppointment({ id: '2', start_time: '2026-03-25T10:00:00.000Z' }),
    makeAppointment({ id: '3', start_time: '2026-03-26T10:00:00.000Z' }),
    makeAppointment({ id: '4', start_time: '2026-03-27T10:00:00.000Z' }),
  ];

  it('filters appointments within date range', () => {
    // end date parses as midnight, so only 3/25 10:00 AM fits within 3/25–3/26T00:00
    const result = filterByDateRange(appointments, '2026-03-24', '2026-03-27');
    expect(result.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  it('returns empty array when no appointments match', () => {
    const result = filterByDateRange(appointments, '2026-04-01', '2026-04-05');
    expect(result).toEqual([]);
  });

  it('uses created_at for pending appointments with no start_time', () => {
    const pending = [
      makeAppointment({ id: 'p1', status: 'sent', start_time: null, created_at: '2026-03-25T10:00:00.000Z' }),
    ];
    const result = filterByDateRange(pending, '2026-03-25', '2026-03-26');
    expect(result.map(a => a.id)).toEqual(['p1']);
  });
});
