"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { useProfile } from "@/components/contexts/profile-context";
import { AuthClientService } from "@/lib/auth/client-service";
import { removeAvatar, setGoogleAvatar, uploadAvatar } from "@/server/actions/avatar";
import { trpc } from "@/utils/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@workspace/components-library";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const breadcrumbs = [{ label: "Profile", href: "#" }];

// Zod schema matching the API expectations
const profileSchema = z.object({
  firstName: z.string().min(1, "Name is required").max(100),
  lastName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;


export default function ProfilePage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { toast } = useToast();
  const { profile, setProfile } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      bio: profile?.bio || "",
    },
  });

  // TRPC mutations
  const updateProfileMutation = trpc.userModule.user.updateProfile.useMutation({
    onSuccess: (data) => {
      toast({
        title: t("common:success", "Success"),
        description: t("profile.updated_successfully", "Profile updated successfully"),
      });

      // Update profile context
      if (data && profile) {
        setProfile({
          ...profile,
          firstName: data.firstName || profile.firstName,
          lastName: data.lastName || profile.lastName,
          bio: data.bio || profile.bio,
          avatar: data.avatar || profile.avatar,
          subscribedToUpdates: data.subscribedToUpdates ?? profile.subscribedToUpdates,
        });
      }

      reset({
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        bio: data.bio || "",
      });
    },
    onError: (error) => {
      toast({
        title: t("common:error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (result) => {
      if (result.success && result.avatar && profile) {
        // Serialize ObjectIds to strings for client
        const serializedAvatar = {
          ...result.avatar,
          orgId: result.avatar.orgId.toString(),
          ownerId: result.avatar.ownerId.toString(),
        };
        setProfile({
          ...profile,
          avatar: serializedAvatar as any,
        });
        toast({
          title: t("common:success", "Success"),
          description: t("profile.avatar_uploaded", "Profile picture uploaded successfully"),
        });
      } else if (result.error) {
        toast({
          title: t("common:error", "Error"),
          description: result.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("common:error", "Error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove avatar mutation
  const removeAvatarMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: (result) => {
      if (result.success && profile) {
        setProfile({
          ...profile,
          avatar: undefined,
        });
        toast({
          title: t("common:success", "Success"),
          description: t("profile.avatar_removed", "Profile picture removed"),
        });
      } else if (result.error) {
        toast({
          title: t("common:error", "Error"),
          description: result.error,
          variant: "destructive",
        });
      }
    },
  });

  // Set Google avatar mutation
  const setGoogleAvatarMutation = useMutation({
    mutationFn: setGoogleAvatar,
    onSuccess: (result) => {
      if (result.success && result.avatar && profile) {
        // Serialize ObjectIds to strings for client
        const serializedAvatar = {
          ...result.avatar,
          orgId: result.avatar.orgId.toString(),
          ownerId: result.avatar.ownerId.toString(),
        };
        setProfile({
          ...profile,
          avatar: serializedAvatar as any,
        });
        toast({
          title: t("common:success", "Success"),
          description: t("profile.avatar_reset_success", "Profile picture reset from Google"),
        });
      } else if (result.error) {
        toast({
          title: t("common:error", "Error"),
          description: result.error,
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = async (formData: ProfileFormData) => {
    await updateProfileMutation.mutateAsync({
      data: formData,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    uploadAvatarMutation.mutate(formData);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubscriptionChange = async (checked: boolean) => {
    if (!profile) return;

    updateProfileMutation.mutate({
      data: {
        subscribedToUpdates: checked,
      },
    });
  };

  const handleResetFromGoogle = () => {
    const firebaseProfile = AuthClientService.getCurrentUserProfile();

    if (!firebaseProfile?.photoURL) {
      toast({
        title: t("common:error", "Error"),
        description: t("profile.no_google_avatar", "No Google profile picture found"),
        variant: "destructive",
      });
      return;
    }

    setGoogleAvatarMutation.mutate(firebaseProfile.photoURL);
  };

  if (!profile) {
    return (
      <DashboardContent breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">{t("profile.loading", "Loading profile...")}</p>
          </div>
        </div>
      </DashboardContent>
    );
  }

  const isLoading =
    updateProfileMutation.isPending ||
    isSubmitting ||
    uploadAvatarMutation.isPending ||
    removeAvatarMutation.isPending ||
    setGoogleAvatarMutation.isPending;

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <h1 className="text-4xl font-semibold mb-6">{t("profile.title", "Profile")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.picture", "Profile Picture")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Avatar className="w-32 h-32">
              <AvatarImage
                src={profile.avatar?.url}
                alt={profile.firstName || t("profile.user", "User")}
              />
              <AvatarFallback className="text-2xl">
                {profile.firstName?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>

            {profile.avatar && (
              <p className="text-xs text-center text-muted-foreground">
                {profile.avatar.storageProvider === "custom"
                  ? t("profile.source_google", "From Google")
                  : t("profile.source_cloudinary", "Uploaded to Cloudinary")}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadAvatarMutation.isPending
                  ? t("profile.uploading", "Uploading...")
                  : t("profile.upload_new", "Upload New")}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAvatarMutation.mutate()}
                disabled={isLoading || !profile.avatar}
              >
                {removeAvatarMutation.isPending
                  ? t("profile.removing", "Removing...")
                  : t("profile.remove_picture", "Remove Picture")}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetFromGoogle}
                disabled={isLoading}
              >
                {setGoogleAvatarMutation.isPending
                  ? t("profile.resetting", "Resetting...")
                  : t("profile.reset_from_google", "Reset from Google")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Details Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("profile.details", "Profile Details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("profile.email", "Email")}</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">
                  {t("profile.first_name", "First Name")} *
                </Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  disabled={isLoading}
                  placeholder={t("profile.enter_first_name", "Enter your first name")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  {t("profile.last_name", "Last Name")}
                </Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  disabled={isLoading}
                  placeholder={t("profile.enter_last_name", "Enter your last name")}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t("profile.bio", "Bio")}</Label>
                <Textarea
                  id="bio"
                  {...register("bio")}
                  disabled={isLoading}
                  placeholder={t("profile.bio_placeholder", "Tell us about yourself...")}
                  rows={4}
                  maxLength={500}
                />
                {errors.bio && (
                  <p className="text-sm text-destructive">{errors.bio.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!isDirty || isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading
                  ? t("profile.saving", "Saving...")
                  : t("common:save", "Save Changes")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Email Preferences Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("profile.email_preferences", "Email Preferences")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("profile.newsletter", "Subscribe to newsletter")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("profile.newsletter_desc", "Receive updates about new features and content")}
              </p>
            </div>
            <Checkbox
              checked={profile.subscribedToUpdates}
              onCheckedChange={handleSubscriptionChange}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </DashboardContent>
  );
}
