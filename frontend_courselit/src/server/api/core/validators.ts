import { MediaAccessTypeEnum } from "@workspace/common-logic/models/media.types";
import mongoose from "mongoose";
import { z } from "zod";

// MongoDB ObjectId validator for documents
export const documentIdValidator = (zod = z) => {
  return zod
    .string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "DocumentId must be a valid MongoDB ObjectId",
    })
    .transform((val) => val); // Keep as string for easier handling
};

// Slug: lowercase, numbers, dashes; no leading/trailing dashes
export const documentSlugValidator = (zod = z) => {
  return zod
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase, alphanumeric, and dash-separated",
    );
};

// Optional utility: normalize a title to a slug
export const toSlug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const mediaWrappedFieldValidator = (zod = z) => {
  return zod.object({
    mediaId: z.string(),
    originalFileName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    access: z.nativeEnum(MediaAccessTypeEnum),
    thumbnail: z.string(),
    // caption is an optional string
    caption: z.string().optional(),
    // file is an optional string
    file: z.string().optional(),
    url: z.string(),
    // storageProvider must be one of 'local' or 'cloudinary'
    storageProvider: z.enum(["local", "cloudinary", "custom"]),
    domain: z.string().optional(),
    userId: z.string().optional(),
  });
};

export const textEditorContentValidator = (
  zod = z,
  options?: {
    requiredEditorType?: "tiptap" | "text";
  },
) => {
  return zod
    .object({
      type: z.enum(["doc"]),
      content: z.string(),
      assets: z.array(z.any()),
      widgets: z.array(z.any()),
      config: z.object({
        editorType: z.enum(["tiptap", "text"]),
      }),
    })
    .refine(
      (data) => {
        if (options?.requiredEditorType) {
          return data.config.editorType === options.requiredEditorType;
        }
        return true;
      },
      {
        message: "Editor type must be " + options?.requiredEditorType,
      },
    );
};
