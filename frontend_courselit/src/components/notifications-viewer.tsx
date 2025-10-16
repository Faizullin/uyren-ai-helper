"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getGlobalAppClient } from "@/lib/global-client";
import { trpc } from "@/utils/trpc";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useProfile } from "./contexts/profile-context";
import { useServerConfig } from "./contexts/server-config-context";

function useEventSourceWithRetry({
  url,
  onMessage,
  maxRetries = 3,
  delayMs = 3000,
  enabled = true,
}: {
  url: string | null;
  onMessage: (event: MessageEvent) => void;
  maxRetries?: number;
  delayMs?: number;
  enabled?: boolean;
}) {
  useEffect(() => {
    const useNotificationsStream = getGlobalAppClient().getConfig(
      "useNotificationsStream",
    );
    if (!useNotificationsStream) return;
    if (!enabled || !url) return;
    let retries = 0;
    let cancelled = false;
    let es: EventSource | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (es) {
        es.close();
        es = null;
      }
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const connect = () => {
      if (cancelled || !url) return;
      es = new EventSource(url);
      es.onmessage = onMessage;
      es.onerror = () => {
        if (es) es.close();
        if (cancelled) return;
        if (retries >= maxRetries) {
          toast.error(
            "Failed to connect to notifications stream. Please try again later.",
          );
          return;
        }
        retries += 1;
        timeout = setTimeout(connect, delayMs);
      };
    };

    connect();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url, onMessage, maxRetries, delayMs, enabled]);
}

const ITEMS_PER_PAGE = 10;

export function NotificationsViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const MAX_SSE_RETRIES = 1;
  const SSE_RETRY_DELAY_MS = 3000;

  const router = useRouter();
  const { profile } = useProfile();
  const { config } = useServerConfig();

  // tRPC queries and mutations
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = trpc.userModule.notification.list.useQuery({
    pagination: {
      skip: (currentPage - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    },
  });

  const { data: unreadCountData, refetch: refetchUnreadCount } =
    trpc.userModule.notification.getUnreadCount.useQuery();

  const markAsReadMutation =
    trpc.userModule.notification.markAsRead.useMutation();
  const markAllAsReadMutation =
    trpc.userModule.notification.markAllAsRead.useMutation();

  const notifications = notificationsData?.items || [];
  const total = notificationsData?.total || 0;
  const unreadCount = unreadCountData?.count || 0;

  // Update total pages when data changes
  useEffect(() => {
    setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));
  }, [total]);

  const nextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  const sseUrl =
    profile?.id && config.queueServer
      ? `${config.queueServer}/sse/${profile.id}`
      : null;

  useEventSourceWithRetry({
    url: sseUrl,
    maxRetries: MAX_SSE_RETRIES,
    delayMs: SSE_RETRY_DELAY_MS,
    enabled: !!sseUrl,
    onMessage: () => {
      try {
        refetchNotifications();
        refetchUnreadCount();
      } catch (error) {
        console.error("Error fetching new notification:", error);
      }
    },
  });

  const markAllAsRead = async () => {
    try {
      await markAllAsReadMutation.mutateAsync();
      refetchNotifications();
      refetchUnreadCount();
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const markReadAndNavigate = async (notificationId: string, href: string) => {
    try {
      await markAsReadMutation.mutateAsync({ id: notificationId });
      refetchNotifications();
      refetchUnreadCount();
      router.push(href);
    } catch (error) {
      toast.error("Failed to open the notification");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full" />
          )}
          <span className="sr-only">View notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card>
          <CardHeader className="border-b py-2 px-4 flex flex-row justify-between items-center">
            <CardTitle className="text-base text-left">Notifications</CardTitle>
            {notifications.some((n) => !n.read) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-6 text-xs px-2 py-0"
              >
                <Check className="h-3 w-3 mr-1" />
                <span className="sr-only sm:not-sr-only">Read all</span>
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 max-h-96 overflow-y-auto">
            {!config.queueServer && (
              <div className="p-2 bg-yellow-100 text-red-500 text-xs flex items-center">
                <TriangleAlert className="h-6 w-6 inline mr-2" />
                Queue configuration is missing. Realtime notifications will not
                work.
              </div>
            )}
            {notificationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">
                  Loading notifications...
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  No new notifications
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  onClick={() =>
                    markReadAndNavigate(
                      notification._id,
                      notification.href,
                    )
                  }
                  className={`p-3 border-b last:border-b-0 ${notification.read ? "bg-muted/50" : ""} hover:bg-accent cursor-pointer transition-colors duration-200`}
                >
                  <p className="text-xs text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
          {notifications.length > 0 && (
            <CardFooter className="flex justify-between py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevPage}
                disabled={currentPage === 1}
                className="text-xs"
              >
                <ChevronLeft className="h-3 w-3 mr-1" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="text-xs"
              >
                Next <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardFooter>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
}
