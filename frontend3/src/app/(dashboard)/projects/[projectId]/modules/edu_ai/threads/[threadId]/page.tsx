import { ProjectThreadContent } from '../../../../threads/[threadId]/_components/project-thread-content';

interface EduAiThreadPageProps {
  params: Promise<{
    projectId: string;
    threadId: string;
  }>;
}

export default async function EduAiThreadPage({ params }: EduAiThreadPageProps) {
  const { projectId, threadId } = await params;

  return <ProjectThreadContent projectId={projectId} threadId={threadId} />;
}

