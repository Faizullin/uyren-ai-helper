"use client";

import { ScrollAnimation } from "@/components/public/scroll-animation";
import { IWebsiteSettings } from "@workspace/common-logic/models/pages/website-settings";
import { cn } from "@workspace/ui/lib/utils";
import { Star } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type TestimonialItemType = Pick<
  IWebsiteSettings["mainPage"]["featuredReviews"][number],
  "rating" | "content" | "author" | "reviewId" | "order"
>;

export function TestimonialsSection(props: {
  testimonials: TestimonialItemType[];
}) {
  const { t } = useTranslation("common");
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const testimonials = useMemo(() => {
    const defaultData = [
      {
        quote: t("testimonials_1_quote"),
        author: {
          userId: "Aigerim K.",
          name: "Aigerim K.",
          avatar: "/courselit_backdrop.webp?height=80&width=80&text=AK",
        },
        image: "/courselit_backdrop.webp?height=80&width=80&text=AK",
        stars: 5,
        rotation: "-rotate-12",
      },
      {
        quote: t("testimonials_2_quote"),
        author: {
          userId: "Daniyar T.",
          name: "Daniyar T.",
          avatar: "/courselit_backdrop.webp?height=80&width=80&text=DT",
        },
        image: "/courselit_backdrop.webp?height=80&width=80&text=DT",
        stars: 5,
        rotation: "rotate-6",
      },
      {
        quote: t("testimonials_3_quote"),
        author: {
          userId: "Aida S.",
          name: "Aida S.",
          avatar: "/courselit_backdrop.webp?height=80&width=80&text=AS",
        },
        image: "/courselit_backdrop.webp?height=80&width=80&text=AS",
        stars: 5,
        rotation: "-rotate-3",
      },
      {
        quote: t("testimonials_4_quote"),
        author: {
          userId: "Nurlan B.",
          name: "Nurlan B.",
          avatar: "/courselit_backdrop.webp?height=80&width=80&text=NB",
        },
        image: "/courselit_backdrop.webp?height=80&width=80&text=NB",
        stars: 5,
        rotation: "rotate-8",
      },
      {
        quote: t("testimonials_5_quote"),
        author: {
          userId: "Zhanel M.",
          name: "Zhanel M.",
          avatar: "/courselit_backdrop.webp?height=80&width=80&text=ZM",
        },
        image: "/courselit_backdrop.webp?height=80&width=80&text=ZM",
        stars: 5,
        rotation: "-rotate-6",
      },
    ];
    return props.testimonials
      .map((t, index) => {
        const connectItem = defaultData[index];
        return {
          ...t,
          rotation: connectItem ? connectItem.rotation : "",
        };
      })
      .slice(0, 5);
  }, [props.testimonials]);
  if (testimonials.length === 0) return null;
  return (
    <section
      className={cn(
        "testonomials-section",
        "py-20 bg-white dark:bg-gray-900 relative overflow-hidden",
      )}
    >
      <div className="container mx-auto px-4">
        <ScrollAnimation variant="fadeUp" className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            {t("testimonials_title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("testimonials_subtitle")}
          </p>
        </ScrollAnimation>

        <div className="flex flex-wrap justify-center items-center gap-8 max-w-7xl mx-auto min-h-[400px]">
          {testimonials.map((testimonial, index) => {
            const isCorner = index === 0 || index === 4;
            const isCenter = index === 1 || index === 2 || index === 3;

            return (
              <ScrollAnimation
                key={index}
                variant={index % 2 === 0 ? "fadeLeft" : "fadeRight"}
                delay={index * 0.1}
                className={cn(
                  "testonomials-card",
                  `relative transition-all duration-500 ${testimonial.rotation} ${isCorner
                    ? hoveredCard === index
                      ? "opacity-100 scale-110 z-20"
                      : "opacity-40 scale-95 z-10"
                    : "opacity-100 scale-100 z-15"
                  } ${hoveredCard === index ? "rotate-0" : ""}`,
                )}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div
                  className={`bg-background rounded-2xl p-6 w-80 h-72 transition-all duration-500 border ${hoveredCard === index && isCorner
                      ? "shadow-2xl shadow-brand-primary/30 border-2 border-brand-primary/60 ring-4 ring-brand-primary/30"
                      : isCenter
                        ? "shadow-xl border-border"
                        : "shadow-lg border-border/50"
                    }`}
                >
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 text-brand-primary fill-current"
                      />
                    ))}
                  </div>

                  {/* <p className="text-muted-foreground mb-6 text-sm leading-relaxed line-clamp-4"> */}
                  <div
                    dangerouslySetInnerHTML={{
                      __html: testimonial.content.content,
                    }}
                  />
                  {/* </p> */}

                  <div className="flex items-center mt-auto">
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-3 flex-shrink-0">
                      <Image
                        src={
                          testimonial.author.avatar?.url ||
                          "/courselit_backdrop.webp"
                        }
                        alt={testimonial.author.fullName || "Anonymous"}
                        className="w-full h-full object-cover"
                        width={48}
                        height={48}
                      />
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-sm">
                        {testimonial.author.fullName || "Anonymous"}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollAnimation>
            );
          })}
        </div>
      </div>
    </section>
  );
}
