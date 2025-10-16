"use client";

import { useSiteInfo } from "@/components/contexts/site-info-context";
import { trpc } from "@/utils/trpc";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@workspace/components-library";
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
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Star,
  Users,
  AlertCircle,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";

interface PaymentPlan {
  planId: string;
  name: string;
  type: string;
  oneTimeAmount?: number;
  subscriptionMonthlyAmount?: number;
  subscriptionYearlyAmount?: number;
  emiAmount?: number;
  emiTotalInstallments?: number;
  features?: string[];
  popular?: boolean;
}

export default function CheckoutView() {
  const { t } = useTranslation("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get("id");
  const courseType = searchParams.get("type");
  const { siteInfo } = useSiteInfo();
  const { toast } = useToast();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [joinReason, setJoinReason] = useState("");

  // Fetch course data
  const {
    data: course,
    isLoading: isCourseLoading,
    error: courseError,
  } = trpc.lmsModule.courseModule.course.publicGetById.useQuery(
    { id: courseId! },
    { enabled: !!courseId   },
  );

  // Fetch current user's membership status for this course
  const {
    data: membershipStatus,
    isLoading: isMembershipLoading,
    error: membershipError,
  } = trpc.userModule.user.getMembershipStatus.useQuery(
    {
      entityId: courseId!,
      entityType: Constants.MembershipEntityType.COURSE,
    },
    { enabled: !!courseId && courseType === "course" },
  );

  // Memoized plan features function
  const getPlanFeatures = useCallback((plan: any): string[] => {
    const features = [];

    if (plan.type === Constants.PaymentPlanType.FREE) {
      features.push(
        "Full course access",
        "Lifetime access",
        "Certificate of completion",
      );
    } else if (plan.type === Constants.PaymentPlanType.ONE_TIME) {
      features.push(
        "Full course access",
        "Lifetime access",
        "Certificate of completion",
        "Download materials",
      );
    } else if (plan.type === Constants.PaymentPlanType.SUBSCRIPTION) {
      features.push(
        "Full course access",
        "Monthly/yearly billing",
        "Cancel anytime",
        "Certificate of completion",
      );
    } else if (plan.type === Constants.PaymentPlanType.EMI) {
      features.push(
        "Full course access",
        `Pay in ${plan.emiTotalInstallments} installments`,
        "Certificate of completion",
      );
    }

    return features;
  }, []);

  // Memoized processed plans
  const processedPlans = useMemo(
    () =>
      course?.attachedPaymentPlans?.map((plan: any) => ({
        planId: plan.planId,
        name: plan.name,
        type: plan.type,
        oneTimeAmount: plan.oneTimeAmount,
        subscriptionMonthlyAmount: plan.subscriptionMonthlyAmount,
        subscriptionYearlyAmount: plan.subscriptionYearlyAmount,
        emiAmount: plan.emiAmount,
        emiTotalInstallments: plan.emiTotalInstallments,
        features: getPlanFeatures(plan),
        popular: plan.planId === course?.defaultPaymentPlan,
      })) || [],
    [course?.attachedPaymentPlans, course?.defaultPaymentPlan, getPlanFeatures],
  );

  const selectedPlanData = useMemo(
    () => processedPlans.find((plan) => plan.planId === selectedPlan),
    [processedPlans, selectedPlan],
  );

  // Auto-select default plan
  useEffect(() => {
    if (course?.defaultPaymentPlan && !selectedPlan) {
      setSelectedPlan(course.defaultPaymentPlan);
    }
  }, [course?.defaultPaymentPlan, selectedPlan]);

  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlan(planId);
  }, []);

  // TanStack Query mutations
  const freeEnrollmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: course!.courseId,
          type: "course",
          planId: selectedPlanData!.planId,
          origin: window.location.origin,
          joiningReason: joinReason,
        }),
      });

      const data = await response.json();

      // Handle different response statuses
      if (response.status === 401) {
        throw new Error("Authentication required");
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Enrollment failed");
      }

      if (data.status === "success") {
        return data;
      }

      // If we reach here, something unexpected happened
      throw new Error("Unexpected response from server");
    },
    onSuccess: (data) => {
      toast({
        title: "Enrollment Successful!",
        description: "You have been successfully enrolled in the course.",
        variant: "info",
      });
      router.push(
        `/checkout/success?courseId=${course!.courseId}&planId=${selectedPlanData!.planId}`,
      );
    },
    onError: (error: any) => {
      console.error("Free enrollment failed:", error.message);

      if (error.message === "Authentication required") {
        toast({
          title: "Authentication Required",
          description: "Please log in to enroll in this course.",
          variant: "destructive",
        });
        router.push(
          `/auth/sign-in?redirect=/checkout?id=${course!.courseId}&type=${courseType}`,
        );
        return;
      }

      if (
        error.message?.includes("already enrolled") ||
        error.message?.includes("membership already active")
      ) {
        toast({
          title: "Already Enrolled",
          description: "You are already enrolled in this course.",
          variant: "info",
        });
        router.push(`/courses/${course!.courseId}`);
        return;
      }

      toast({
        title: "Enrollment Failed",
        description:
          error.message ||
          "An error occurred during enrollment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const stripePaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: course!.courseId,
          type: "course",
          planId: selectedPlanData!.planId,
          origin: window.location.origin,
        }),
      });

      const data = await response.json();

      // Handle different response statuses
      if (response.status === 401) {
        throw new Error("Authentication required");
      }

      if (data.status === "failed") {
        throw new Error(data.error || "Payment initiation failed");
      }

      if (data.status === "initiated") {
        return data;
      }

      // If we reach here, something unexpected happened
      throw new Error("Unexpected response from server");
    },
    onSuccess: async (data) => {
      const stripe = await loadStripe(siteInfo.stripeKey as string);
      if (stripe) {
        const result = await stripe.redirectToCheckout({
          sessionId: data.paymentTracker,
        });

        if (result.error) {
          console.error("Stripe redirect error:", result.error);
          toast({
            title: "Payment Error",
            description: "Failed to redirect to payment. Please try again.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      console.error("Payment initiation failed:", error);

      if (error.message === "Authentication required") {
        toast({
          title: "Authentication Required",
          description: "Please log in to purchase this course.",
          variant: "destructive",
        });
        router.push(
          `/auth/sign-in?redirect=/checkout?id=${course!.courseId}&type=${courseType}`,
        );
        return;
      }

      if (
        error.message?.includes("already enrolled") ||
        error.message?.includes("membership already active")
      ) {
        toast({
          title: "Already Enrolled",
          description: "You are already enrolled in this course.",
          variant: "info",
        });
        router.push(`/courses/${course!.courseId}`);
        return;
      }

      toast({
        title: "Payment Failed",
        description:
          error.message ||
          "An error occurred during payment initiation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isProcessing =
    freeEnrollmentMutation.isPending || stripePaymentMutation.isPending;

  // Memoized price calculation function
  const getPlanPrice = useCallback(
    (
      plan: PaymentPlan,
    ): { amount: number; period: string; isFree: boolean } => {
      if (plan.type === Constants.PaymentPlanType.FREE) {
        return { amount: 0, period: "", isFree: true };
      }

      if (plan.type === Constants.PaymentPlanType.SUBSCRIPTION) {
        if (plan.subscriptionYearlyAmount) {
          return {
            amount: plan.subscriptionYearlyAmount,
            period: "/year",
            isFree: false,
          };
        }
        return {
          amount: plan.subscriptionMonthlyAmount || 0,
          period: "/month",
          isFree: false,
        };
      }

      if (plan.type === Constants.PaymentPlanType.EMI) {
        return {
          amount: plan.emiAmount || 0,
          period: `/month for ${plan.emiTotalInstallments} months`,
          isFree: false,
        };
      }

      return { amount: plan.oneTimeAmount || 0, period: "", isFree: false };
    },
    [],
  );

  // Check if user can proceed with checkout
  const canProceedWithCheckout = useMemo(() => {
    if (!membershipStatus) return true; // No existing membership, can proceed
    if (membershipStatus === Constants.MembershipStatus.ACTIVE) return false; // Already enrolled
    if (membershipStatus === Constants.MembershipStatus.PENDING) return false; // Payment pending
    if (membershipStatus === Constants.MembershipStatus.PAYMENT_FAILED)
      return true; // Can retry
    if (membershipStatus === Constants.MembershipStatus.EXPIRED) return true; // Can re-enroll
    if (membershipStatus === Constants.MembershipStatus.REJECTED) return true; // Can re-apply
    return true; // Default case
  }, [membershipStatus]);

  // Get membership status message
  const getMembershipStatusMessage = useCallback(() => {
    if (!membershipStatus) return null;

    switch (membershipStatus) {
      case Constants.MembershipStatus.ACTIVE:
        return {
          type: "default" as const,
          title: "Already Enrolled",
          description:
            "You are already enrolled in this course. You can access it from your dashboard.",
          icon: CheckCircle,
        };
      case Constants.MembershipStatus.PENDING:
        return {
          type: "default" as const,
          title: "Payment Pending",
          description:
            "You have a pending payment for this course. Please complete your payment or contact support if you need assistance.",
          icon: Clock,
        };
      case Constants.MembershipStatus.PAYMENT_FAILED:
        return {
          type: "destructive" as const,
          title: "Payment Failed",
          description:
            "Your previous payment attempt failed. You can try again or contact support for assistance.",
          icon: XCircle,
        };
      case Constants.MembershipStatus.EXPIRED:
        return {
          type: "default" as const,
          title: "Membership Expired",
          description:
            "Your previous membership has expired. You can re-enroll to regain access.",
          icon: AlertCircle,
        };
      case Constants.MembershipStatus.REJECTED:
        return {
          type: "destructive" as const,
          title: "Enrollment Rejected",
          description:
            "Your previous enrollment request was rejected. You can try enrolling again.",
          icon: XCircle,
        };
      default:
        return null;
    }
  }, [membershipStatus]);

  const handleCheckout = useCallback(async () => {
    if (!selectedPlanData || !course) return;

    // Prevent checkout if user already has active or pending membership
    if (!canProceedWithCheckout) {
      toast({
        title: "Cannot Proceed",
        description:
          "You already have an active enrollment or pending payment for this course.",
        variant: "destructive",
      });
      return;
    }

    if (getPlanPrice(selectedPlanData).isFree) {
      freeEnrollmentMutation.mutate();
    } else {
      stripePaymentMutation.mutate();
    }
  }, [
    selectedPlanData,
    course,
    freeEnrollmentMutation,
    stripePaymentMutation,
    getPlanPrice,
    canProceedWithCheckout,
    toast,
  ]);

  if (courseError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            {t("checkout_course_not_found")}
          </h1>
          <p className="text-gray-600">{t("checkout_course_not_exist")}</p>
        </div>
      </div>
    );
  }

  if (isCourseLoading || isMembershipLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Skeleton className="h-10 w-96 mx-auto mb-2" />
            <Skeleton className="h-6 w-64 mx-auto" />
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <Skeleton className="w-full h-48 rounded-lg mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-600 mb-4">
            {t("checkout_course_not_available")}
          </h1>
          <p className="text-gray-600">{t("checkout_check_course_id")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Membership Status Alert */}
        {membershipStatus && getMembershipStatusMessage() && (
          <div className="mb-6">
            <Alert variant={getMembershipStatusMessage()!.type}>
              {(() => {
                const IconComponent = getMembershipStatusMessage()!.icon;
                return <IconComponent className="h-4 w-4" />;
              })()}
              <AlertTitle>{getMembershipStatusMessage()!.title}</AlertTitle>
              <AlertDescription>
                {getMembershipStatusMessage()!.description}
                {membershipStatus === Constants.MembershipStatus.ACTIVE && (
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800 ml-1"
                    onClick={() => router.push(`/courses/${course!.courseId}`)}
                  >
                    Go to course
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Product Info - Matching Course Details Design */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm sticky top-4">
              <div className="p-6">
                {/* Featured Image */}
                <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={
                      course.featuredImage?.url || "/courselit_backdrop.webp"
                    }
                    alt={course.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                  />
                </div>

                {/* Course Title */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {course.title}
                </h3>

                {/* Course Tags */}
                {course.tags && course.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {course.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 transition-colors text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Essential Course Info with Gradient Icons */}
                <div className="space-y-3 text-sm text-gray-600">
                  {course.level && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                        <Star className="w-4 h-4 text-white" />
                      </div>
                      <span>
                        {t("checkout_level")}: {course.level}
                      </span>
                    </div>
                  )}
                  {course.duration && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                        <Clock className="w-4 h-4 text-white" />
                      </div>
                      <span>
                        {course.duration} {t("weeks")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <span>
                      {t("checkout_by")} {course.creatorName}
                    </span>
                  </div>
                  {course.attachedLessons && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <span>
                        {course.attachedLessons.length} {t("lessons")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Plans - Enhanced Design */}
          <div className="lg:col-span-2">
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
              {processedPlans.map((plan) => {
                const priceInfo = getPlanPrice(plan);
                return (
                  <Card
                    key={plan.planId}
                    className={`cursor-pointer transition-all duration-300 bg-card border border-transparent hover:border-brand-primary/20 hover:bg-card/80 hover:shadow-xl ${selectedPlan === plan.planId
                        ? "ring-2 ring-brand-primary shadow-lg border-brand-primary/20"
                        : ""
                      } ${plan.popular ? "border-brand-primary/40" : ""}`}
                    onClick={() => handlePlanSelect(plan.planId)}
                  >
                    <CardHeader className="text-center pb-4">
                      {plan.popular && (
                        <Badge className="bg-brand-primary text-white mb-2 w-fit mx-auto">
                          {t("checkout_most_popular")}
                        </Badge>
                      )}
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-bold text-brand-primary">
                          {priceInfo.isFree
                            ? t("checkout_free")
                            : formatCurrency(
                              priceInfo.amount,
                              siteInfo.currencyISOCode,
                            )}
                        </span>
                        {priceInfo.period && (
                          <span className="text-sm text-muted-foreground">
                            {priceInfo.period}
                          </span>
                        )}
                      </div>
                      <CardDescription>{plan.type}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {plan.features?.map((feature, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Payment Method Info - Enhanced Styling */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">💳</span>
                </div>
                <p className="text-sm">
                  <strong>{t("checkout_payment_methods")}:</strong>{" "}
                  {t("checkout_payment_description")}
                </p>
              </div>
            </div>

            {/* Free Course Join Reason - Enhanced Card */}
            {selectedPlanData && getPlanPrice(selectedPlanData).isFree && (
              <Card className="mb-6 bg-card border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">👤</span>
                    </div>
                    {t("checkout_tell_us_about_yourself")}
                  </CardTitle>
                  <CardDescription>
                    {t("checkout_help_us_understand")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="joinReason"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        {t("checkout_why_join_course")} *
                      </label>
                      <textarea
                        id="joinReason"
                        placeholder={t("checkout_join_reason_placeholder")}
                        value={joinReason}
                        onChange={(e) => setJoinReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-colors"
                        rows={4}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Checkout Summary - Enhanced Design */}
            {selectedPlanData && (
              <Card className="bg-card border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    {t("checkout_order_summary")}
                  </CardTitle>
                  <CardDescription>
                    {t("checkout_order_summary_desc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {/* Plan Details */}
                    <div className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-sm border-2 border-brand-primary/30 flex items-center justify-center bg-white">
                            <CheckCircle className="h-3 w-3 text-brand-primary" />
                          </div>
                          <span className="font-medium">
                            {selectedPlanData.name}
                          </span>
                        </div>
                        <span className="font-bold text-brand-primary">
                          {getPlanPrice(selectedPlanData).isFree
                            ? t("checkout_free")
                            : formatCurrency(
                              getPlanPrice(selectedPlanData).amount,
                              siteInfo.currencyISOCode,
                            )}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Total */}
                    <div className="p-4 bg-muted/30">
                      <div className="flex items-center justify-between font-bold text-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-sm border-2 border-brand-primary/30 flex items-center justify-center bg-white">
                            <CreditCard className="h-3 w-3 text-brand-primary" />
                          </div>
                          <span>{t("checkout_total")}</span>
                        </div>
                        <span className="text-brand-primary">
                          {getPlanPrice(selectedPlanData).isFree
                            ? t("checkout_free")
                            : formatCurrency(
                              getPlanPrice(selectedPlanData).amount,
                              siteInfo.currencyISOCode,
                            )}
                        </span>
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <div className="p-4">
                      <Button
                        onClick={handleCheckout}
                        disabled={
                          isProcessing ||
                          !selectedPlan ||
                          !canProceedWithCheckout ||
                          (getPlanPrice(selectedPlanData).isFree &&
                            !joinReason.trim())
                        }
                        className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white transition-all duration-300"
                      >
                        {isProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {getPlanPrice(selectedPlanData).isFree
                              ? t("checkout_processing_enrollment")
                              : t("checkout_redirecting_to_payment")}
                          </>
                        ) : !canProceedWithCheckout ? (
                          membershipStatus ===
                            Constants.MembershipStatus.ACTIVE ? (
                            "Already Enrolled"
                          ) : (
                            "Payment Pending"
                          )
                        ) : getPlanPrice(selectedPlanData).isFree ? (
                          t("checkout_enroll_for_free")
                        ) : (
                          `${t("checkout_proceed_to_payment")} - ${formatCurrency(getPlanPrice(selectedPlanData).amount, siteInfo.currencyISOCode)}`
                        )}
                      </Button>
                    </div>

                    {/* Security Info */}
                    {!getPlanPrice(selectedPlanData).isFree && (
                      <>
                        <Separator />
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-center gap-3 mb-2">
                            <div className="w-6 h-6 rounded-sm border-2 border-brand-primary/30 flex items-center justify-center bg-white">
                              <CheckCircle className="h-3 w-3 text-brand-primary" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {t("checkout_secure_payment_description")}
                            </span>
                          </div>
                          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  S
                                </span>
                              </div>
                              <span>{t("checkout_ssl_secured")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-600 rounded flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  ✓
                                </span>
                              </div>
                              <span>{t("checkout_pci_compliant")}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            {t("checkout_after_payment_description")}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
