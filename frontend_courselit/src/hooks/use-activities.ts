import { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";  
import { ActivityTypeEnum } from "@workspace/common-logic/lib/ui/activity";

interface MetricsData {
  count: number;
  growth: number;
  points: { date: string; count: number }[];
}

interface Activity {
  id: string;
  type: string;
  userId: string;
  entityId?: string;
  metadata?: any;
  createdAt: Date;
}

interface UserActivitiesData {
  activities: Activity[];
  total: number;
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function useActivities(
  type: ActivityTypeEnum,
  duration: string,
  entityId?: string,
  points?: boolean,
) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MetricsData>({
    count: 0,
    growth: 0,
    points: [],
  });

  // Use tRPC query for activities
  const {
    data: activitiesData,
    isLoading,
    error,
  } = trpc.activityModule.activity.getActivities.useQuery(
    {
      params: {
        type: type as any, // Type will be validated by tRPC
        duration: duration as "1d" | "7d" | "30d" | "90d" | "1y" | "lifetime",
        points: points || false,
        growth: true,
        entityId,
      },
    },
    {
      enabled: !!type && !!duration,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (activitiesData?.success && activitiesData.data) {
      const result = activitiesData.data;
      setData({
        count: result.count || 0,
        growth: result.growth || 0,
        points:
          result.points?.map((point: { date: Date; count: number }) => {
            const dateObj = new Date(point.date);
            const currentYear = new Date().getFullYear();
            return {
              date: dateObj.toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                ...(dateObj.getFullYear() !== currentYear && {
                  year: "2-digit",
                }),
              }),
              count: point.count,
            };
          }) || [],
      });
    }
  }, [activitiesData]);

  // Update loading state based on tRPC query
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  // Handle errors
  useEffect(() => {
    if (error) {
      console.error("Error fetching activities:", error);
    }
  }, [error]);

  return { data, loading };
}

// Hook for getting user's own activities
export function useMyActivities(
  type?: string,
  limit: number = 20,
  offset: number = 0,
) {
  const { data, isLoading, error, refetch } =
    trpc.activityModule.activity.getMyActivities.useQuery(
      {
        type: type as any,
        limit,
        offset,
      },
      {
        enabled: true,
        refetchOnWindowFocus: false,
      },
    );

  return {
    data: data?.success ? data.data : null,
    loading: isLoading,
    error,
    refetch,
  };
}

// Hook for getting activity statistics
export function useActivityStats(
  duration: "1d" | "7d" | "30d" | "90d" | "1y" | "lifetime" = "30d",
) {
  const { data, isLoading, error } =
    trpc.activityModule.activity.getActivityStats.useQuery(
      { duration },
      {
        enabled: true,
        refetchOnWindowFocus: false,
      },
    );

  return {
    data: data?.success ? data.data : null,
    loading: isLoading,
    error,
  };
}
