"use client";

import { useTranslation } from "react-i18next";
import Footer from "@/components/layout/footer";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import {
  CheckCircle,
  Users,
  GraduationCap,
  Heart,
  FileText,
  UserCheck,
  Clock,
  Award,
  ChevronRight,
} from "lucide-react";
import { GrantApplicationForm } from "./_components/grant-application-form";
import Header from "@/components/layout/header";
import { useDialogControl } from "@workspace/components-library";

export default function GrantsPage() {
  const { t } = useTranslation("common");
  const grantFormControl = useDialogControl();

  const grantTypes = [
    {
      title: t("grant_100_title"),
      description: t("grant_100_desc"),
      icon: <Award className="h-8 w-8 text-brand-primary" />,
      highlight: true,
    },
    {
      title: t("grant_50_title"),
      description: t("grant_50_desc"),
      icon: <Heart className="h-8 w-8 text-brand-primary" />,
      highlight: false,
    },
  ];

  const audiences = [
    {
      title: t("audience_highschool_title"),
      subtitle: t("audience_highschool_subtitle"),
      description: t("audience_highschool_desc"),
      icon: <GraduationCap className="h-6 w-6" />,
    },
    {
      title: t("audience_university_title"),
      subtitle: t("audience_university_subtitle"),
      description: t("audience_university_desc"),
      icon: <Users className="h-6 w-6" />,
    },
    {
      title: t("audience_motivated_title"),
      subtitle: t("audience_motivated_subtitle"),
      description: t("audience_motivated_desc"),
      icon: <Heart className="h-6 w-6" />,
    },
  ];

  const steps = [
    {
      title: t("step_apply_title"),
      description: t("step_apply_desc"),
      icon: <FileText className="h-6 w-6" />,
    },
    {
      title: t("step_test_title"),
      description: t("step_test_desc"),
      icon: <CheckCircle className="h-6 w-6" />,
    },
    {
      title: t("step_review_title"),
      description: t("step_review_desc"),
      icon: <UserCheck className="h-6 w-6" />,
    },
    {
      title: t("step_decision_title"),
      description: t("step_decision_desc"),
      icon: <Award className="h-6 w-6" />,
    },
    {
      title: t("step_maintain_title"),
      description: t("step_maintain_desc"),
      icon: <Clock className="h-6 w-6" />,
    },
  ];

  const testimonials = [
    {
      name: t("testimonial_aruzhan_name"),
      role: t("testimonial_aruzhan_role"),
      content: t("testimonial_aruzhan_content"),
      avatar: "AK",
    },
    {
      name: t("testimonial_nursultan_name"),
      role: t("testimonial_nursultan_role"),
      content: t("testimonial_nursultan_content"),
      avatar: "NT",
    },
    {
      name: t("testimonial_aigerim_name"),
      role: t("testimonial_aigerim_role"),
      content: t("testimonial_aigerim_content"),
      avatar: "AS",
    },
  ];

  const faqs = [
    {
      question: t("faq_eligible_question"),
      answer: t("faq_eligible_answer"),
    },
    {
      question: t("faq_test_question"),
      answer: t("faq_test_answer"),
    },
    {
      question: t("faq_duration_question"),
      answer: t("faq_duration_answer"),
    },
    {
      question: t("faq_reapply_question"),
      answer: t("faq_reapply_answer"),
    },
    {
      question: t("faq_data_question"),
      answer: t("faq_data_answer"),
    },
  ];

  return (
    <main className="page-transition">
      <Header />

      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-black via-gray-900 to-black py-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(241,81,27,0.1),transparent_50%)]" />
          <div className="container mx-auto max-w-4xl text-center relative z-10">
            <div className="animate-fade-in-up">
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                {t("grants_hero_title")}{" "}
                <span className="text-brand-primary">
                  {t("grants_hero_title_highlight")}
                </span>
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                {t("grants_hero_desc")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-3 text-lg font-semibold transition-all duration-300 transform hover:scale-105"
                  onClick={() => grantFormControl.show()}
                >
                  {t("btn_apply_grant")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-black px-8 py-3 text-lg font-semibold transition-all duration-300 bg-transparent"
                >
                  {t("btn_see_eligibility")}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* What We Offer */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-black mb-4">
                {t("section_what_we_offer_title")}
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {t("section_what_we_offer_desc")}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {grantTypes.map((grant, index) => (
                <Card
                  key={index}
                  className={`group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${
                    grant.highlight ? "ring-2 ring-brand-primary" : ""
                  }`}
                >
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto mb-4 p-3 bg-brand-primary/10 rounded-full w-fit">
                      {grant.icon}
                    </div>
                    <CardTitle className="text-2xl font-bold text-black mb-2">
                      {grant.title}
                      {grant.highlight && (
                        <Badge className="ml-2 bg-brand-primary text-white">
                          {t("most_popular")}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 text-lg leading-relaxed">
                      {grant.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Who Can Apply */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-black mb-4">
                {t("section_who_can_apply_title")}
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {t("section_who_can_apply_desc")}
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {audiences.map((audience, index) => (
                <Card
                  key={index}
                  className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-brand-primary/10 rounded-lg">
                        {audience.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-black">
                          {audience.title}
                        </CardTitle>
                        <p className="text-brand-primary font-medium">
                          {audience.subtitle}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-gray-600 leading-relaxed">
                      {audience.description}
                    </CardDescription>
                    <Button
                      variant="ghost"
                      className="mt-4 text-brand-primary hover:text-brand-primary-hover p-0"
                    >
                      {t("btn_view_details")}{" "}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-black mb-4">
                {t("section_how_it_works_title")}
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {t("section_how_it_works_desc")}
              </p>
            </div>
            <div className="relative">
              <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-gray-300 z-0 hidden md:block"></div>
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-start gap-6 mb-12 last:mb-0 relative"
                >
                  <div className="flex-shrink-0 flex flex-col items-center z-10">
                    <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="text-xl font-bold text-black mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Selection Criteria */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-black mb-4">
                {t("section_selection_criteria_title")}
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {t("section_selection_criteria_desc")}
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-black flex items-center gap-3">
                    <Award className="h-6 w-6 text-brand-primary" />
                    {t("criteria_merit_title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
                      {t("criteria_merit_item_1")}
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
                      {t("criteria_merit_item_2")}
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
                      {t("criteria_merit_item_3")}
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-black flex items-center gap-3">
                    <Heart className="h-6 w-6 text-brand-primary" />
                    {t("criteria_need_title")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
                      {t("criteria_need_item_1")}
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
                      {t("criteria_need_item_2")}
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" />
                      {t("criteria_need_item_3")}
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-black mb-4">
                {t("section_testimonials_title")}
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {t("section_testimonials_desc")}
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card
                  key={index}
                  className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <CardContent className="pt-6">
                    <p className="text-gray-600 mb-6 leading-relaxed italic">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-white font-bold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-semibold text-black">
                          {testimonial.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4 bg-gradient-to-br from-black via-gray-900 to-black">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              {t("cta_ready_to_apply")}
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              {t("cta_ready_desc")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-3 text-lg font-semibold transition-all duration-300 transform hover:scale-105"
                onClick={() => grantFormControl.show()}
              >
                {t("btn_apply_grant")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-black px-8 py-3 text-lg font-semibold transition-all duration-300 bg-transparent"
              >
                {t("btn_contact_support")}
              </Button>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-black mb-4">
                {t("section_faq_title")}
              </h2>
              <p className="text-xl text-gray-600">{t("section_faq_desc")}</p>
            </div>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-white rounded-lg px-6"
                >
                  <AccordionTrigger className="text-left font-semibold text-black hover:text-brand-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <GrantApplicationForm control={grantFormControl} />
      </div>

      <Footer />
    </main>
  );
}
