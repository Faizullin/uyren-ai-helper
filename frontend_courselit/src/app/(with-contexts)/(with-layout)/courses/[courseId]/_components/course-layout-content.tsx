"use client";

import { useParams, usePathname } from "next/navigation";
import CourseLessonsSidebar from "../../_components/course-lessons-sidebar";
import { useProfile } from "@/components/contexts/profile-context";
import { trpc } from "@/utils/trpc";  

interface CourseLayoutContentProps {
  courseData: any;
}

export default function CourseLayoutContent({ courseData }: CourseLayoutContentProps) {
  const params = useParams();
  const pathname = usePathname();
  const { profile } = useProfile();
  
  const lessonId = params.lessonId as string;
  const isLessonPage = pathname.includes('/lessons/');
  
  // Get membership status for access control
  const { data: membershipStatus } = trpc.userModule.user.getMembershipStatus.useQuery(
    {
      entityId: courseData.courseId,
      entityType: Constants.MembershipEntityType.COURSE,
    },
    {
      enabled: !!courseData.courseId && !!profile?.userId,
    },
  );

  const hasAccess = !!profile?.userId && membershipStatus === Constants.MembershipStatus.ACTIVE;

  return (
    <div className="space-y-6 m--course-sidebar">
      <CourseLessonsSidebar 
        course={courseData}
        currentLessonId={isLessonPage ? lessonId : undefined}
        // showPricing={!hasAccess}
        showPricing={false}
        showCourseInfo={true}
      />
    </div>
  );
} 