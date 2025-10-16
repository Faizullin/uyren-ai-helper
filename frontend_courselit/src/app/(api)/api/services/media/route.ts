// import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth/options";
// import { getDomainData } from "@/server/lib/domain";

// export async function GET(request: NextRequest) {
//   try {
//     // Get domain data (required)
//     const domainData = await getDomainData();
//     if (!domainData.domainObj) {
//       return NextResponse.json({ error: "Domain not found" }, { status: 404 });
//     }
//     // Get session to check authentication
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // Parse query parameters
//     const { searchParams } = new URL(request.url);
//     const q = searchParams.get("q") || "";
//     const mimeType = searchParams.get("mimeType") || "";
//     const skip = parseInt(searchParams.get("skip") || "0");
//     const take = parseInt(searchParams.get("take") || "20");

//     // Build search query
//     const searchQuery: any = {
//       domain: domainData.domainObj._id, // Filter by domain
//     };

//     if (q) {
//       searchQuery.$or = [
//         { originalFileName: { $regex: q, $options: "i" } },
//         { caption: { $regex: q, $options: "i" } },
//       ];
//     }

//     if (mimeType) {
//       searchQuery.mimeType = { $regex: mimeType, $options: "i" };
//     }

//     // Get total count
//     const total = await MediaModel.countDocuments(searchQuery);

//     // Get paginated results
//     const items = await MediaModel.find(searchQuery)
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(take)
//       .lean();

//     const hasMore = skip + take < total;

//     return NextResponse.json({
//       items,
//       total,
//       meta: {
//         hasMore,
//         skip,
//         take,
//       },
//     });
//   } catch (error) {
//     console.error("Media list API error:", error);
//     return NextResponse.json(
//       { error: "Internal server error" },
//       { status: 500 },
//     );
//   }
// }
