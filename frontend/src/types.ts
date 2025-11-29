export type PortStatus = 'open' | 'closed' | 'filtered';

export interface ScanRequest {
  target: string;
  ports: number[];
}

export interface PortResult {
  port: number;
  status: PortStatus;
  latency_ms?: number;
}

export interface ScanResponse {
  target: string;
  ip: string;
  results: PortResult[];
  timestamp: string;
}
