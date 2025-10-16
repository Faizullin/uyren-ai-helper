import { authOptions } from "@/lib/auth/options";
import ActivityModel from "@/models/Activity";
import ApiKeyModel from "@/models/ApiKey";
import CommunityModel from "@/models/community/Community";
import CourseModel from "@/models/Course";
import DomainModel from "@/models/Domain";
import LessonModel from "@/models/Lesson";
import AssignmentModel from "@/models/lms/Assignment";
import QuizModel from "@/models/lms/Quiz";
import MediaModel from "@/models/Media";
import MembershipModel from "@/models/Membership";
import UserModel from "@/models/User";
import { ListInputSchema } from "@/server/api/core/schema";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MODEL_REGISTRY = {
    users: UserModel,
    courses: CourseModel,
    quizzes: QuizModel,
    media: MediaModel,
    assignments: AssignmentModel,
    lessons: LessonModel,
    domains: DomainModel,
    activities: ActivityModel,
    apikeys: ApiKeyModel,
    memberships: MembershipModel,
} as const;

type ModelKey = keyof typeof MODEL_REGISTRY;

const GetParamsSchema = z.object({
    model: z.enum(Object.keys(MODEL_REGISTRY) as [ModelKey, ...ModelKey[]]),
    search: z.string().optional(),
    skip: z.coerce.number().min(0).default(0),
    take: z.coerce.number().min(1).max(100).default(50),
});

async function getActionContext(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return { error: "Unauthorized", status: 401 };
    }

    await connectToDatabase();

    const user = await UserModel.findOne({ email: session.user.email }).lean();
    if (!user) {
        return { error: "User not found", status: 404 };
    }

    const isAdmin = user.roles?.includes("admin");
    if (!isAdmin) {
        return { error: "Admin access required", status: 403 };
    }

    return {
        user: {
            _id: user._id,
            userId: user.userId,
            email: user.email,
            name: user.name,
            roles: user.roles || [],
            permissions: user.permissions || [],
            domain: user.domain
        },
        domain: user.domain,
        isValid: true
    };
}

function buildQuery(model: string, context: any, listInput: z.infer<typeof ListInputSchema>) {
    const query: any = {
    };

    if (listInput.search?.q) {
        const searchFields = getSearchFields(model);
        query.$or = searchFields.map(field => ({
            [field]: { $regex: listInput.search!.q, $options: "i" }
        }));
    }

    if (listInput.filter) {
        Object.entries(listInput.filter).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                query[key] = value;
            }
        });
    }

    return query;
}

function getSearchFields(model: string): string[] {
    const fieldMap: Record<string, string[]> = {
        users: ["name", "email"],
        courses: ["title", "description"],
        quizzes: ["title", "description"],
        media: ["originalFileName", "caption"],
        assignments: ["title", "description"],
        lessons: ["title", "description"],
        domains: ["name"],
        activities: ["type"],
        apikeys: ["name"],
        pages: ["title", "description"],
        progress: [],
        memberships: [],
    };
    return fieldMap[model] || ["name", "title"];
}

export async function GET(req: NextRequest) {
    const context = await getActionContext(req);
    if (!context.isValid) {
        return NextResponse.json({ error: context.error }, { status: context.status });
    }

    try {
        const { searchParams } = new URL(req.url);
        const params = GetParamsSchema.parse({
            model: searchParams.get("model"),
            search: searchParams.get("search"),
            skip: searchParams.get("skip"),
            take: searchParams.get("take"),
        });

        const listInput: z.infer<typeof ListInputSchema> = {
            search: params.search ? { q: params.search } : undefined,
            pagination: { skip: params.skip, take: params.take, includePaginationCount: true },
            orderBy: { field: "updatedAt", direction: "desc" }
        };

        const Model = MODEL_REGISTRY[params.model] as any;
        const query = buildQuery(params.model, context, listInput);

        const data = await Model.find(query)
            .sort({ [listInput.orderBy?.field || "updatedAt"]: listInput.orderBy?.direction === "asc" ? 1 : -1 })
            .skip(params.skip)
            .limit(params.take)
            .lean();

        const total = await Model.countDocuments(query);
        const hasMore = params.skip + params.take < total;

        return NextResponse.json({ data, total, hasMore });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid parameters", details: error.issues }, { status: 400 });
        }
        console.error("Studio GET error:", error);
        return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }
}

const PostBodySchema = z.object({
    model: z.enum(Object.keys(MODEL_REGISTRY) as [ModelKey, ...ModelKey[]]),
    data: z.record(z.string(), z.any()),
});

export async function POST(req: NextRequest) {
    const context = await getActionContext(req);
    if (!context.isValid) {
        return NextResponse.json({ error: context.error }, { status: context.status });
    }

    try {
        const body = PostBodySchema.parse(await req.json());
        const Model = MODEL_REGISTRY[body.model] as any;
        const recordData: any = { ...body.data, };

        if (body.model === "users") {
            recordData.userId = `user_${Date.now()}`;
            recordData.unsubscribeToken = `unsub_${Date.now()}`;
        }
        if (body.model === "courses") {
            recordData.courseId = `course_${Date.now()}`;
            recordData.instructor = context.user.userId;
        }
        if (body.model === "quizzes") {
            recordData.ownerId = context.user.userId;
        }
        if (body.model === "assignments") {
            recordData.ownerId = context.user.userId;
        }
        if (body.model === "apikeys") {
            recordData.createdBy = context.user.userId;
        }

        const newRecord = new Model(recordData);
        const savedRecord = await newRecord.save();

        return NextResponse.json(savedRecord.toObject());
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
        }
        console.error("Studio POST error:", error);
        return NextResponse.json({ error: error.message || "Failed to create record" }, { status: 500 });
    }
}

const PutBodySchema = z.object({
    model: z.enum(Object.keys(MODEL_REGISTRY) as [ModelKey, ...ModelKey[]]),
    id: z.string(),
    data: z.record(z.string(), z.any()),
});

export async function PUT(req: NextRequest) {
    const context = await getActionContext(req);
    if (!context.isValid) {
        return NextResponse.json({ error: context.error }, { status: context.status });
    }

    try {
        const body = PutBodySchema.parse(await req.json());
        const Model = MODEL_REGISTRY[body.model] as any;

        const updatedRecord = await Model.findOneAndUpdate(
            { _id: body.id, },
            body.data,
            { new: true }
        );

        if (!updatedRecord) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        return NextResponse.json(updatedRecord.toObject());
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
        }
        console.error("Studio PUT error:", error);
        return NextResponse.json({ error: error.message || "Failed to update record" }, { status: 500 });
    }
}

const DeleteParamsSchema = z.object({
    model: z.enum(Object.keys(MODEL_REGISTRY) as [ModelKey, ...ModelKey[]]),
    id: z.string(),
});

export async function DELETE(req: NextRequest) {
    const context = await getActionContext(req);
    if (!context.isValid) {
        return NextResponse.json({ error: context.error }, { status: context.status });
    }

    try {
        const { searchParams } = new URL(req.url);
        const params = DeleteParamsSchema.parse({
            model: searchParams.get("model"),
            id: searchParams.get("id"),
        });

        const Model = MODEL_REGISTRY[params.model] as any;
        const deletedRecord = await Model.findOneAndDelete({
            _id: params.id,
        });

        if (!deletedRecord) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, id: params.id });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid parameters", details: error.issues }, { status: 400 });
        }
        console.error("Studio DELETE error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete record" }, { status: 500 });
    }
}
