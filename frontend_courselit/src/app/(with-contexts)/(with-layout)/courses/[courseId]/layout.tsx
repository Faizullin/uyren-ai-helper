import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { ThemeAsset } from "@/models/lms/Theme";
import { trpcCaller } from "@/server/api/_app";
import { NotFoundException } from "@/server/api/core/exceptions";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import CourseBreadcrumbs from "./_components/course-breadcrumbs";
import CourseLayoutContent from "./_components/course-layout-content";
import { CourseProvider } from "./_components/course-provider";

const getCachedCourseData = cache(async (courseId: string) => {
  return await trpcCaller.lmsModule.courseModule.course.publicGetByCourseId({
    courseId,
  });
});

interface CourseLayoutProps {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await params;

  try {
    const courseData = await getCachedCourseData(courseId);

    const description = `Learn ${courseData.title} - A comprehensive course covering all essential topics and practical skills.`;

    return {
      title: courseData.title,
      description: description?.slice(0, 160),
      openGraph: {
        title: courseData.title,
        description: description?.slice(0, 160),
        images: courseData.featuredImage ? [courseData.featuredImage.url] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: courseData.title,
        description: description?.slice(0, 160),
        images: courseData.featuredImage ? [courseData.featuredImage.url] : [],
      },
    };
  } catch (error) {
    return {
      title: 'Course Not Found',
      description: 'The requested course could not be found.',
    };
  }
}

export default async function CourseLayout({
  children,
  params,
}: CourseLayoutProps) {
  const { courseId } = await params;

  try {
    const courseData = await getCachedCourseData(courseId);
    const theme = courseData.themeId
      ? await trpcCaller.lmsModule.themeModule.theme.publicGetThemeAndAssets({
        id: courseData.themeId.toString(),
      })
      : null;
    const assets = theme?.assets || [];

    return (
      <CourseProvider courseData={courseData}>
        <ThemeAssets assets={assets} />

        <div className="min-h-screen bg-background m--course-page">
          <Header />

          <main className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 m--course-layout">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-6 m--course-content">
                <CourseBreadcrumbs courseId={courseId} />
                {children}
              </div>

              {/* Persistent Sidebar */}
              <CourseLayoutContent courseData={courseData} />
            </div>
          </main>

          <Footer />
        </div>
      </CourseProvider>
    );
  } catch (error) {
    if (error instanceof NotFoundException) {
      return notFound();
    }
    console.error("Error fetching course data:", error);
    throw error;
  }
}

interface ThemeAssetsProps {
  assets: ThemeAsset[];
}

function ThemeAssets({ assets }: ThemeAssetsProps) {
  if (!assets?.length) return null;

  const nodes = assets.flatMap((a, i) => {
    const key = `${a.assetType}-${i}-${a.url || "inline"}`;
    const out: React.ReactNode[] = [];

    switch (a.assetType) {
      case "stylesheet": {
        if (a.url) {
          if (a.preload) {
            out.push(
              <link
                key={`${key}-preload`}
                rel="preload"
                as="style"
                href={a.url}
                media={a.media}
                crossOrigin={a.crossorigin as any}
                integrity={a.integrity}
              />,
            );
          }
          out.push(
            <link
              key={key}
              rel={a.rel || "stylesheet"}
              href={a.url}
              media={a.media}
              crossOrigin={a.crossorigin as any}
              integrity={a.integrity}
            />,
          );
        } else if (a.content) {
          out.push(
            <style
              key={key}
              media={a.media}
              dangerouslySetInnerHTML={{ __html: a.content }}
            />,
          );
        }
        break;
      }
      case "font": {
        if (a.url) {
          out.push(
            <link
              key={key}
              rel="preload"
              as="font"
              href={a.url}
              type={a.mimeType}
              crossOrigin={a.crossorigin as any}
            />,
          );
        } else if (a.content) {
          out.push(
            <style key={key} dangerouslySetInnerHTML={{ __html: a.content }} />,
          );
        }
        break;
      }
      case "script": {
        if (a.url) {
          out.push(
            <script
              key={key}
              src={a.url}
              async={!!a.async}
              defer={!!a.defer}
              crossOrigin={a.crossorigin as any}
              integrity={a.integrity}
            />,
          );
        } else if (a.content) {
          out.push(
            <script key={key} dangerouslySetInnerHTML={{ __html: a.content }} />,
          );
        }
        break;
      }
      case "image": {
        if (a.url && a.preload) {
          out.push(
            <link
              key={key}
              rel="preload"
              as="image"
              href={a.url}
              media={a.media}
              crossOrigin={a.crossorigin as any}
              imageSizes={a.sizes}
            />,
          );
        }
        break;
      }
    }

    return out;
  });

  return <>{nodes}</>;
}
