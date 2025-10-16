"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { useSiteInfo } from "@/components/contexts/site-info-context";
import { NavMain } from "@/components/dashboard/dashboard-skeleton/nav-main";
import { NavProjects } from "@/components/dashboard/dashboard-skeleton/nav-projects";
import { NavUser } from "@/components/dashboard/dashboard-skeleton/nav-user";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar";
import { checkPermission } from "@workspace/utils";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LibraryBig,
  Palette,
  Settings,
  Star,
  Tag,
  Target,
  Users,
  Video
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { NavSecondary } from "./nav-secondary";


export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation("dashboard");
  const { siteInfo } = useSiteInfo();
  const { profile } = useProfile();
  const path = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab");

  const { navMainItems, navProjectItems, navSecondaryItems } = getSidebarItems(
    profile,
    path!,
    tab!,
    t,
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center">
                  <Image
                    src={siteInfo?.logo?.url || "/img/logo.svg"}
                    alt={siteInfo?.logo?.caption || siteInfo?.title || "Logo"}
                    width={16}
                    height={16}
                    className="w-4 h-4 object-contain"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {siteInfo.title}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects projects={navProjectItems} />
        {navMainItems.length > 0 && <NavMain items={navMainItems} />}
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function getSidebarItems(
  profile: ReturnType<typeof useProfile>["profile"],
  path: string,
  tab: string | null,
  t: (key: string) => string,
) {
  const navMainItems: any[] = [];
  const navProjectItems: any[] = [];
  const navSecondaryItems: any[] = [];

  if (!profile) {
    return { navMainItems, navProjectItems, navSecondaryItems };
  }

  const isInstructor = checkPermission(profile.permissions!, [
    UIConstants.permissions.manageCourse,
    UIConstants.permissions.manageAnyCourse,
  ]);

  const isAdmin = profile.roles?.includes("admin");

  // Instructor/Teacher Section
  if (isInstructor) {
    navMainItems.push({
      title: t("sidebar.instructor_dashboard"),
      url: "/dashboard/instructor",
      icon: LayoutDashboard,
      isActive: path === "/dashboard/instructor",
    });

    navMainItems.push({
      title: t("sidebar.lms"),
      url: "/dashboard/lms",
      icon: LibraryBig,
      isActive: path.startsWith("/dashboard/lms"),
      items: [
        {
          title: t("lms.modules.courses.title"),
          url: "/dashboard/lms/courses",
          icon: BookOpen,
          isActive: path.startsWith("/dashboard/lms/courses"),
        },
        {
          title: t("lms.modules.cohorts.title"),
          url: "/dashboard/lms/cohorts",
          icon: Users,
          isActive: path === "/dashboard/lms/cohorts",
        },
        {
          title: t("lms.modules.quizzes.title"),
          url: "/dashboard/lms/quizzes",
          icon: FileText,
          isActive: path.startsWith("/dashboard/lms/quizzes"),
        },
        {
          title: t("lms.modules.assignments.title"),
          url: "/dashboard/lms/assignments",
          icon: ClipboardList,
          isActive: path.startsWith("/dashboard/lms/assignments"),
        },
        {
          title: t("lms.modules.live_classes.title"),
          url: "/dashboard/lms/live-classes",
          icon: Video,
          isActive: path === "/dashboard/lms/live-classes",
        },
        {
          title: t("lms.modules.schedule.title"),
          url: "/dashboard/lms/schedule",
          icon: Calendar,
          isActive: path === "/dashboard/lms/schedule",
        },
        {
          title: t("lms.modules.reviews.title"),
          url: "/dashboard/lms/reviews",
          icon: Star,
          isActive: path === "/dashboard/lms/reviews",
        },
        {
          title: t("lms.modules.themes.title"),
          url: "/dashboard/lms/themes",
          icon: Palette,
          isActive: path.startsWith("/dashboard/lms/themes"),
        },
      ],
    });
  }

  // Admin Section
  if (isAdmin) {
    navMainItems.push({
      title: t("sidebar.admin"),
      url: "/dashboard/admin",
      icon: Settings,
      isActive: path.startsWith("/dashboard/admin"),
      items: [
        {
          title: t("sidebar.users"),
          url: "/dashboard/admin/users",
          icon: Users,
          isActive: path.startsWith("/dashboard/admin/users"),
        },
        {
          title: t("sidebar.tags"),
          url: "/dashboard/admin/tags",
          icon: Tag,
          isActive: path.startsWith("/dashboard/admin/tags"),
        },
        {
          title: t("sidebar.settings"),
          url: "/dashboard/admin/settings",
          icon: Settings,
          isActive: path.startsWith("/dashboard/admin/settings"),
        },
      ],
    });

    navMainItems.push({
      title: t("sidebar.studio"),
      url: "/dashboard/admin/studio",
      icon: Database,
      isActive: path.startsWith("/dashboard/admin/studio"),
      items: [
        {
          title: t("sidebar.database"),
          url: "/dashboard/admin/studio/db",
          isActive: path === "/dashboard/admin/studio/db",
        },
        {
          title: t("sidebar.redis"),
          url: "/dashboard/admin/studio/redis",
          isActive: path === "/dashboard/admin/studio/redis",
        },
      ],
    });
  }

  // Student Section
  navProjectItems.push({
    name: t("sidebar.student_dashboard"),
    url: "/dashboard/student",
    icon: GraduationCap,
    isActive: path === "/dashboard/student",
  });

  navProjectItems.push({
    name: t("sidebar.my_courses"),
    url: "/dashboard/student/courses",
    icon: BookOpen,
    isActive: path.startsWith("/dashboard/student/courses"),
  });

  navProjectItems.push({
    name: t("sidebar.my_assignments"),
    url: "/dashboard/student/assignments",
    icon: ClipboardList,
    isActive: path.startsWith("/dashboard/student/assignments"),
  });

  navProjectItems.push({
    name: t("sidebar.my_schedule"),
    url: "/dashboard/student/schedule",
    icon: Calendar,
    isActive: path === "/dashboard/student/schedule",
  });

  navProjectItems.push({
    name: t("sidebar.my_grades"),
    url: "/dashboard/student/grades",
    icon: Target,
    isActive: path === "/dashboard/student/grades",
  });

  // Secondary Items
  navSecondaryItems.push({
    title: t("sidebar.notifications"),
    url: "/dashboard/notifications",
    icon: Star,
    isActive: path === "/dashboard/notifications",
  });

  navSecondaryItems.push({
    title: t("sidebar.profile"),
    url: "/dashboard/profile",
    icon: Users,
    isActive: path === "/dashboard/profile",
  });

  return {
    navMainItems,
    navProjectItems,
    navSecondaryItems,
  };
}
