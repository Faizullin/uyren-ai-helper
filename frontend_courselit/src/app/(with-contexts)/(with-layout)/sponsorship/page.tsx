"use client";

import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Award,
  Building,
  CheckCircle,
  Heart,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type React from "react";
import { useState } from "react";

type SuccessStory = {
  company: string;
  logo: React.ReactNode;
  testimonial: string;
  impact: string;
  person: string;
};

type Benefit = {
  icon: React.ReactNode;
  title: string;
  description: string;
  stat: string;
};

export default function SponsorshipPage() {
  const { t } = useTranslation("common");

  const successStories = t("sponsorship.stories", {
    returnObjects: true,
  }) as SuccessStory[];
  const benefits = t("sponsorship.benefits", {
    returnObjects: true,
  }) as Benefit[];

  const tiers = t("sponsorship.tiers", { returnObjects: true }) as {
    name: string;
    description: string;
    price: string;
    popular: boolean;
    features: string[];
  }[];

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    sponsorshipType: "",
    budget: "",
    message: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const budgetOptions = [
    { value: "5k-15k", label: "$5,000 - $15,000" },
    { value: "15k-50k", label: "$15,000 - $50,000" },
    { value: "50k+", label: "$50,000+" },
    { value: "custom", label: t("sponsorship.budget_custom") },
  ];

  return (
    <main className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-black via-gray-900 to-black py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(241,81,27,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-brand-primary/20 text-brand-primary border-brand-primary/30 hover:bg-brand-primary/30 transition-colors">
              {t("sponsorship.hero_badge")}
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {t("sponsorship.hero_title")}{" "}
              <span className="text-brand-primary bg-clip-text">UyrenAI</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              {t("sponsorship.hero_desc")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <Heart className="mr-2 h-5 w-5" />
                {t("sponsorship.hero_cta_sponsor")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 px-8 py-3 rounded-full font-semibold transition-all duration-300 bg-transparent"
              >
                {t("sponsorship.hero_cta_tiers")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Partner Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t("sponsorship.why_partner_title")}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t("sponsorship.why_partner_desc")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-300 border-gray-200 dark:border-gray-700 hover:border-brand-primary/30"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 bg-brand-primary/10 rounded-full text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                    {index === 0 && <Users className="h-8 w-8" />}
                    {index === 1 && <Target className="h-8 w-8" />}
                    {index === 2 && <TrendingUp className="h-8 w-8" />}
                    {index === 3 && <Award className="h-8 w-8" />}
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                    {benefit.title}
                  </CardTitle>
                  <Badge variant="secondary" className="mx-auto">
                    {benefit.stat}
                  </Badge>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-gray-600 dark:text-gray-300">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sponsorship Tiers */}
      <section className="m--sponsorship-tiers py-20 bg-gray-50 dark:bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t("sponsorship.tiers_title")}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t("sponsorship.tiers_desc")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {(
              t("sponsorship.tiers", { returnObjects: true }) as {
                name: string;
                description: string;
                price: string;
                popular: boolean;
                features: string[];
              }[]
            ).map((tier, index) => (
              <Card
                key={index}
                className={`m--tier-card relative ${
                  tier.popular
                    ? "border-brand-primary shadow-xl scale-105"
                    : "border-gray-200 dark:border-gray-700"
                } hover:shadow-xl transition-all duration-300`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-brand-primary text-white px-4 py-1">
                      {t("sponsorship.most_popular")}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                    {tier.name}
                  </CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-brand-primary">
                      {tier.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-300">
                      /{t("sponsorship.per_year")}
                    </span>
                  </div>
                  <CardDescription className="mt-2">
                    {tier.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center text-gray-600 dark:text-gray-300"
                      >
                        <CheckCircle className="h-5 w-5 text-brand-primary mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${
                      tier.popular
                        ? "bg-brand-primary hover:bg-brand-primary-hover"
                        : "bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                    } transition-colors`}
                  >
                    {t("sponsorship.choose_tier", { tier: tier.name })}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                {t("sponsorship.form_title")}
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                {t("sponsorship.form_desc")}
              </p>
            </div>

            <Card className="shadow-xl border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-2xl text-center text-gray-900 dark:text-white">
                  {t("sponsorship.form_header")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">
                        {t("sponsorship.form_company_name")}
                      </Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) =>
                          handleInputChange("companyName", e.target.value)
                        }
                        placeholder={t(
                          "sponsorship.form_company_name_placeholder",
                        )}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactName">
                        {t("sponsorship.form_contact_name")}
                      </Label>
                      <Input
                        id="contactName"
                        value={formData.contactName}
                        onChange={(e) =>
                          handleInputChange("contactName", e.target.value)
                        }
                        placeholder={t(
                          "sponsorship.form_contact_name_placeholder",
                        )}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        {t("sponsorship.form_email")}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        placeholder={t("sponsorship.form_email_placeholder")}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        {t("sponsorship.form_phone")}
                      </Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          handleInputChange("phone", e.target.value)
                        }
                        placeholder="+7 XXX XXX XXXX"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="sponsorshipType">
                        {t("sponsorship.form_sponsorship_type")}
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          handleInputChange("sponsorshipType", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "sponsorship.form_sponsorship_type_placeholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {tiers.map((tier) => (
                            <SelectItem key={tier.price} value={tier.price}>
                              {tier.name} ({tier.price})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="budget">
                        {t("sponsorship.form_budget")}
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          handleInputChange("budget", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "sponsorship.form_budget_placeholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {budgetOptions.map((budget) => (
                            <SelectItem key={budget.value} value={budget.value}>
                              {budget.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">
                      {t("sponsorship.form_message")}
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        handleInputChange("message", e.target.value)
                      }
                      placeholder={t("sponsorship.form_message_placeholder")}
                      rows={4}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-3 transition-all duration-300 transform hover:scale-105"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    {t("sponsorship.form_submit")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-20 bg-gray-50 dark:bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t("sponsorship.stories_title")}
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              {t("sponsorship.stories_desc")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {successStories.map((story, index) => (
              <Card
                key={index}
                className="hover:shadow-xl transition-all duration-300 border-gray-200 dark:border-gray-700"
              >
                <CardHeader>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="text-3xl">{story.logo}</div>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">
                        {story.company}
                      </CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {story.impact}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <blockquote className="text-gray-600 dark:text-gray-300 mb-4 italic">
                    "{story.testimonial}"
                  </blockquote>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    — {story.person}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-brand-primary to-orange-400">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            {t("sponsorship.cta_title")}
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            {t("sponsorship.cta_desc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-brand-primary hover:bg-gray-100 px-8 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105"
            >
              <Building className="mr-2 h-5 w-5" />
              {t("sponsorship.cta_schedule")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 px-8 py-3 rounded-full font-semibold transition-all duration-300 bg-transparent"
            >
              {t("sponsorship.cta_download")}
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
