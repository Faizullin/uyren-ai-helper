"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form";
import { Textarea } from "@workspace/ui/components/textarea";
import { useToast } from "@workspace/components-library";
import {
  SITE_MAILING_ADDRESS_SETTING_HEADER,
  SITE_MAILING_ADDRESS_SETTING_EXPLANATION,
  BUTTON_SAVE,
  APP_MESSAGE_SETTINGS_SAVED,
  TOAST_TITLE_SUCCESS,
} from "@/lib/ui/config/strings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useSettingsContext } from "./settings-context";

const mailsSettingsSchema = z.object({
  mailingAddress: z.string().optional(),
});

type MailsSettingsFormData = z.infer<typeof mailsSettingsSchema>;

export default function MailsSettings() {
  const { settings, updateSettingsMutation, loadSettingsQuery } =
    useSettingsContext();
  const { toast } = useToast();

  const form = useForm<MailsSettingsFormData>({
    resolver: zodResolver(mailsSettingsSchema),
    defaultValues: {
      mailingAddress: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        mailingAddress: settings.mailingAddress || "",
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: MailsSettingsFormData) => {
    try {
      await updateSettingsMutation.mutateAsync({
        data: {
          mailingAddress: data.mailingAddress,
        },
      });
      toast({
        title: TOAST_TITLE_SUCCESS,
        description: APP_MESSAGE_SETTINGS_SAVED,
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
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="mailingAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{SITE_MAILING_ADDRESS_SETTING_HEADER}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={5}
                    placeholder="Enter mailing address..."
                    disabled={isDisabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <p className="text-xs text-muted-foreground">
            {SITE_MAILING_ADDRESS_SETTING_EXPLANATION}
          </p>

          <Button
            type="submit"
            disabled={isDisabled}
            className="w-full sm:w-auto"
          >
            {isSaving || isSubmitting ? "Saving..." : BUTTON_SAVE}
          </Button>
        </form>
      </Form>
    </div>
  );
}
