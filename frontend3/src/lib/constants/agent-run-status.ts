/**
 * Agent Run Status Constants
 * Matches backend AgentRunStatus enum
 */
export const AgentRunStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type AgentRunStatusType = typeof AgentRunStatus[keyof typeof AgentRunStatus];

/**
 * Helper to check if a run is active (still executing)
 */
export const isActiveStatus = (status: string): boolean => {
  return [AgentRunStatus.PENDING, AgentRunStatus.RUNNING, AgentRunStatus.PROCESSING].includes(status as any);
};

/**
 * Helper to check if a run can be retried
 */
export const canRetryStatus = (status: string): boolean => {
  return [AgentRunStatus.FAILED, AgentRunStatus.CANCELLED].includes(status as any);
};

/**
 * Helper to check if a run is terminal (finished)
 */
export const isTerminalStatus = (status: string): boolean => {
  return [AgentRunStatus.COMPLETED, AgentRunStatus.FAILED, AgentRunStatus.CANCELLED].includes(status as any);
};

