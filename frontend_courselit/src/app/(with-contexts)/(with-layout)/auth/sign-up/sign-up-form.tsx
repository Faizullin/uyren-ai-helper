"use client";

import { ScrollAnimation } from "@/components/public/scroll-animation";
import { useFirebaseAuth } from "@/hooks/use-auth";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserFriendlyErrorMessage } from "@/lib/auth/error-handler";
import { z } from "zod";

// Zod validation schema
const signUpSchema = z.object({
  name: z.string().min(1, "name_required"),
  email: z.string().email("invalid_email"),
  password: z.string().min(6, "password_too_short"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "passwords_dont_match",
  path: ["confirmPassword"],
});

export default function SignUpForm({ redirectTo }: { redirectTo?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const firebaseAuth = useFirebaseAuth();
  const router = useRouter();
  const { t } = useTranslation("validation");

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.password.trim() && formData.confirmPassword.trim();

  const handleGoogleSignup = async () => {
    try {
      setAuthError(null);
      const result = await firebaseAuth.mutateAsync({ provider: "google" });

      if (result.success) {
        router.push(redirectTo || "/dashboard");
      } else {
        const errorMessage = getUserFriendlyErrorMessage(result.error);
        setAuthError(errorMessage);
      }
    } catch (error) {
      const errorMessage = getUserFriendlyErrorMessage(error);
      setAuthError(errorMessage);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    setAuthError(null);
    setValidationErrors({});
    setIsEmailSubmitting(true);

    try {
      // Validate form with Zod
      const validatedData = signUpSchema.parse(formData);
      
      const result = await firebaseAuth.mutateAsync({
        provider: "signup",
        data: {
          name: validatedData.name,
          email: validatedData.email,
          password: validatedData.password,
        },
      });

      if (result.success) {
        router.push(redirectTo || "/dashboard");
      } else {
        const errorMessage = getUserFriendlyErrorMessage(result.error);
        setAuthError(errorMessage);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setValidationErrors(errors);
      } else {
        const errorMessage = getUserFriendlyErrorMessage(error);
        setAuthError(errorMessage);
      }
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen flex items-center justify-center py-12">
      <div className="w-full max-w-sm px-4">
        <ScrollAnimation variant="fadeUp" delay={0.2}>
          {/* Compact Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t("auth.signup.welcome_back")}
            </h1>
          </div>

          {/* Compact Sign Up Form */}
          <Card className="w-full shadow-lg border border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-center">
                {t("auth.signup.card_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Google Auth */}
              <Button
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center gap-2 h-9 text-sm"
                onClick={handleGoogleSignup}
                disabled={firebaseAuth.isPending}
              >
                {firebaseAuth.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {firebaseAuth.isPending ? t("auth.signup.google_signing_up") : t("auth.signup.google_signup")}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("auth.signup.or_continue")}
                  </span>
                </div>
              </div>

              {/* Error Display */}
              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs">
                  {t(authError)}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="name"
                    className="text-xs font-medium text-foreground mb-1 block"
                  >
                    {t("auth.signup.name_label")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-background text-foreground"
                      placeholder={t("auth.signup.name_placeholder")}
                      required
                    />
                  </div>
                  {validationErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{t(validationErrors.name)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="text-xs font-medium text-foreground mb-1 block"
                  >
                    {t("auth.signup.email_label")}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-background text-foreground"
                      placeholder={t("auth.signup.email_placeholder")}
                      required
                    />
                  </div>
                  {validationErrors.email && (
                    <p className="text-xs text-red-600 mt-1">{t(validationErrors.email)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="text-xs font-medium text-foreground mb-1 block"
                  >
                    {t("auth.signup.password_label")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full pl-8 pr-9 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-background text-foreground"
                      placeholder={t("auth.signup.password_placeholder")}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <p className="text-xs text-red-600 mt-1">{t(validationErrors.password)}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="text-xs font-medium text-foreground mb-1 block"
                  >
                    {t("auth.signup.confirm_password_label")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      className="w-full pl-8 pr-9 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-background text-foreground"
                      placeholder={t("auth.signup.confirm_password_placeholder")}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">{t(validationErrors.confirmPassword)}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white h-9 text-sm font-medium"
                  disabled={!isFormValid || isEmailSubmitting}
                >
                  {isEmailSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      {t("auth.signup.signing_up")}
                    </>
                  ) : (
                    t("auth.signup.signup_button")
                  )}
                </Button>
              </form>

              {/* Sign In Link */}
              <div className="text-center text-xs text-muted-foreground">
                {t("auth.signup.has_account")}{" "}
                <Link
                  href="/auth/sign-in"
                  className="text-brand-primary hover:text-brand-primary-hover font-medium"
                >
                  {t("auth.signup.signin_link")}
                </Link>
              </div>

              <div className="text-center text-xs text-muted-foreground leading-relaxed">
                {t("auth.signup.terms_text")}
              </div>
            </CardContent>
          </Card>
        </ScrollAnimation>
      </div>
    </div>
  );
}
