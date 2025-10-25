import { AgentRunLogsPage } from './agent-run-logs-page';

interface AgentRunLogsPageProps {
  params: Promise<{
    projectId: string;
    threadId: string;
    runId: string;
  }>;
}

export default async function AgentRunLogsPageRoute({ params }: AgentRunLogsPageProps) {
  const { projectId, threadId, runId } = await params;
  return <AgentRunLogsPage projectId={projectId} threadId={threadId} runId={runId} />;
}