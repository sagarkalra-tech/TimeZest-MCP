import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeZestClient } from '../client.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('TimeZestClient', () => {
  let client: TimeZestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new TimeZestClient('test-api-key', { maxRetries: 1, retryDelayMs: 10 });
  });

  describe('getAppointmentTypes', () => {
    it('fetches and caches appointment types', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          { id: 'apty_1', internal_name: 'Remote Access' },
          { id: 'apty_2', name: 'Phone Call' },
        ],
      });

      const types = await client.getAppointmentTypes();
      expect(types.get('apty_1')).toBe('Remote Access');
      expect(types.get('apty_2')).toBe('Phone Call');

      // Second call should use cache — no additional HTTP request
      const types2 = await client.getAppointmentTypes();
      expect(types2.size).toBe(2);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('prefers internal_name over name', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ id: 'apty_1', internal_name: 'Internal', name: 'External' }],
      });

      const types = await client.getAppointmentTypes();
      expect(types.get('apty_1')).toBe('Internal');
    });

    it('throws a descriptive error on API failure', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Unauthorized' } },
      });

      await expect(client.getAppointmentTypes()).rejects.toThrow(/401/);
    });
  });

  describe('getSchedulingRequests', () => {
    it('fetches scheduling requests with date window params', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { scheduling_requests: [{ id: 'sreq_1' }] },
      });

      const results = await client.getSchedulingRequests(7, 14);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('sreq_1');

      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams).toHaveProperty('created_at_after');
      expect(callParams).toHaveProperty('created_at_before');
      expect(callParams.page).toBe(1);
    });
  });

  describe('retry logic', () => {
    it('retries on 429 rate limit', async () => {
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 429, headers: {} } })
        .mockResolvedValueOnce({ data: [{ id: 'apty_1', name: 'Test' }] });

      const types = await client.getAppointmentTypes();
      expect(types.size).toBe(1);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('retries on 500 server error', async () => {
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({ data: [{ id: 'apty_1', name: 'Test' }] });

      const types = await client.getAppointmentTypes();
      expect(types.size).toBe(1);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 400 client error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 400, data: { message: 'Bad Request' } },
      });

      await expect(client.getAppointmentTypes()).rejects.toBeTruthy();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and throws', async () => {
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Down' } } });

      await expect(client.getAppointmentTypes()).rejects.toThrow(/500/);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });
  });
});
