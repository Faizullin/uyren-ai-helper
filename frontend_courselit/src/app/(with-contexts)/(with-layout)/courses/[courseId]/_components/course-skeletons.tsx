"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";

export function CourseDetailSkeleton() {
  return (
    <>
      {/* Course Meta Skeleton */}
      <div className="space-y-4 m--course-header">
        <div className="flex flex-wrap items-center gap-4 text-sm m--course-meta">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>

      {/* Course Overview Card Skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm m--course-overview">
        {/* Featured Image Skeleton */}
        <Skeleton className="w-full h-64 md:h-80 rounded-t-lg" />

        {/* Course Title and Tags */}
        <div className="p-6 pb-0">
          <Skeleton className="h-10 w-3/4 mb-3" />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        </div>

        {/* Overview Header */}
        <div className="border-b border-gray-100 p-6 m--overview-header">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        {/* Overview Content */}
        <div className="p-6 space-y-6 m--overview-content">
          <div className="space-y-3 m--description-block">
            <Skeleton className="h-6 w-40 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function CourseSidebarSkeleton() {
  return (
    <div className="space-y-6 m--course-sidebar">
      {/* Course Info Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Lessons List */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24 mb-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function LessonContentSkeleton() {
  return (
    <>
      {/* Lesson Content Card */}
      <Card className="border-0 shadow-sm m--lesson-content-card">
        <CardContent className="p-6">
          <div className="space-y-6">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-8 border-t m--lesson-navigation">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
    </>
  );
} 