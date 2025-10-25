import { ProjectDetailsContent } from './_components/project-details-content';

interface ProjectDetailsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailsPage({ params }: ProjectDetailsPageProps) {
  const { projectId } = await params;

  return <ProjectDetailsContent projectId={projectId} />;
}