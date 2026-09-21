import { SessionStatus } from '../types.js';

export interface ISessionStore {
  getSessionStatus(): Promise<SessionStatus>;
  saveSession(sessionData: { cookies: Record<string, string>; user_id?: string }): Promise<SessionStatus>;
  clearSession(): Promise<void>;
}

export class InMemorySessionStore implements ISessionStore {
  private status: SessionStatus = {
    is_valid: true, // Default to active for dev/demo mode
    user_id: 'lazada-user-888',
    last_authenticated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    provider: 'Lazada SG'
  };

  async getSessionStatus(): Promise<SessionStatus> {
    return this.status;
  }

  async saveSession(sessionData: { cookies: Record<string, string>; user_id?: string }): Promise<SessionStatus> {
    this.status = {
      is_valid: true,
      user_id: sessionData.user_id || 'lazada-user-888',
      last_authenticated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      provider: 'Lazada SG'
    };
    return this.status;
  }

  async clearSession(): Promise<void> {
    this.status = {
      is_valid: false,
      provider: 'Lazada SG'
    };
  }
}
