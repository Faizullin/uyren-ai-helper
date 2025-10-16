import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { AssignmentModel } from "@workspace/common-logic/models/lms/assignment.model";
import { Metadata, ResolvingMetadata } from "next";
import AssignmentClientWrapper from "../_components/assignment-client-wrapper";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const title = id === "new" ? "New Assignment" : `Assignment ${id}`;
  return {
    title: `${title} | Assignments | LMS | ${(await parent)?.title?.absolute}`,
  };
}

async function getAssignmentData(id: string) {
  if (id === "new") {
    return null;
  }

  try {
    await connectToDatabase();
    const assignment = await AssignmentModel.findById(id).lean();
    return assignment
      ? JSON.parse(
        JSON.stringify({
          ...assignment,
        }),
      )
      : null;
  } catch (error) {
    console.error("Error fetching assignment:", error);
    return null;
  }
}

export default async function EditAssignmentPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const assignmentId = params.id !== "new" ? params.id : null;
  const initialMode = assignmentId !== null ? "edit" : "create";
  const initialAssignmentData = assignmentId
    ? await getAssignmentData(params.id)
    : null;

  return (
    <AssignmentClientWrapper
      initialMode={initialMode}
      initialAssignmentData={initialAssignmentData}
    />
  );
}
