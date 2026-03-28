import { describe, it, expect } from 'vitest';
import { transformAppointment } from '../utils/transform.js';

const appointmentTypes = new Map([
  ['apty_123', 'Remote Access to PC'],
  ['apty_456', 'Phone Call'],
]);

function makeRawRequest(overrides: any = {}) {
  return {
    id: 'sreq_abc',
    status: 'scheduled',
    appointment_type_id: 'apty_123',
    created_at: 1711382400, // 2024-03-25T16:00:00Z
    updated_at: 1711382400,
    selected_start_time: 1711468800, // 2024-03-26T16:00:00Z
    duration_mins: 30,
    end_user_name: 'John Doe',
    end_user_email: 'john@example.com',
    scheduling_url: 'https://test.timezest.com/schedule/abc',
    scheduled_agents: [{ id: 'agnt_1', name: 'Scout Kalra' }],
    resources: [{ id: 'agnt_1', name: 'Scout Kalra', object: 'agent' }],
    associated_entities: [
      { type: 'connectwise_psa/service_ticket', number: '#12345' },
      { type: 'connectwise_psa/company', id: 100 },
      { type: 'connectwise_psa/contact', id: 200 },
    ],
    ...overrides,
  };
}

describe('transformAppointment', () => {
  it('transforms a scheduled appointment with all fields', () => {
    const result = transformAppointment(makeRawRequest(), appointmentTypes, 'America/Chicago');

    expect(result.id).toBe('sreq_abc');
    expect(result.status).toBe('scheduled');
    expect(result.appointment_type).toBe('Remote Access to PC');
    expect(result.engineer).toBe('Scout Kalra');
    expect(result.engineer_id).toBe('agnt_1');
    expect(result.duration_mins).toBe(30);
    expect(result.end_user_name).toBe('John Doe');
    expect(result.end_user_email).toBe('john@example.com');
    expect(result.ticket_number).toBe('#12345');
    expect(result.ticket_type).toBe('service_ticket');
    expect(result.company_id).toBe(100);
    expect(result.contact_id).toBe(200);
    expect(result.start_time).toBeTruthy();
    expect(result.start_time_local).toBeTruthy();
    expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.age_hours).toBeGreaterThan(0);
  });

  it('resolves engineer from scheduled_agents first', () => {
    const result = transformAppointment(makeRawRequest({
      scheduled_agents: [{ id: 'agnt_A', name: 'Agent A' }],
      resources: [{ id: 'agnt_B', name: 'Agent B', object: 'agent' }],
    }), appointmentTypes);

    expect(result.engineer).toBe('Agent A');
    expect(result.engineer_id).toBe('agnt_A');
  });

  it('falls back to resources when no scheduled_agents', () => {
    const result = transformAppointment(makeRawRequest({
      scheduled_agents: [],
      resources: [{ id: 'agnt_B', name: 'Agent B', object: 'agent' }],
    }), appointmentTypes);

    expect(result.engineer).toBe('Agent B');
  });

  it('returns Unassigned when no agent available', () => {
    const result = transformAppointment(makeRawRequest({
      scheduled_agents: [],
      resources: [{ id: 'team_1', name: 'MSP Team', object: 'team' }],
    }), appointmentTypes);

    expect(result.engineer).toBe('Unassigned');
    expect(result.dispatched_from_team).toBe(true);
    expect(result.team_name).toBe('MSP Team');
  });

  it('handles null start_time for pending requests', () => {
    const result = transformAppointment(makeRawRequest({
      status: 'sent',
      selected_start_time: null,
    }), appointmentTypes);

    expect(result.start_time).toBeNull();
    expect(result.start_time_local).toBeNull();
  });

  it('resolves project_ticket type', () => {
    const result = transformAppointment(makeRawRequest({
      associated_entities: [
        { type: 'connectwise_psa/project_ticket', number: '#999' },
      ],
    }), appointmentTypes);

    expect(result.ticket_type).toBe('project_ticket');
    expect(result.ticket_number).toBe('#999');
  });

  it('handles unknown appointment type gracefully', () => {
    const result = transformAppointment(makeRawRequest({
      appointment_type_id: 'apty_unknown',
    }), appointmentTypes);

    expect(result.appointment_type).toBe('Unknown');
  });

  it('handles missing associated_entities', () => {
    const result = transformAppointment(makeRawRequest({
      associated_entities: [],
    }), appointmentTypes);

    expect(result.ticket_number).toBeNull();
    expect(result.ticket_type).toBeNull();
    expect(result.company_id).toBeNull();
    expect(result.contact_id).toBeNull();
  });
});
