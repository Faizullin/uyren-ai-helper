import { Log } from "@/lib/logger";
import NotificationModel from "@/models/Notification";
import { NotificationEntityAction } from "@workspace/common-models";
import { jwtUtils } from "@workspace/utils";
import { ObjectId } from "mongodb";

const queueServer = process.env.QUEUE_SERVER;

function getJwtSecret(): string {
  const jwtSecret = process.env.TRANSPORT_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("TRANSPORT_JWT_SECRET is not defined");
  }
  return jwtSecret;
}

interface MailProps {
  to: string[];
  subject: string;
  body: string;
  from: string;
}

export async function addMailJob({ to, from, subject, body }: MailProps) {
  try {
    const jwtSecret = getJwtSecret();
    const token = jwtUtils.generateToken(
      {
        user: {
          userId: "test-user-id",
          email: "test@example.com",
          domain: "test-domain-id",
        },
        service: "app",
      },
      jwtSecret,
    );
    const response = await fetch(`${queueServer}/api/job/mail`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        from,
        subject,
        body,
      }),
    });
    const jsonResponse = await response.json();

    if (response.status !== 200) {
      throw new Error(jsonResponse.error);
    }
  } catch (err) {
    const typedError = err as Error;
    Log.error(`Error adding mail job: ${typedError.message}`, {
      to,
      from,
      subject,
    });
  }
}

export async function addNotification({
  domain,
  entityId,
  entityAction,
  forUserIds,
  userId,
  entityTargetId,
}: {
  domain: string;
  entityId: string;
  entityAction: NotificationEntityAction;
  forUserIds: string[];
  userId: string;
  entityTargetId?: string;
}) {
  console.log(
    "addNotification",
    domain,
    entityId,
    entityAction,
    forUserIds,
    userId,
    entityTargetId,
  );
  try {
    const jwtSecret = getJwtSecret();
    const token = jwtUtils.generateToken(
      {
        user: {
          userId: "test-user-id",
          email: "test@example.com",
          domain: "test-domain-id",
        },
        service: "app",
      },
      jwtSecret,
    );
    const response = await fetch(`${queueServer}/api/job/notification`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        forUserIds,
        entityAction,
        entityId,
        entityTargetId,
      }),
    });
    const jsonResponse = await response.json();

    if (response.status !== 200) {
      throw new Error(jsonResponse.error);
    }
  } catch (err) {
    const typedError = err as Error;
    Log.error(`Error adding notification job: ${typedError.message}`, {
      domain,
      entityId,
      entityAction,
      forUserIds,
      userId,
      entityTargetId,
    });

    try {
      for (const forUserId of forUserIds) {
        await NotificationModel.create({
          domain: new ObjectId(domain),
          userId,
          forUserId,
          entityAction,
          entityId,
          entityTargetId,
        });
      }
    } catch (err) {
      const typedError = err as Error;
      Log.error(`Error adding notification locally: ${typedError.message}`, {
        stack: typedError.stack as any,
      });
    }
  }
}
