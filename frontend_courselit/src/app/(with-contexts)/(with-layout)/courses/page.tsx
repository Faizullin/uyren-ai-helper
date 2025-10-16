"use client";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import {
  ScrollAnimation,
  ScrollGroup,
} from "@/components/public/scroll-animation";
import { trpc } from "@/utils/trpc";
import { CourseLevelEnum } from "@workspace/common-logic/models/lms/course";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { useDebounce } from "@workspace/ui/hooks/use-debounce";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

type LevelFilter = "all" | CourseLevelEnum;

const COURSES_PER_PAGE = 9;


function CoursesContent() {
  const { t } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Load courses using tRPC with server-side filtering
  const loadCoursesQuery = trpc.lmsModule.courseModule.course.publicList.useQuery(
    {
      pagination: {
        take: COURSES_PER_PAGE,
        skip: (currentPage - 1) * COURSES_PER_PAGE,
        includePaginationCount: true,
      },
      filter: {
        level: levelFilter === "all" ? undefined : levelFilter,
      },
      search: debouncedSearchTerm ? { q: debouncedSearchTerm } : undefined,
    },
    {
      enabled: true,
    },
  );

  const courses = loadCoursesQuery.data?.items || [];
  const totalCourses = loadCoursesQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalCourses / COURSES_PER_PAGE));

  useEffect(() => setCurrentPage(1), [debouncedSearchTerm, levelFilter]);
  useEffect(
    () => setCurrentPage((p) => Math.min(Math.max(1, p), totalPages)),
    [totalPages],
  );

  const clearFilters = () => {
    setSearchTerm("");
    setLevelFilter("all");
    setCurrentPage(1);
  };

  if (loadCoursesQuery.error) {
    return (
      <main className="min-h-screen bg-white">
        <Header />
        <div className="container mx-auto px-4 py-20">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                {t("error_heading")}
              </h3>
              <p className="text-gray-600 mb-4">{loadCoursesQuery.error.message}</p>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                {t("try_again")}
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      {/* Header */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-10 md:top-20 left-10 md:left-20 w-32 md:w-64 h-32 md:h-64 bg-brand-primary rounded-full opacity-10"></div>
        <div className="absolute bottom-10 right-10 md:right-20 w-40 md:w-80 h-40 md:h-80 bg-brand-primary rounded-full opacity-10"></div>
        <div className="absolute top-20 md:top-40 right-20 md:right-40 w-20 md:w-40 h-20 md:h-40 bg-brand-primary rounded-full opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <ScrollAnimation
            variant="fadeUp"
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              <Trans
                i18nKey="courses_page.header_title"
                t={t}
                components={{
                  "primary-label": <span className="text-brand-primary" />,
                }}
              />
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8">
              {t("courses_page.header_desc")}
            </p>
          </ScrollAnimation>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
              <Input
                placeholder={t("search_placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-4 items-center">
              <Select
                value={levelFilter}
                onValueChange={(v) => setLevelFilter(v as LevelFilter)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t("all_levels")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_levels")}</SelectItem>
                  <SelectItem value="beginner">
                    {t("level_beginner")}
                  </SelectItem>
                  <SelectItem value="intermediate">
                    {t("level_intermediate")}
                  </SelectItem>
                  <SelectItem value="advanced">
                    {t("level_advanced")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {(searchTerm || levelFilter !== "all") && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="whitespace-nowrap bg-transparent"
                >
                  {t("clear_filters")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Courses grid */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          {loadCoursesQuery.isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[...Array(6)].map((_, index) => (
                <Card
                  key={index}
                  className="pt-0 h-full animate-pulse overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div className="h-48 bg-gray-200"></div>
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : loadCoursesQuery.data?.items.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                {t("no_courses")}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{t("no_courses_desc")}</p>
              <Button onClick={clearFilters} variant="outline">
                {t("clear_filters")}
              </Button>
            </div>
          ) : (
            <>
              <ScrollGroup
                variant="fadeUp"
                staggerDelay={0.1}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
              >
                {loadCoursesQuery.data?.items.map((course) => {
                  const tags = course.tags || [];
                  const extraCount = Math.max(0, tags.length - 3);
                  return (
                    <Link
                      key={course._id}
                      href={`/courses/${course._id}`}
                    >
                      <Card className="pt-0 h-full hover:shadow-xl transition-all duration-300 group cursor-pointer overflow-hidden">
                        <CardContent className="p-0">
                          <div className="relative h-48 w-full overflow-hidden">
                            <Image
                              src={
                                course.featuredImage?.url ||
                                "/courselit_backdrop.webp"
                              }
                              alt={course.title}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                            <Badge className="absolute top-3 right-3 bg-brand-primary text-white">
                              {t(
                                `level_${course.level?.toLowerCase() || "beginner"}`,
                              )}
                            </Badge>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-brand-primary/20 transition-colors">
                              <BookOpen className="h-5 w-5 text-brand-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-brand-primary transition-colors">
                              {course.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-3 text-sm line-clamp-2">
                              {course.shortDescription}
                            </p>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-3">
                              <BookOpen className="h-4 w-4 mr-2" />
                              <span>
                                {course.statsLessonCount} {t("lessons")} •{" "}
                                {t(
                                  `level_${course.level?.toLowerCase() || "beginner"}`,
                                )}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {tags.slice(0, 3).map((tag, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                              {extraCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{extraCount}
                                </Badge>
                              )}
                            </div>
                            <Button className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white">
                              {t("view_course")}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </ScrollGroup>

              {totalPages > 1 && (
                <div className="flex justify-center items-center mt-12 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("previous")}
                  </Button>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 ${currentPage === page ? "bg-brand-primary hover:bg-brand-primary-hover" : ""}`}
                        >
                          {page}
                        </Button>
                      ),
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2"
                  >
                    {t("next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

export default function CoursesPage() {
  const { t } = useTranslation("common");
  return (
    <Suspense fallback={<div>{t("loading")}</div>}>
      <CoursesContent />
    </Suspense>
  );
}
