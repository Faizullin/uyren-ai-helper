export const threadKeys = {
  all: ['threads'] as const,
  lists: () => [...threadKeys.all, 'list'] as const,
  list: (filters: string) => [...threadKeys.lists(), { filters }] as const,
  details: () => [...threadKeys.all, 'detail'] as const,
  detail: (id: string) => [...threadKeys.details(), id] as const,
  messages: (threadId: string) => [...threadKeys.detail(threadId), 'messages'] as const,
  agentRuns: (threadId: string) => [...threadKeys.detail(threadId), 'agentRuns'] as const,
};
