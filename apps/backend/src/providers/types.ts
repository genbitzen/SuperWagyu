import { LazadaCheckResult } from '../types.js';

export interface ILazadaProvider {
  name: string;
  checkAvailability(urlOrId: string): Promise<LazadaCheckResult>;
}
