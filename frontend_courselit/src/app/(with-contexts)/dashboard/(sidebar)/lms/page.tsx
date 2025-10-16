import { Metadata, ResolvingMetadata } from "next";
import DashboardContent from "@/components/dashboard/dashboard-content";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ClipboardList,
  FileText,
  Plus,
  Users,
  Target,
  Star,
} from "lucide-react";
import Link from "next/link";
import { getT } from "@/app/i18n/server";

export async function generateMetadata(
  _: any,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `Learning Management System | ${(await parent)?.title?.absolute}`,
  };
}

export default async function LMSPage() {
  const { t } = await getT("dashboard");
  const breadcrumbs = [{ label: t("sidebar.lms"), href: "#" }];

  const lmsModules = [
    {
      title: t("lms.modules.quizzes.title"),
      description: t("lms.modules.quizzes.description"),
      icon: ClipboardList,
      href: "/dashboard/lms/quizzes",
      stats: {
        total: 0,
        active: 0,
        draft: 0,
      },
    },
    {
      title: t("lms.modules.reviews.title"),
      description: t("lms.modules.reviews.description"),
      icon: Star,
      href: "/dashboard/lms/reviews",
      stats: {
        total: 0,
        published: 0,
        featured: 0,
      },
    },
    {
      title: t("lms.modules.assignments.title"),
      description: t("lms.modules.assignments.description"),
      icon: FileText,
      href: "/dashboard/lms/assignments",
      stats: {
        total: 0,
        active: 0,
        overdue: 0,
      },
    },
    {
      title: t("lms.modules.themes.title"),
      description: t("lms.modules.themes.description"),
      icon: Target,
      href: "/dashboard/lms/themes",
      stats: {
        total: 0,
        active: 0,
        draft: 0,
      },
    },
  ];

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-semibold">
              {t("lms.title")}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("lms.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lmsModules.map((module) => (
            <Card
              key={module.title}
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <module.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {module.stats.total}
                      </div>
                      <div className="text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {module.stats.active}
                      </div>
                      <div className="text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {module.stats.draft || module.stats.overdue}
                      </div>
                      <div className="text-muted-foreground">
                        {module.title === "Quizzes" ? "Draft" : "Overdue"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={module.href} className="flex-1">
                      <Button variant="outline" className="w-full">
                        {t("lms.actions.view_all")}
                      </Button>
                    </Link>
                    <Link href={`${module.href}/new`}>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        {t("lms.actions.new")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("lms.stats.total_students")}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                {t("lms.stats.enrolled_across_courses")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("lms.stats.completion_rate")}
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">
                {t("lms.stats.average_across_assessments")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("lms.stats.active_assessments")}
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                {t("lms.stats.currently_active")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardContent>
  );
}
