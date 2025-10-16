"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { useSiteInfo } from "@/components/contexts/site-info-context";
import { getPlanPrice } from "@/lib/ui/utils";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { Constants } from "@workspace/common-models";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { formatCurrency } from "@workspace/utils";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Lock,
  Play,
  Video,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

type CourseType =
  GeneralRouterOutputs["lmsModule"]["courseModule"]["course"]["publicGetByCourseId"];

interface CourseLessonsSidebarProps {
  course: CourseType;
  currentLessonId?: string;
  showPricing?: boolean;
  showCourseInfo?: boolean;
  loading?: boolean;
}

export default function CourseLessonsSidebar({
  course,
  currentLessonId,
  showPricing = true,
  showCourseInfo = true,
  loading = false,
}: CourseLessonsSidebarProps) {
  const { t } = useTranslation("common");
  const { siteInfo } = useSiteInfo();
  const { profile } = useProfile();

  // Get membership status via tRPC only if user is authenticated
  const { data: membershipStatus, isLoading: isMembershipLoading } =
    trpc.userModule.user.getMembershipStatus.useQuery(
      {
        entityId: course.courseId,
        entityType: Constants.MembershipEntityType.COURSE,
      },
      {
        enabled: !!course.courseId && !!profile?.userId,
      },
    );

  const handlePurchase = useCallback(() => {
    window.location.href = `/checkout?type=course&id=${course.courseId}`;
  }, [course.courseId]);
  
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Smart group expansion logic
  useEffect(() => {
    if (!course.groups?.length) return;

    if (currentLessonId) {
      // Find group containing current lesson and expand it
      const currentLessonGroup = course.groups.find(group =>
        group.lessonsOrder.includes(currentLessonId)
      );
      if (currentLessonGroup && !expandedGroups.includes(currentLessonGroup.groupId)) {
        setExpandedGroups(prev => Array.from(new Set([...prev, currentLessonGroup.groupId])));
      }
    } else {
      // No current lesson (course detail page) - expand first group
      const firstGroup = course.groups[0];
      if (firstGroup && !expandedGroups.includes(firstGroup.groupId)) {
        setExpandedGroups(prev => Array.from(new Set([...prev, firstGroup.groupId])));
      }
    }
  }, [currentLessonId, course.groups?.length]); // Removed expandedGroups from deps to prevent loops

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const defaultPlan =
    course.attachedPaymentPlans?.find(
      (plan) => plan.planId === course.defaultPaymentPlan,
    ) || course.attachedPaymentPlans?.[0];
  const isFree = defaultPlan?.type === Constants.PaymentPlanType.FREE;
  const planPrice = defaultPlan
    ? getPlanPrice(defaultPlan)
    : { amount: 0, period: "" };

  // Determine if user has access to the course
  const isAuthenticated = !!profile?.userId;
  const hasAccess =
    isAuthenticated && membershipStatus === Constants.MembershipStatus.ACTIVE;
  const isPending =
    isAuthenticated && membershipStatus === Constants.MembershipStatus.PENDING;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "text":
        return <FileText className="h-4 w-4" />;
      case "quiz":
        return <HelpCircle className="h-4 w-4" />;
      case "audio":
        return <Play className="h-4 w-4" />;
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "file":
        return <Download className="h-4 w-4" />;
      case "embed":
        return <Play className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Pricing Card Skeleton */}
        {showPricing && (
          <Card className="border-2 border-brand-primary/20">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <Skeleton className="h-8 w-32 mx-auto mb-2" />
                  <Skeleton className="h-6 w-24 mx-auto" />
                </div>
                <Skeleton className="h-12 w-full" />
                {showCourseInfo && (
                  <div className="space-y-3 pt-4 border-t">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Course Content Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Separator />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pricing Card */}
      {showPricing && (
        <Card className="border-2 border-brand-primary/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="text-center">
              {!hasAccess && !isMembershipLoading && (
                <div className="flex flex-col items-center justify-center gap-2 mb-2 text-muted-foreground">
                  <Lock
                    className="h-10 w-10 text-[rgb(var(--brand-primary))]"
                    aria-label={t("access_restricted")}
                  />
                  <span className="text-sm">
                    {isFree
                      ? !isAuthenticated
                        ? t("sign_in_to_enroll")
                        : course.allowEnrollment
                          ? t("self_enroll_available")
                          : t("self_enroll_moderated")
                      : isAuthenticated
                        ? t("purchase_to_start")
                        : t("sign_in_or_purchase")}
                  </span>
                </div>
              )}
                {isAuthenticated && isMembershipLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-32 mx-auto" />
                    <Skeleton className="h-6 w-24 mx-auto" />
                  </div>
                ) : defaultPlan ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-[rgb(var(--brand-primary))]">
                        {formatCurrency(
                          planPrice.amount,
                          siteInfo.currencyISOCode,
                        )}
                        {planPrice.period && (
                          <span className="text-lg">{planPrice.period}</span>
                        )}
                      </span>
                      {defaultPlan.type === Constants.PaymentPlanType.EMI &&
                        defaultPlan.emiTotalInstallments && (
                          <span className="text-lg text-muted-foreground">
                            for {defaultPlan.emiTotalInstallments} months
                          </span>
                        )}
                    </div>
                    {defaultPlan.type === Constants.PaymentPlanType.ONE_TIME &&
                      course.cost > 0 && (
                        <div className="space-y-2">
                          {defaultPlan.oneTimeAmount &&
                            course.cost > defaultPlan.oneTimeAmount && (
                              <div className="text-center">
                                <span className="text-sm text-muted-foreground line-through">
                                  {formatCurrency(
                                    course.cost,
                                    siteInfo.currencyISOCode,
                                  )}
                                </span>
                              </div>
                            )}
                          <Badge
                            variant="destructive"
                            className="bg-[rgb(var(--brand-primary))] hover:bg-[rgb(var(--brand-primary-hover))]"
                          >
                            {defaultPlan.oneTimeAmount &&
                            course.cost > defaultPlan.oneTimeAmount
                              ? `${Math.round(((course.cost - defaultPlan.oneTimeAmount) / course.cost) * 100)}% OFF`
                              : t("course_sidebar_special_offer")}
                          </Badge>
                        </div>
                      )}
                    {defaultPlan.type ===
                      Constants.PaymentPlanType.SUBSCRIPTION && (
                      <Badge variant="secondary" className="text-xs">
                        {defaultPlan.subscriptionYearlyAmount
                          ? t("course_sidebar_yearly_plan")
                          : t("course_sidebar_monthly_plan")}
                      </Badge>
                    )}
                  </>
                ) : course.costType === Constants.ProductPriceType.FREE ? (
                  <div className="text-center">
                    <span className="text-2xl font-bold text-[rgb(var(--brand-primary))]">
                      {t("course_sidebar_free")}
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-2xl font-bold text-[rgb(var(--brand-primary))]">
                      {formatCurrency(course.cost, siteInfo.currencyISOCode)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                {isAuthenticated && isMembershipLoading ? (
                  <div className="space-y-3 w-full">
                    <Skeleton className="h-10 w-32 mx-auto" />
                    <Skeleton className="h-4 w-48 mx-auto" />
                  </div>
                ) : isPending ? (
                  <div className="space-y-2">
                    <div className="text-center">
                      <span className="text-sm text-muted-foreground">
                        {t("course_sidebar_enrollment_pending")}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-medium text-amber-600">
                        {t("course_sidebar_waiting_approval")}
                      </span>
                    </div>
                  </div>
                ) : hasAccess ? (
                  <div className="space-y-2">
                    <div className="text-center">
                      <span className="text-sm text-muted-foreground">
                        {t("course_sidebar_has_access")}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium text-green-600">
                        {t("course_sidebar_course_purchased")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="bg-[rgb(var(--brand-primary))] hover:bg-[rgb(var(--brand-primary-hover))] text-white"
                    onClick={handlePurchase}
                  >
                    {defaultPlan?.type === Constants.PaymentPlanType.FREE ? profile?.userId
                      ? (isPending ? t("enrollment_pending") : t("get_free_course"))
                     : t("sign_in_to_enroll")
                     : t("purchase_course")}
                  </Button>
                )}
              </div>

              {/* Course Info */}
              {showCourseInfo && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-brand-primary" />
                    <span>
                      {course.duration} {t("weeks")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <BookOpen className="h-4 w-4 text-brand-primary" />
                    <span>
                      {course.attachedLessons.length || 0}{" "}
                      {t("course_sidebar_lessons")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {t("course_sidebar_course_content")}
          </CardTitle>
          <CardDescription>
            {course.groups?.length || 0} {t("course_sidebar_sections")} •{" "}
            {course.attachedLessons.length || 0} {t("course_sidebar_lessons")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isAuthenticated && isMembershipLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {course.groups?.map((group) => (
                <div key={group.groupId}>
                  <button
                    onClick={() => toggleGroup(group.groupId)}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      {expandedGroups.includes(group.groupId) ? (
                        <ChevronDown className="h-4 w-4 text-brand-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-brand-primary" />
                      )}
                      <span className="font-medium group-hover:text-brand-primary transition-colors">
                        {group.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {group.lessonsOrder.length || 0}{" "}
                      {t("course_sidebar_lessons")}
                    </Badge>
                  </button>

                  {expandedGroups.includes(group.groupId) && (
                    <div className="ml-4 border-l-2 border-brand-primary/20">
                      {group.lessonsOrder.map((lessonId) => {
                        const lesson = course.attachedLessons?.find(
                          (l) => l.lessonId === lessonId,
                        );
                        const isCurrentLesson = lessonId === currentLessonId;

                        // Lesson access logic:
                        // - hasAccess: User has active membership
                        // - !lesson?.requiresEnrollment: Lesson doesn't require enrollment (free preview)
                        // - If neither condition is met, lesson is locked
                        return (
                          <div
                            key={lessonId}
                            className="w-full overflow-hidden"
                          >
                            <Link
                              href={`/courses/${course.courseId}/lessons/${lessonId}`}
                              scroll={false}
                              className={`block p-3 pl-6 text-left hover:bg-muted/50 transition-colors border-l-2 hover:border-brand-primary ${
                                isCurrentLesson
                                  ? "bg-brand-primary/5 border-brand-primary"
                                  : "border-transparent"
                              } ${!(hasAccess || !lesson?.requiresEnrollment) ? "opacity-60 pointer-events-none" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-sm border-2 border-brand-primary/30 flex items-center justify-center bg-white">
                                  {hasAccess || !lesson?.requiresEnrollment ? (
                                    <div className="text-brand-primary">
                                      {getTypeIcon(lesson?.type || "text")}
                                    </div>
                                  ) : (
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={`text-sm font-medium truncate ${
                                        isCurrentLesson
                                          ? "text-brand-primary"
                                          : ""
                                      }`}
                                    >
                                      {lesson?.title || t("course_sidebar_lesson_default", { number: lessonId })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Separator />
                </div>
              )) || (
                <div className="p-6 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t("course_sidebar_content_coming_soon")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
