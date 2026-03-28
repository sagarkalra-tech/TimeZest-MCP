import axios from 'axios';
import { subDays, addDays, getUnixTime } from 'date-fns';

export class TimeZestClient {
  private apiKey: string;
  private baseUrl = 'https://api.timezest.com/v1';
  private appointmentTypes: Map<string, string> = new Map();
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(apiKey: string, { maxRetries = 3, retryDelayMs = 1000 } = {}) {
    this.apiKey = apiKey;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
  }

  private async fetchWithRetry(url: string, config: any): Promise<any> {
    let lastError: any;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await axios.get(url, config);
      } catch (error: any) {
        lastError = error;
        const status = error?.response?.status;
        // Only retry on network errors, 429, or 5xx
        if (status && status !== 429 && status < 500) throw error;
        if (attempt < this.maxRetries) {
          const delay = status === 429
            ? (parseInt(error.response?.headers?.['retry-after'] || '0', 10) * 1000 || this.retryDelayMs * (attempt + 1))
            : this.retryDelayMs * (attempt + 1);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  private async fetchAllPages(endpoint: string, params: any = {}): Promise<any[]> {
    const results: any[] = [];
    let page = 1;
    let url = `${this.baseUrl}${endpoint}`;

    while (true) {
      const response = await this.fetchWithRetry(url, {
        params: { ...params, page },
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 30000
      });

      const data = response.data;
      // Handle both flat arrays and wrapped responses (e.g., { scheduling_requests: [...] })
      let items: any[];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        // Find the first array value in the response object
        const arrayValue = Object.values(data).find(v => Array.isArray(v)) as any[] | undefined;
        if (arrayValue) {
          items = arrayValue;
        } else {
          throw new Error(`Unexpected API response format from ${endpoint}: ${JSON.stringify(data).slice(0, 200)}`);
        }
      } else {
        throw new Error(`Unexpected API response format from ${endpoint}: ${typeof data}`);
      }

      results.push(...items);
      if (items.length < 50) break;
      page++;
    }
    return results;
  }

  public async getAppointmentTypes(): Promise<Map<string, string>> {
    if (this.appointmentTypes.size > 0) return this.appointmentTypes;

    try {
      const types = await this.fetchAllPages('/appointment_types');
      types.forEach((t: any) => {
        this.appointmentTypes.set(t.id, t.internal_name ?? t.name ?? `(unnamed – ${t.id})`);
      });
      return this.appointmentTypes;
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || String(error);
      throw new Error(`TimeZest API error fetching appointment types (HTTP ${status || 'unknown'}): ${msg}`);
    }
  }

  /**
   * Fetches scheduling requests for a configurable window by created_at.
   * Falls back to env vars TIMEZEST_WINDOW_DAYS_BACK / TIMEZEST_WINDOW_DAYS_FORWARD,
   * then to 14 / 30 defaults.
   */
  public async getSchedulingRequests(daysBack?: number, daysForward?: number): Promise<any[]> {
    const back = daysBack ?? parseInt(process.env.TIMEZEST_WINDOW_DAYS_BACK || '14', 10);
    const forward = daysForward ?? parseInt(process.env.TIMEZEST_WINDOW_DAYS_FORWARD || '30', 10);

    const now = new Date();
    const start = subDays(now, back);
    const end = addDays(now, forward);

    // API limits filters to created_at
    const params = {
      created_at_after: getUnixTime(start),
      created_at_before: getUnixTime(end)
    };

    try {
      return await this.fetchAllPages('/scheduling_requests', params);
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || String(error);
      throw new Error(`TimeZest API error fetching scheduling requests (HTTP ${status || 'unknown'}): ${msg}`);
    }
  }
}
