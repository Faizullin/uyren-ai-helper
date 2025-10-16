import ApikeyModel from "@/models/ApiKey";
import AssignmentModel from "@/models/lms/Assignment";
import { getDomainData } from "@/server/lib/domain";
import { connectToDatabase } from "@workspace/common-logic";
import { BASIC_PUBLICATION_STATUS_TYPE } from "@workspace/common-models";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

interface AttachRequest {
    assignmentId: string;
    externalAssignmentId: string;
    title?: string;
    description?: string;
}


async function validateApiKey(apiKey: string) {
    await connectToDatabase();
    const domainData = await getDomainData();
    if (!domainData.domainObj) return { isValid: false, error: "Domain not found" };

    const apiKeyDoc = await ApikeyModel.findOne({
        key: apiKey,
        domain: domainData.domainObj._id,
    });

    if (!apiKeyDoc) return { isValid: false, error: "Invalid API key" };
    return { isValid: true, domain: domainData.domainObj._id.toString() };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const apiKey = request.headers.get("x-api-key");
    const action = searchParams.get("action");
    console.log("action", action, "x-api-key", apiKey, "searchParams", searchParams);

    if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 401 });

    const validation = await validateApiKey(apiKey);
    if (!validation.isValid) return NextResponse.json({ error: validation.error }, { status: 401 });

    await connectToDatabase();

    if (action === "list") {
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const skip = (page - 1) * limit;

        const assignments = await AssignmentModel.find({
            domain: validation.domain,
            status: BASIC_PUBLICATION_STATUS_TYPE.PUBLISHED
        })
            .skip(skip)
            .limit(limit)
            .select("_id title description courseId assignmentType status externalAssignmentId createdAt")
            .lean();

        const total = await AssignmentModel.countDocuments({ domain: validation.domain });

        return NextResponse.json({
            assignments: assignments.map(a => ({
                _id: a._id.toString(),
                title: a.title,
                description: a.description,
                courseId: a.courseId,
                assignmentType: a.assignmentType,
                status: a.status,
                createdAt: a.createdAt.toISOString(),
            })),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }

    if (action === "get") {
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Assignment ID required" }, { status: 400 });

        const assignment = await AssignmentModel.findOne({ _id: id, domain: validation.domain }).lean();
        if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

        return NextResponse.json({ assignment });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

const submitSchema = z.object({
    assignmentId: z.string(),
    externalAssignmentId: z.string(),
    title: z.string(),
    description: z.string(),
});

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("x-api-key");
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 401 });

    const validation = await validateApiKey(apiKey);
    if (!validation.isValid) return NextResponse.json({ error: validation.error }, { status: 401 });

    await connectToDatabase();

    if (action === "attach") {
        const body: AttachRequest = await request.json();
        const { assignmentId, externalAssignmentId, title, description } = body;

        if (!assignmentId || !externalAssignmentId) {
            return NextResponse.json({ error: "Missing required fields: assignmentId, externalAssignmentId" }, { status: 400 });
        }

        const assignment = await AssignmentModel.findOneAndUpdate(
            { _id: assignmentId, domain: validation.domain },
            {
                externalAssignmentId,
                ...(title && { title }),
                ...(description && { description })
            },
            { new: true }
        );

        if (!assignment) {
            return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            assignment: {
                id: assignment._id.toString(),
                title: assignment.title,
                updatedAt: assignment.updatedAt.toISOString(),
            },
        });
    } else if (action === "submit") {
        const body = await request.json();
        const { error, data } = submitSchema.safeParse(body);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const assignment = await AssignmentModel.findOne({ _id: data.assignmentId, domain: validation.domain });
        if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        throw new Error("Not implemented");
        // const submission = await AssignmentSubmissionModel.create({
        //     assignmentId,
        //     externalAssignmentId,
        //     title,
        //     description,
        // });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
