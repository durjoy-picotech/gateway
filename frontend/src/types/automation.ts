// Automation & Jobs Types

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type JobType = 'SCHEDULED' | 'MANUAL' | 'WEBHOOK' | 'NOTIFICATION';
export type ScheduleType = 'CRON' | 'INTERVAL' | 'ONE_TIME';

export interface ScheduledJob {
  job_id: string;
  name: string;
  type: 'RESERVE_RELEASE' | 'PENALTY_ASSESSMENT' | 'SETTLEMENT_BATCH' | 'RECONCILIATION_IMPORT';
  schedule_type: ScheduleType;
  cron_expression?: string; // For CRON schedules
  interval_seconds?: number; // For INTERVAL schedules
  next_run_at: string;
  last_run_at?: string;
  last_run_status?: JobStatus;
  enabled: boolean;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  config: Record<string, any>; // Job-specific configuration
  created_at: string;
  updated_at: string;
}

export interface ManualJob {
  job_id: string;
  name: string;
  type: 'RESET_DAILY_COUNTERS' | 'NIGHTLY_STATEMENT_DOWNLOAD' | 'UNMATCHED_REMINDER';
  status: JobStatus;
  progress?: number; // 0-100
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfig {
  webhook_id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timeout_seconds: number;
  retry_count: number;
  retry_delay_seconds: number;
  events: string[]; // Event types to trigger webhook
  enabled: boolean;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  created_at: string;
  updated_at: string;
}


export interface JobExecution {
  execution_id: string;
  job_id: string;
  job_type: JobType;
  status: JobStatus;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  records_processed?: number;
  records_failed?: number;
  error_message?: string;
  logs: string[];
  created_at: string;
}