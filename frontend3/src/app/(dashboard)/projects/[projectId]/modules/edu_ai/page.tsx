import { ModuleDetailsContent } from './_components/module-details-content';

interface ModuleDetailsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ModuleDetailsPage({ params }: ModuleDetailsPageProps) {
  const { projectId } = await params;
  return <ModuleDetailsContent projectId={projectId} />;
}
