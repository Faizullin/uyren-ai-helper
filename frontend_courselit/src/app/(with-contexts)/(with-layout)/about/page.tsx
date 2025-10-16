"use client";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import {
  ScrollAnimation,
  ScrollGroup,
} from "@/components/public/scroll-animation";
import { Rocket, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Image from "next/image";

export default function Page() {
  const { t } = useTranslation("common");
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const timelineRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const timelineItems = [
    {
      year: t("timeline_team_formation_year", "July 2025"),
      title: t("timeline_team_formation_title"),
      description: t("timeline_team_formation_desc"),
      image:
        "/courselit_backdrop.webp?height=250&width=350&text=Team+Formation+July+2025",
      colorClass: "bg-orange-600",
      side: "left",
    },
    {
      year: t("timeline_nuris_year", "August 2025"),
      title: t("timeline_nuris_title"),
      description: t("timeline_nuris_desc"),
      image:
        "/courselit_backdrop.webp?height=250&width=350&text=NURIS+Incubation+August+2025",
      colorClass: "bg-blue-600",
      side: "right",
    },
    {
      year: t("timeline_partnerships_year", "Late 2025"),
      title: t("timeline_partnerships_title"),
      description: t("timeline_partnerships_desc"),
      image:
        "/courselit_backdrop.webp?height=250&width=350&text=School+Partnerships+Late+2025",
      colorClass: "bg-green-600",
      side: "left",
    },
    {
      year: t("timeline_scaling_year", "2026"),
      title: t("timeline_scaling_title"),
      description: t("timeline_scaling_desc"),
      image:
        "/courselit_backdrop.webp?height=250&width=350&text=Scaling+2026",
      colorClass: "bg-purple-600",
      side: "right",
    },
    {
      year: t("timeline_future_year", "Looking Ahead"),
      title: t("timeline_future_title"),
      description: t("timeline_future_desc"),
      image:
        "/courselit_backdrop.webp?height=250&width=350&text=Future+Growth",
      colorClass: "bg-indigo-600",
      side: "left",
    },
  ];

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    if (timelineRef.current) {
      const timelineObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const timeline = entry.target.querySelector(
                ".timeline-line",
              ) as HTMLElement;
              if (timeline) timeline.style.height = "100%";
            }
          });
        },
        { threshold: 0.1 },
      );
      timelineObserver.observe(timelineRef.current);
      observers.push(timelineObserver);
    }

    itemRefs.current.forEach((ref, index) => {
      if (ref) {
        const itemObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting)
                setVisibleItems((prev) => new Set([...prev, index]));
            });
          },
          { threshold: 0.3 },
        );
        itemObserver.observe(ref);
        observers.push(itemObserver);
      }
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black"></div>
        <div className="absolute top-10 md:top-20 left-10 md:left-20 w-32 md:w-64 h-32 md:h-64 bg-brand-primary rounded-full opacity-10"></div>
        <div className="absolute bottom-10 right-10 md:right-20 w-40 md:w-80 h-40 md:h-80 bg-brand-primary rounded-full opacity-10"></div>
        <div className="absolute top-20 md:top-40 right-20 md:right-40 w-20 md:w-40 h-20 md:h-40 bg-brand-primary rounded-full opacity-10"></div>

        <div className="container mx-auto px-4 relative z-10">
          <ScrollAnimation
            variant="fadeUp"
            className="max-w-5xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
              <Trans
                i18nKey="about_hero_title"
                t={t}
                components={{
                  "primary-label": <span className="text-brand-primary" />,
                }}
              />
            </h1>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-6 max-w-4xl mx-auto">
              {t("about_hero_subtitle")}
            </p>
            <p className="text-base md:text-lg text-gray-400 mb-4">
              {t("about_hero_note")}
            </p>
            <div className="inline-block bg-brand-primary/20 border border-brand-primary/30 rounded-full px-6 py-2">
              <p className="text-brand-primary font-medium text-sm md:text-base">
                {t("about_hero_grants")}
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* History Section */}
      <section className="py-12 md:py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <ScrollAnimation
            variant="fadeUp"
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {t("about_history_title")}
            </h2>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t("about_history_subtitle")}
            </p>
          </ScrollAnimation>

          {/* Timeline */}
          <div className="max-w-4xl mx-auto" ref={timelineRef}>
            <div ref={timelineRef} className="relative timeline-container">
              {/* Vertical Line */}
              <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-1 bg-gray-200 dark:bg-gray-700">
                <div className="timeline-line absolute top-0 left-0 w-full bg-gradient-to-b from-brand-primary via-orange-500 to-purple-500 h-0 transition-all duration-[2000ms] ease-out"></div>
              </div>

              {/* Timeline items */}
              <div className="space-y-8 md:space-y-16 relative">
                {timelineItems.map((item, index) => (
                  <div
                    key={index}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className="relative timeline-item"
                  >
                    {/* Timeline Dot */}
                    <div
                      className={`timeline-dot hidden md:block absolute left-1/2 transform -translate-x-1/2 -translate-y-1/2 
        w-8 h-8 rounded-full border-4 border-white shadow-lg z-10 transition-all duration-700
        ${visibleItems.has(index) ? "opacity-100 scale-100" : "opacity-0 scale-50"}
        ${item.colorClass}`}
                    ></div>

                    <div className="grid md:grid-cols-3 gap-6 md:gap-8 items-center">
                      {/* Left Side */}
                      {item.side === "left" ? (
                        <>
                          <div
                            className={`transition-all duration-1000 md:pr-6 text-right ${
                              visibleItems.has(index)
                                ? "opacity-100 translate-x-0"
                                : "opacity-0 -translate-x-12"
                            }`}
                          >
                            <div
                              className={`timeline-year text-xl md:text-2xl font-bold mb-2 ${item.colorClass.replace("bg-", "text-")}`}
                            >
                              {item.year}
                            </div>
                            <h4 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {item.title}
                            </h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
                              {item.description}
                            </p>
                          </div>
                          <div></div>
                          <div
                            className={`transition-all duration-1000 delay-300 md:pl-6 ${
                              visibleItems.has(index)
                                ? "opacity-100 translate-x-0 scale-100"
                                : "opacity-0 translate-x-12 scale-95"
                            }`}
                          >
                            <div className="relative overflow-hidden rounded-lg shadow-lg group">
                              <Image
                                src={item.image}
                                alt={item.title}
                                className="w-full h-auto transition-transform duration-700 group-hover:scale-110"
                                width={350}
                                height={250}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className={`transition-all duration-1000 delay-300 md:pr-6 ${
                              visibleItems.has(index)
                                ? "opacity-100 translate-x-0 scale-100"
                                : "opacity-0 -translate-x-12 scale-95"
                            }`}
                          >
                            <div className="relative overflow-hidden rounded-lg shadow-lg group">
                              <img
                                src={`/${item.image}`}
                                alt={item.title}
                                className="w-full h-auto transition-transform duration-700 group-hover:scale-110"
                              />
                            </div>
                          </div>
                          <div></div>
                          <div
                            className={`transition-all duration-1000 md:pl-6 text-left ${
                              visibleItems.has(index)
                                ? "opacity-100 translate-x-0"
                                : "opacity-0 translate-x-12"
                            }`}
                          >
                            <div
                              className={`timeline-year text-xl md:text-2xl font-bold mb-2 ${item.colorClass.replace("bg-", "text-")}`}
                            >
                              {item.year}
                            </div>
                            <h4 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              {item.title}
                            </h4>
                            <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
                              {item.description}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-12 md:py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <ScrollGroup
            variant="fadeUp"
            staggerDelay={0.3}
            className="grid lg:grid-cols-2 gap-8 md:gap-12"
          >
            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center space-x-3 mb-4 md:mb-6">
                <Target className="h-6 md:h-8 w-6 md:w-8 text-brand-primary" />
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {t("about_mission_title")}
                </h2>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg leading-relaxed">
                {t("about_mission_desc")}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center space-x-3 mb-4 md:mb-6">
                <Rocket className="h-6 md:h-8 w-6 md:w-8 text-blue-600" />
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {t("about_vision_title")}
                </h2>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg leading-relaxed">
                {t("about_vision_desc")}
              </p>
            </div>
          </ScrollGroup>
        </div>
      </section>

      <Footer />
    </main>
  );
}
