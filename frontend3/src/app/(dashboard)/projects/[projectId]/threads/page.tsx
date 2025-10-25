import { ProjectThreadsContent } from './_components/project-threads-content';

interface ProjectThreadsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectThreadsPage({ params }: ProjectThreadsPageProps) {
  const { projectId } = await params;

  return <ProjectThreadsContent projectId={projectId} />;
}