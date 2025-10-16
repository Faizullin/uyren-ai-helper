import { Metadata, ResolvingMetadata } from "next";
import { trpc } from "@/utils/trpc";
import { trpcCaller } from "@/server/api/_app";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;

  // Fetch course details for better metadata
  try {
    const course =
      await trpcCaller.lmsModule.courseModule.course.getByCourseDetailed({
        courseId: id,
      });

    if (course?.title) {
      return {
        title: `${course.title} | ${(await parent)?.title?.absolute}`,
      };
    }
  } catch (error) {
    console.error("Error fetching course for metadata:", error);
  }

  // Fallback to ID if course details unavailable
  return {
    title: `Product [#${id}] ${(await parent)?.title?.absolute}`,
  };
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
