"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@workspace/ui/components/form";
import { Input } from "@workspace/ui/components/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

interface BannerSettingsProps {
  form: UseFormReturn<any>;
}

export const BannerSettings = React.memo<BannerSettingsProps>(({ form }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Banner Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <FormField
          control={form.control}
          name="showBanner"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Show main page banner</FormLabel>
                <FormDescription>
                  Display a banner section on the homepage
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {form.watch("showBanner") && (
          <div className="space-y-4 pl-6 border-l-2 border-muted">
            <FormField
              control={form.control}
              name="bannerTitle"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Banner Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter banner title"
                      {...field}
                      className={fieldState.error ? "border-destructive" : ""}
                    />
                  </FormControl>
                  {fieldState.error && (
                    <p className="text-sm text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bannerSubtitle"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Banner Subtitle</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter banner subtitle"
                      {...field}
                      className={fieldState.error ? "border-destructive" : ""}
                    />
                  </FormControl>
                  {fieldState.error && (
                    <p className="text-sm text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </FormItem>
              )}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

BannerSettings.displayName = "BannerSettings";
