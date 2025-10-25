import { ThreadDetailPage } from './thread-detail-page';

interface ThreadDetailPageProps {
  params: Promise<{
    projectId: string;
    threadId: string;
  }>;
}

export default async function ThreadDetailPageRoute({ params }: ThreadDetailPageProps) {
  const { projectId, threadId } = await params;
  return <ThreadDetailPage projectId={projectId} threadId={threadId} />;
}