"use server";

import { authOptions } from "@/lib/auth/options";
import { getDomainData } from "@/server/lib/domain";
import { CloudinaryService } from "@/server/services/cloudinary";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { IAttachmentMedia, MediaAccessTypeEnum } from "@workspace/common-logic/models/media.types";
import { DomainModel } from "@workspace/common-logic/models/organization.model";
import { UserModel } from "@workspace/common-logic/models/user.model";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";

interface UploadAvatarResult {
    success: boolean;
    avatar?: IAttachmentMedia;
    error?: string;
}

/**
 * Upload and set user avatar using Cloudinary
 */
export async function uploadAvatar(formData: FormData): Promise<UploadAvatarResult> {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }
        const { domainObj } = await getDomainData();
        if (!domainObj) {
            return { success: false, error: "Domain not found" };
        }
        const file = formData.get("file") as File;
        if (!file) {
            return { success: false, error: "No file provided" };
        }
        if (!file.type.startsWith("image/")) {
            return { success: false, error: "Only image files are allowed" };
        }
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return { success: false, error: "File size exceeds 5MB limit" };
        }
        await connectToDatabase();
        const domainDoc = await DomainModel.findOne({ name: domainObj.name });
        if (!domainDoc) {
            return { success: false, error: "Domain document not found" };
        }

        const userObjectId = new mongoose.Types.ObjectId(session.user.id);

        // Upload to Cloudinary
        const media = await CloudinaryService.uploadFile(
            {
                file,
                userId: userObjectId,
                type: "avatars",
                caption: "Profile picture",
                access: MediaAccessTypeEnum.PUBLIC,
            },
            domainDoc
        );

        // Update user avatar in database
        const user = await UserModel.findOne({
            _id: userObjectId,
            orgId: domainObj.orgId,
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        user.avatar = media;
        await user.save();

        return {
            success: true,
            avatar: media,
        };
    } catch (error: any) {
        console.error("Avatar upload error:", error);
        return {
            success: false,
            error: error.message || "Upload failed",
        };
    }
}

/**
 * Remove user avatar
 */
export async function removeAvatar(): Promise<UploadAvatarResult> {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Get domain data
        const { domainObj: domainData } = await getDomainData();
        if (!domainData) {
            return { success: false, error: "Domain not found" };
        }

        // Update user avatar in database
        await connectToDatabase();

        const userObjectId = new mongoose.Types.ObjectId(session.user.id);
        const user = await UserModel.findOne({
            _id: userObjectId,
            orgId: domainData.orgId,
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Optional: Delete old avatar from Cloudinary if it exists
        if (user.avatar?.metadata?.public_id) {
            try {
                await CloudinaryService.deleteFile(user.avatar.metadata.public_id);
            } catch (error) {
                console.error("Failed to delete old avatar from Cloudinary:", error);
            }
        }

        user.avatar = undefined;
        await user.save();

        return {
            success: true,
        };
    } catch (error: any) {
        console.error("Avatar removal error:", error);
        return {
            success: false,
            error: error.message || "Removal failed",
        };
    }
}

/**
 * Set avatar from Google profile picture
 */
export async function setGoogleAvatar(photoURL: string): Promise<UploadAvatarResult> {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Get domain data
        const { domainObj: domainData } = await getDomainData();
        if (!domainData) {
            return { success: false, error: "Domain not found" };
        }

        // Update user avatar in database
        await connectToDatabase();

        const userId = new mongoose.Types.ObjectId(session.user.id);

        const user = await UserModel.findOne({
            _id: userId,
            orgId: domainData.orgId,
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const googleAvatar: IAttachmentMedia = {
            orgId: domainData.orgId,
            ownerId: userId,
            storageProvider: "custom",
            url: photoURL,
            originalFileName: "google_profile_picture",
            mimeType: "image/jpeg",
            size: 0,
            access: MediaAccessTypeEnum.PUBLIC,
            thumbnail: photoURL,
            caption: "Google profile picture",
        };

        user.avatar = googleAvatar;
        await user.save();

        return {
            success: true,
            avatar: googleAvatar,
        };
    } catch (error: any) {
        console.error("Google avatar set error:", error);
        return {
            success: false,
            error: error.message || "Failed to set Google avatar",
        };
    }
}

