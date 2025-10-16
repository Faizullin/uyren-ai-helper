"use client";

import { trpc } from "@/utils/trpc";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { ThemeAssetTypeEnum } from "@workspace/common-logic/models/theme.types";
import { useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useThemeContext } from "./theme-context";

export default function ThemeSettings() {
  const { mode, theme } = useThemeContext();

  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    publicationStatus: PublicationStatusEnum.DRAFT,
  });

  const createMutation = trpc.lmsModule.themeModule.theme.create.useMutation({
    onSuccess: (response) => {
      toast({
        title: "Success",
        description: "Theme created successfully",
      });
      router.push(`/dashboard/lms/themes/${response._id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = trpc.lmsModule.themeModule.theme.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Theme updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = useCallback(async () => {
    if (mode === "create") {
      const defaultTheme = {
        name: formData.name,
        description: formData.description,
        publicationStatus: formData.publicationStatus,
        stylesCss: `/* Default theme styles */`,
        assets: [
          {
            assetType: ThemeAssetTypeEnum.FONT,
            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
            preload: true,
            rel: "stylesheet",
            name: "Inter Font",
            description: "Google Fonts Inter font family",
          },
        ],
      };
      createMutation.mutate({ data: defaultTheme });
    } else if (theme?._id) {
      updateMutation.mutate({
        id: `${theme._id}`,
        data: formData,
      });
    }
  }, [mode, theme, formData, createMutation, updateMutation]);

  useEffect(() => {
    if (theme && mode === "edit") {
      setFormData({
        name: theme.name || "",
        description: theme.description || "",
        publicationStatus: theme.publicationStatus || PublicationStatusEnum.DRAFT,
      });
    }
  }, [theme, mode]);

  return (
    <div className="space-y-6 mt-2">
      <Card>
        <CardHeader>
          <CardTitle>Theme Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Theme Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter theme name..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter theme description..."
              rows={3}
            />
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSave}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formData.name.trim()
              }
            >
              <Save className="h-4 w-4 mr-2" />
              {mode === "create" ? "Create Theme" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {theme && (
        <Card>
          <CardHeader>
            <CardTitle>Theme Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Created</Label>
              <div className="text-sm text-muted-foreground">
                {new Date(theme.createdAt || "").toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <div className="text-sm text-muted-foreground">
                {new Date(theme.updatedAt || "").toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Owner ID</Label>
              <div className="text-sm text-muted-foreground">
                {theme.ownerId}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
