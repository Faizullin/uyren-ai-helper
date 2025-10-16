import { authOptions } from "@/lib/auth/options";
import { redis } from "@/server/lib/redis";
import UserModel from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const GetParamsSchema = z.object({
  pattern: z.string().optional().default("*"),
  cursor: z.coerce.number().min(0).default(0),
  count: z.coerce.number().min(1).max(1000).default(100),
});

const PostBodySchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  ttl: z.number().optional(),
});

const PutBodySchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  ttl: z.number().optional(),
});

const DeleteParamsSchema = z.object({
  key: z.string().min(1),
});

async function getActionContext(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

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

async function getKeyInfo(key: string) {
  const type = await redis.type(key);
  const ttl = await redis.ttl(key);
  
  let value: any;
  let size: number = 0;
  
  switch (type) {
    case "string":
      value = await redis.get(key);
      size = value ? Buffer.byteLength(value, 'utf8') : 0;
      break;
    case "list":
      value = await redis.lrange(key, 0, -1);
      size = await redis.llen(key);
      break;
    case "set":
      value = await redis.smembers(key);
      size = await redis.scard(key);
      break;
    case "zset":
      value = await redis.zrange(key, 0, -1, "WITHSCORES");
      size = await redis.zcard(key);
      break;
    case "hash":
      value = await redis.hgetall(key);
      size = await redis.hlen(key);
      break;
    default:
      value = null;
      size = 0;
  }
  
  return {
    key,
    type,
    value,
    ttl: ttl === -1 ? null : ttl,
    size
  };
}

export async function GET(req: NextRequest) {
  const context = await getActionContext(req);
  if (!context.isValid) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const params = GetParamsSchema.parse({
      pattern: searchParams.get("pattern"),
      cursor: searchParams.get("cursor"),
      count: searchParams.get("count"),
    });

    const keys = await redis.scan(params.cursor, "MATCH", params.pattern, "COUNT", params.count);
    const keyInfos = await Promise.all(keys[1].map(getKeyInfo));

    return NextResponse.json({
      keys: keyInfos,
      cursor: keys[0],
      hasMore: keys[0] !== "0"
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid parameters", details: error.issues }, { status: 400 });
    }
    console.error("Redis GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch Redis data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await getActionContext(req);
  if (!context.isValid) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    const body = PostBodySchema.parse(await req.json());
    
    let result;
    if (typeof body.value === "string") {
      result = await redis.set(body.key, body.value);
      if (body.ttl) {
        await redis.expire(body.key, body.ttl);
      }
    } else {
      result = await redis.set(body.key, JSON.stringify(body.value));
      if (body.ttl) {
        await redis.expire(body.key, body.ttl);
      }
    }

    const keyInfo = await getKeyInfo(body.key);
    return NextResponse.json(keyInfo);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    console.error("Redis POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to create Redis key" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const context = await getActionContext(req);
  if (!context.isValid) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    const body = PutBodySchema.parse(await req.json());
    
    const exists = await redis.exists(body.key);
    if (!exists) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    let result;
    if (typeof body.value === "string") {
      result = await redis.set(body.key, body.value);
      if (body.ttl) {
        await redis.expire(body.key, body.ttl);
      }
    } else {
      result = await redis.set(body.key, JSON.stringify(body.value));
      if (body.ttl) {
        await redis.expire(body.key, body.ttl);
      }
    }

    const keyInfo = await getKeyInfo(body.key);
    return NextResponse.json(keyInfo);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    console.error("Redis PUT error:", error);
    return NextResponse.json({ error: error.message || "Failed to update Redis key" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const context = await getActionContext(req);
  if (!context.isValid) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const params = DeleteParamsSchema.parse({
      key: searchParams.get("key"),
    });

    const exists = await redis.exists(params.key);
    if (!exists) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const result = await redis.del(params.key);
    return NextResponse.json({ success: true, deleted: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid parameters", details: error.issues }, { status: 400 });
    }
    console.error("Redis DELETE error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete Redis key" }, { status: 500 });
  }
}
