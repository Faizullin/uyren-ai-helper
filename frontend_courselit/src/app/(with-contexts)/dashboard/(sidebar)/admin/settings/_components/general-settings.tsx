"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { zodResolver } from "@hookform/resolvers/zod";
import { IAttachmentMedia } from "@workspace/common-logic/models/media.types";
import { MediaSelector, useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSettingsContext } from "./settings-context";

const generalSettingsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional(),
  hideCourseLitBranding: z.boolean(),
});

type GeneralSettingsFormData = z.infer<typeof generalSettingsSchema>;

export default function GeneralSettings() {
  const { settings, updateSettingsMutation, loadSettingsQuery } =
    useSettingsContext();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [logo, setLogo] = useState<IAttachmentMedia | null>(null);

  const form = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      hideCourseLitBranding: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        title: settings.title || "",
        subtitle: settings.subtitle || "",
        hideCourseLitBranding: settings.hideCourseLitBranding || false,
      });
      setLogo(settings.logo || null);
    }
  }, [settings, form]);

  const onSubmit = async (data: GeneralSettingsFormData) => {
    try {
      await updateSettingsMutation.mutateAsync({
        data: {
          title: data.title,
          subtitle: data.subtitle,
        },
      });
      toast({
        title: "Success",
        description: "Settings saved",
      });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const saveLogo = async (media?: IAttachmentMedia) => {
    try {
      await updateSettingsMutation.mutateAsync({
        data: {
          logo: media || null,
        },
      });
      setLogo(media || null);
      toast({
        title: "Success",
        description: "Settings saved",
      });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isSaving = updateSettingsMutation.isPending;
  const isLoading = loadSettingsQuery.isLoading;
  const isDisabled = isLoading || isSaving || isSubmitting;

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} required disabled={isDisabled} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subtitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subtitle</FormLabel>
                <FormControl>
                  <Input {...field} disabled={isDisabled} />
                </FormControl>
              </FormItem>
            )}
          />
          {/* 
          <FormField
            control={form.control}
            name="hideCourseLitBranding"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {SITE_SETTINGS_COURSELIT_BRANDING_CAPTION}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {SITE_SETTINGS_COURSELIT_BRANDING_SUB_CAPTION}
                    </p>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isDisabled}
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          /> */}

          <Button
            type="submit"
            disabled={isDisabled}
            className="w-full sm:w-auto"
          >
            {isSaving || isSubmitting ? "Saving..." : "Save"}
          </Button>
        </form>
      </Form>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Logo</h3>
        <MediaSelector
          profile={profile}
          title=""
          src={logo?.thumbnail || ""}
          srcTitle={logo?.originalFileName || ""}
          onSelection={(media) => {
            if (media) {
              saveLogo(media);
            }
          }}
          mimeTypesToShow={[...MIMETYPE_IMAGE]}
          access="public"
          strings={{
            buttonCaption: MEDIA_SELECTOR_UPLOAD_BTN_CAPTION,
            removeButtonCaption: MEDIA_SELECTOR_REMOVE_BTN_CAPTION,
          }}
          mediaId={logo?.mediaId || ""}
          onRemove={() => saveLogo()}
          type="domain"
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}
