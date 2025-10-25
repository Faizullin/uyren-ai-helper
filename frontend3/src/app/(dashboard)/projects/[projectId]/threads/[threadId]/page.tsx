import { ProjectThreadContent } from './_components/project-thread-content';

interface ProjectThreadPageProps {
  params: Promise<{
    projectId: string;
    threadId: string;
  }>;
}

export default async function ProjectThreadPage({ params }: ProjectThreadPageProps) {
  const { projectId, threadId } = await params;

  return <ProjectThreadContent projectId={projectId} threadId={threadId} />;
}