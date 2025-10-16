import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { CloudinaryService } from "@/server/services/cloudinary";
import { connectToDatabase } from "@workspace/common-logic/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mediaId } = await params;

    if (!mediaId) {
      return NextResponse.json(
        { error: "Media ID is required" },
        { status: 400 },
      );
    }


    // Connect to database
    await connectToDatabase();

    // Find the media record in database
    const mediaRecord = await MediaModel.findOne({
      mediaId: mediaId,
      userId: session.user.userId, // Ensure user owns the media
    });

    if (!mediaRecord) {
      return NextResponse.json(
        { error: "Media not found or you don't have permission to delete it" },
        { status: 404 },
      );
    }
    const storageType = mediaRecord.storageProvider;

    // Delete from storage service based on storage type
    let deleted = false;
    switch (storageType) {
      case "cloudinary":
        deleted = await CloudinaryService.deleteFile(mediaId);
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported storage type" },
          { status: 400 },
        );
    }

    if (deleted) {
      // Remove from database
      await MediaModel.deleteOne({ _id: mediaRecord._id });
      return NextResponse.json({
        success: true,
        message: "success",
      });
    } else {
      throw new Error("Failed to delete media from storage");
    }
  } catch (error: any) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: error.message || "Delete failed" },
      { status: 500 },
    );
  }
}
