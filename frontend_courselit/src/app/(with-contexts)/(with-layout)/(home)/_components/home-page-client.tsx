"use client";

import ChartLineUpIcon from "@/../public/img/chart-line-up.svg";
import GearsIcon from "@/../public/img/gears.svg";
import PythonIcon from "@/../public/img/python.svg";
import SupportIcon from "@/../public/img/support.svg";
import { useSiteInfo } from "@/components/contexts/site-info-context";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import {
  ScrollAnimation,
  ScrollGroup,
} from "@/components/public/scroll-animation";
import { IWebsiteSettings } from "@workspace/common-logic/models/pages/website-settings";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { ArrowRight, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { TestimonialsSection } from "./testonomials";


import "../home.css";

interface HomePageClientProps {
  websiteSettings: IWebsiteSettings;
}

export default function HomePageClient({ websiteSettings }: HomePageClientProps) {
  const { t } = useTranslation("common");
  const { siteInfo } = useSiteInfo();

  const features = [
    {
      icon: GearsIcon,
      title: t("feature_systematic_title"),
      description: t("feature_systematic_desc"),
    },
    {
      icon: PythonIcon,
      title: t("feature_practice_title"),
      description: t("feature_practice_desc"),
    },
    {
      icon: ChartLineUpIcon,
      title: t("feature_growth_title"),
      description: t("feature_growth_desc"),
    },
    {
      icon: SupportIcon,
      title: t("feature_feedback_title"),
      description: t("feature_feedback_desc"),
    },
  ];

  const stats = [
    { number: "10+", label: t("stats_years_experience") },
    { number: "200+", label: t("stats_students_enrolled") },
    { number: "40+", label: t("stats_popular_courses") },
    { number: "40+", label: t("stats_ai_powered_courses") },
  ];

  // Use featured courses from settings or fallback to hardcoded ones
  const courses = useMemo(() => {
    return (
      websiteSettings?.mainPage.featuredCourses
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((course) => ({
          slug: course.slug,
          image: "/img/python-course.jpeg", // Default image
          title: course.title,
          level: course.level || "Beginner",
          duration: course.durationInWeeks ? `${course.durationInWeeks} weeks` : "8 weeks",
          rating: 4.9,
          students: 1200,
          price: "Free",
          shortDescription: course.shortDescription,
        })) || []
    );
  }, [websiteSettings?.mainPage.featuredCourses]);

  // Use featured reviews from settings or fallback to hardcoded ones
  const testimonials = useMemo(() => {
    return (
      websiteSettings?.mainPage.featuredReviews
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      // .map((review) => ({
      //   content: review.content,
      //   author: review.author,
      //   role: "Student",
      //   rating: review.rating,
      // })) || []
    );
  }, [websiteSettings?.mainPage.featuredReviews]);

  return (
    <div className="home-page page-transition">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-background py-16 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <ScrollAnimation variant="fadeUp" delay={0.2}>
              <div className="space-y-6">
                <Badge className="mb-4 bg-orange-100 text-orange-800 hover:bg-orange-200 text-sm font-semibold px-4 py-2">
                  {t("badge_ai_platform")}
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                  <Trans
                    i18nKey="hero_title"
                    t={t}
                    components={{
                      "primary-label": (
                        <span className="text-brand-primary font-bold" />
                      ),
                    }}
                  />
                </h1>
                <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl">
                  {t("hero_subtitle")}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link href="/courses">
                    <Button
                      size="lg"
                      className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-4 text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {t("hero_start_learning")}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white px-8 py-4 text-lg font-bold rounded-full transition-all duration-300 bg-transparent flex items-center"
                  >
                    <Play className="mr-2 h-5 w-5" />
                    {t("hero_watch_lecture")}
                  </Button>
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation variant="fadeRight" delay={0.4}>
              <div className="relative">
                <div className="hidden md:block">
                  <Image
                    src="/img/banner_copy.png"
                    alt="Banner"
                    width={800}
                    height={600}
                  />
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {websiteSettings?.mainPage.showStats && (
        <section className="py-12 bg-card">
          <div className="container mx-auto px-4">
            <ScrollGroup staggerDelay={0.1}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                  <ScrollAnimation key={index} variant="scale">
                    <div className="text-center group transition-all duration-300">
                      <div className="text-3xl lg:text-4xl font-bold text-brand-primary mb-2 group-hover:animate-bounce">
                        {stat.number}
                      </div>
                      <div className="text-muted-foreground font-medium text-xs lg:text-sm whitespace-pre-line">
                        {stat.label}
                      </div>
                    </div>
                  </ScrollAnimation>
                ))}
              </div>
            </ScrollGroup>
          </div>
        </section>
      )}

      {/* Features Section */}
      {websiteSettings?.mainPage.showFeatures && (
        <section className="py-16 bg-muted">
          <div className="container mx-auto px-4">
            <ScrollAnimation variant="fadeUp">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
                  <Trans
                    i18nKey="features_title"
                    t={t}
                    components={{
                      "primary-label": <span className="text-brand-primary" />,
                    }}
                  />
                </h2>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  {t("features_subtitle")}
                </p>
              </div>
            </ScrollAnimation>

            <ScrollGroup staggerDelay={0.1}>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                  <ScrollAnimation key={index} variant="fadeUp">
                    <Card className="h-full hover:shadow-xl transition-all duration-300 bg-background group/item border border-transparent hover:border-brand-primary/20 hover:bg-background/80">
                      <CardContent className="p-6">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 group-hover/item:bg-brand-primary transition-all duration-300">
                          {(() => {
                            const IconComponent = feature.icon;
                            return <IconComponent className="w-6 h-6 fill-brand-primary group-hover/item:fill-white" />;
                          })()}
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-3">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </ScrollAnimation>
                ))}
              </div>
            </ScrollGroup>
          </div>
        </section>
      )}

      {/* Courses Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <ScrollAnimation variant="fadeUp">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
                <Trans
                  i18nKey="courses_title"
                  t={t}
                  components={{
                    "primary-label": <span className="text-brand-primary" />,
                  }}
                />
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Master in-demand skills with our AI-powered courses designed for
                real-world success
              </p>
            </div>
          </ScrollAnimation>

          <ScrollGroup staggerDelay={0.1}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {courses.map((course, index) => (
                <ScrollAnimation key={index} variant="fadeUp">
                  <Link
                    href={`/courses/${course.slug}`}
                    className="block group"
                  >
                    <Card className="pt-0 h-full hover:shadow-xl transition-all duration-300 bg-card group border border-transparent hover:border-brand-primary/20 hover:bg-card/80 overflow-hidden">
                      <CardContent className="p-0">
                        <div className="relative">
                          <Image
                            src={course.image}
                            alt={course.title}
                            width={300}
                            height={160}
                            className="w-full h-32 object-cover transition-transform duration-300"
                          />
                          <div className="absolute top-2 right-2 bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                            {course.price}
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Image
                              src={siteInfo?.logo?.url || "/img/logo.svg"}
                              alt={siteInfo?.logo?.caption || siteInfo?.title || "Logo"}
                              width={16}
                              height={16}
                              className="w-4 h-4 object-contain"
                            />
                            <p className="text-xs text-muted-foreground">
                              {t("courses_provider")}
                            </p>
                          </div>

                          <h3 className="text-lg font-bold text-foreground line-clamp-2 group-hover:text-brand-primary transition-colors">
                            {course.title}
                          </h3>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {course.level}
                            </span>
                            <span className="text-muted-foreground">
                              {course.duration}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-1">
                              <div className="flex text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-3 h-3 ${i < Math.floor(course.rating) ? "fill-current" : "fill-gray-300"}`}
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground ml-1">
                                {course.rating}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {course.students.toLocaleString()} students
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </ScrollAnimation>
              ))}
            </div>
          </ScrollGroup>

          <ScrollAnimation variant="fadeUp">
            <div className="text-center">
              <Link href="/courses">
                <Button
                  size="lg"
                  className="bg-transparent border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white px-8 py-4 text-lg font-bold rounded-full transition-all duration-300"
                >
                  {t("courses_explore_more")}
                </Button>
              </Link>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-gray-900 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-primary/10 via-transparent to-transparent"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <ScrollAnimation variant="fadeUp">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                {t("cta_title")}
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                {t("cta_subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/courses">
                  <Button
                    size="lg"
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-4 text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {t("cta_start_learning")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-white text-white hover:bg-white hover:text-black dark:border-gray-300 dark:text-gray-300 dark:hover:bg-gray-300 dark:hover:text-black px-8 py-4 text-lg font-bold rounded-full transition-all duration-300 bg-transparent"
                  >
                    {t("cta_contact_us")}
                  </Button>
                </Link>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Testimonials */}
      {websiteSettings?.mainPage.showTestimonials && (
        <TestimonialsSection testimonials={testimonials} />
      )}

      <Footer />
    </div>
  );
}
