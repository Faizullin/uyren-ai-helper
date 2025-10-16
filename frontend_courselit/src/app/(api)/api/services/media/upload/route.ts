import { authOptions } from "@/lib/auth/options";
import { getDomainData } from "@/server/lib/domain";
import MediaModel from "@/models/Media";
import { CloudinaryService } from "@/server/services/cloudinary";
import { connectToDatabase } from "@workspace/common-logic";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Connect to database
    await connectToDatabase();
    const domainData = await getDomainData();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const storageType = searchParams.get("storageType");

    // Currently only cloudinary is supported
    if (storageType !== "cloudinary") {
      return NextResponse.json(
        {
          error:
            "Unsupported storage type. Currently only 'cloudinary' is supported.",
        },
        { status: 400 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const caption = formData.get("caption") as string;
    const access = formData.get("access") as string;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 100MB limit" },
        { status: 400 },
      );
    }

    if (!domainData.domainObj) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Upload using the appropriate service based on storage type
    let media;
    switch (storageType) {
      case "cloudinary":
        media = await CloudinaryService.uploadFile({
          file,
          userId: session.user.userId,
          type,
          caption,
          access,
        }, domainData.domainObj);
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported storage type" },
          { status: 400 },
        );
    }

    // Save media record to database
    const mediaRecord = new MediaModel({
      userId: session.user.userId,
      domain: domainData.domainObj._id,
      mediaId: media.mediaId,
      originalFileName: media.originalFileName,
      mimeType: media.mimeType,
      size: media.size,
      access: media.access,
      thumbnail: media.thumbnail,
      caption: caption,
      file: media.file,
      url: media.url,
      storageProvider: "cloudinary",
      metadata: media.metadata,
    });

    await mediaRecord.save();

    return NextResponse.json(mediaRecord.toJSON());
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}
