"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  CheckCircle,
  BookOpen,
  ArrowRight,
  Home,
  Clock,
  Users,
  Star,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trpc } from "@/utils/trpc";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Badge } from "@workspace/ui/components/badge";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get("courseId");
  const planId = searchParams.get("planId");

  const [isLoading, setIsLoading] = useState(true);

  // Fetch course data
  const { data: course, isLoading: isCourseLoading } =
    trpc.lmsModule.courseModule.course.publicGetByCourseId.useQuery(
      { courseId: courseId! },
      { enabled: !!courseId },
    );

  const selectedPlan = course?.attachedPaymentPlans?.find(
    (plan) => plan.planId === planId,
  );

  useEffect(() => {
    // Simulate loading time for better UX
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isCourseLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Skeleton className="h-20 w-20 mx-auto mb-4 rounded-full" />
            <Skeleton className="h-8 w-80 mx-auto mb-2" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-64 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course || !selectedPlan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Home className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-red-600 mb-4">
            Invalid Success Page
          </h1>
          <p className="text-gray-600 mb-6">
            Course or payment plan not found.
          </p>
          <Button
            onClick={() => router.push("/")}
            className="bg-brand-primary hover:bg-brand-primary-hover"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Enrollment Successful!
          </h1>
          <p className="text-xl text-muted-foreground">
            Welcome to{" "}
            <span className="font-semibold text-brand-primary">
              {course.title}
            </span>
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Course Details Card */}
          <div className="lg:col-span-2">
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  Course Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-bold text-xl text-gray-900 mb-3">
                    {course.title}
                  </h3>
                  {course.tags && course.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {course.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-gray-600 leading-relaxed">
                    {typeof course.description === "string"
                      ? course.description
                      : "Course description available"}
                  </p>
                </div>

                {/* Course Info Grid */}
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="font-medium">
                        {course.duration || "~"} t("weeks")
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <Star className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Level</p>
                      <p className="font-medium">
                        {course.level || "Beginner"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Plan</p>
                      <p className="font-medium">{selectedPlan.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium">{selectedPlan.type}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Steps Sidebar */}
          <div className="space-y-6">
            <Card className="bg-card border border-gray-200">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                  What's Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">1</span>
                    </div>
                    Access Your Course
                  </h3>
                  <p className="text-blue-700 text-sm">
                    Start learning immediately with full access to all course
                    content.
                  </p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                    <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">2</span>
                    </div>
                    Complete Lessons
                  </h3>
                  <p className="text-green-700 text-sm">
                    Work through the course at your own pace and track your
                    progress.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => router.push(`/courses/${course.courseId}`)}
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white transition-all duration-300"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Start Learning
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="w-full border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-all duration-300"
              >
                Go to Dashboard
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="text-center">
                You'll receive a confirmation email shortly with your enrollment
                details.
              </p>
              <p className="text-center">
                Need help? Contact our support team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
