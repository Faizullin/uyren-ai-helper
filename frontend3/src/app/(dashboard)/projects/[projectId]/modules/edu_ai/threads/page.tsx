import { ThreadsListPage } from './threads-list-page';

interface ThreadsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ThreadsPage({ params }: ThreadsPageProps) {
  const { projectId } = await params;
  return <ThreadsListPage projectId={projectId} />;
}