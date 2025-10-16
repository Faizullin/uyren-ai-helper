"use client";

import { submitGrantApplication } from "@/server/actions/grant-application";
import { FormDialog, useDialogControl, useToast } from "@workspace/components-library";
import { Checkbox } from "@workspace/ui/components/checkbox";
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
import { useMutation } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { useState } from "react";

interface GrantApplicationFormProps {
  control: ReturnType<typeof useDialogControl>;
}

export function GrantApplicationForm({ control }: GrantApplicationFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    educationStatus: "",
    intendedTrack: "",
    aidType: "",
    motivation: "",
    consent: false,
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.educationStatus)
      newErrors.educationStatus = "Education status is required";
    if (!formData.intendedTrack)
      newErrors.intendedTrack = "Intended track is required";
    if (!formData.aidType) newErrors.aidType = "Aid type is required";
    if (!formData.motivation.trim())
      newErrors.motivation = "Motivation statement is required";
    if (formData.motivation.length < 100)
      newErrors.motivation = "Motivation must be at least 100 characters";
    if (!formData.consent)
      newErrors.consent = "You must agree to the privacy policy";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createApplicationMutation = useMutation({
    mutationFn: submitGrantApplication,
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "Success", description: result.message });
        setIsSubmitted(true);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit application", variant: "destructive" });
    },
  });

  const handleSubmit = async () => {
    if (!validateForm()) return;

    createApplicationMutation.mutate({
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      educationStatus: formData.educationStatus as any,
      intendedTrack: formData.intendedTrack as any,
      aidType: formData.aidType as any,
      motivation: formData.motivation,
      consent: formData.consent,
    });
  };

  if (isSubmitted) {
    return (
      <FormDialog
        open={control.isVisible}
        onOpenChange={(open) => {
          if (!open) {
            control.hide();
            setIsSubmitted(false);
          }
        }}
        title="Application Submitted!"
        description="Thank you for applying. We'll review your application and get back to you within 7-10 business days."
        onSubmit={() => {
          control.hide();
          setIsSubmitted(false);
        }}
        submitText="Close"
        maxWidth="md"
      >
        <div className="text-center py-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={control.isVisible}
      onOpenChange={(open) => {
        if (!open) control.hide();
      }}
      title="Grant Application"
      description="Fill out this form to apply for financial aid. All fields marked with * are required."
      onSubmit={handleSubmit}
      isLoading={createApplicationMutation.isPending}
      submitText="Apply for a Grant"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-black">
            Personal Information
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    fullName: e.target.value,
                  }))
                }
                className={errors.fullName ? "border-red-500" : ""}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  phone: e.target.value,
                }))
              }
              className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && (
              <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Education & Program */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-black">
            Education & Program
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="educationStatus">Education Status *</Label>
              <Select
                value={formData.educationStatus}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    educationStatus: value,
                  }))
                }
              >
                <SelectTrigger
                  className={errors.educationStatus ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select your education level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high-school-9">
                    High School Grade 9
                  </SelectItem>
                  <SelectItem value="high-school-10">
                    High School Grade 10
                  </SelectItem>
                  <SelectItem value="high-school-11">
                    High School Grade 11
                  </SelectItem>
                  <SelectItem value="high-school-12">
                    High School Grade 12
                  </SelectItem>
                  <SelectItem value="college">College</SelectItem>
                  <SelectItem value="university">University</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.educationStatus && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.educationStatus}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="intendedTrack">Intended Track *</Label>
              <Select
                value={formData.intendedTrack}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, intendedTrack: value }))
                }
              >
                <SelectTrigger
                  className={errors.intendedTrack ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select your track" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="programming">Programming</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="ai">
                    Artificial Intelligence
                  </SelectItem>
                  <SelectItem value="data-science">Data Science</SelectItem>
                </SelectContent>
              </Select>
              {errors.intendedTrack && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.intendedTrack}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="aidType">Aid Type Requested *</Label>
            <Select
              value={formData.aidType}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, aidType: value }))
              }
            >
              <SelectTrigger
                className={errors.aidType ? "border-red-500" : ""}
              >
                <SelectValue placeholder="Select aid type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100-percent">100% Grant</SelectItem>
                <SelectItem value="50-percent">
                  Up to 50% Discount
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.aidType && (
              <p className="text-sm text-red-500 mt-1">{errors.aidType}</p>
            )}
          </div>
        </div>

        {/* Motivation */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-black">
            Motivation Statement
          </h3>

          <div>
            <Label htmlFor="motivation">
              Tell us why you want to learn and how this grant would help you * (100-1000 characters)
            </Label>
            <Textarea
              id="motivation"
              value={formData.motivation}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  motivation: e.target.value,
                }))
              }
              placeholder="Describe your motivation, goals, and why you need financial assistance..."
              className={`min-h-[120px] ${errors.motivation ? "border-red-500" : ""}`}
              maxLength={1000}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.motivation && (
                <p className="text-sm text-red-500">{errors.motivation}</p>
              )}
              <p className="text-sm text-gray-500">
                {formData.motivation.length}/1000
              </p>
            </div>
          </div>
        </div>

        {/* Consent */}
        <div className="flex items-start space-x-2">
          <Checkbox
            id="consent"
            checked={formData.consent}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                consent: checked as boolean,
              }))
            }
            className={errors.consent ? "border-red-500" : ""}
          />
          <Label htmlFor="consent" className="text-sm leading-relaxed">
            I confirm that the information provided is accurate and agree to
            the privacy policy. I understand that false information may
            result in application rejection.
          </Label>
        </div>
        {errors.consent && (
          <p className="text-sm text-red-500">{errors.consent}</p>
        )}
      </div>
    </FormDialog>
  );
}
