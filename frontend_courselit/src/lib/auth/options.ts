import { createUser } from "@/server/api/routers/user/helpers";
import { adminAuth } from "@/server/lib/firebaseAdmin";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { IAttachmentMedia, MediaAccessTypeEnum } from "@workspace/common-logic/models/media.types";
import { DomainModel, OrganizationModel } from "@workspace/common-logic/models/organization.model";
import { UserModel } from "@workspace/common-logic/models/user.model";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import z from "zod";
import { Log } from "../logger";
import { getFirebaseAuth } from "./firebase";

const AuthorizeFirebaseSchema = z.object({
  idToken: z.string().min(1, "ID Token is required"),
});

// Define the NextAuth options
// Dont use default FirestoreAdapter but use custom credentials provider
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "firebase-credentials-provider",
      credentials: {
        idToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials, req) {
        const domainIdentifier = req.headers?.["x-domain-identifier"];
        if (!domainIdentifier) {
          throw new Error("Domain identifier is required");
        }
        await connectToDatabase();
        const domain = await DomainModel.findOne({
          name: domainIdentifier,
        });
        if (!domain) {
          throw new Error(`Domain not found: ${domainIdentifier}`);
        }
        const organization = await OrganizationModel.findOne({
          _id: domain.orgId,
        });
        if (!organization) {
          throw new Error(`Organization not found for domain: ${domainIdentifier}`);
        }
        const parsed = AuthorizeFirebaseSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error(parsed.error.message);
        }
        const { idToken } = parsed.data;
        try {
          // Connect to database
          //   await connectToDatabase();

          // Check if Firebase Admin is initialized (skip during build time)
          if (!adminAuth) {
            throw new Error("Firebase Admin is not initialized during build time");
          }

          let created = false;
          const decoded = await adminAuth.verifyIdToken(idToken);

          const sanitizedEmail = decoded.email;
          if (!sanitizedEmail) {
            throw new Error("Email is required in ID Token");
          }

          let user = await UserModel.findOne({
            orgId: domain.orgId,
            email: sanitizedEmail,
          });
          if (user && user.invited) {
            user.invited = false;
            await user.save();
          } else if (!user) {
            user = await createUser({
              organization: organization,
              email: sanitizedEmail,
              fullName: decoded.name || "",
              providerData: {
                provider: "firebase",
                uid: decoded.uid,
                name: decoded.name || "",
              },
            });
            created = true;
            user.avatar = decoded.picture
              ? {
                orgId: domain.orgId,
                storageProvider: "custom",
                url: decoded.picture,
                mimeType: "image/jpeg",
                originalFileName: "google_profile_picture",
                access: MediaAccessTypeEnum.PUBLIC,
                size: 0,
                ownerId: user._id,
                thumbnail: decoded.picture,
                caption: "Google profile picture",
                metadata: {
                  google: {
                    uid: decoded.uid,
                  },
                },
              }
              : undefined;
            await user.save();
          }

          if (!user.active) {
            return null;
          }
          const media: IAttachmentMedia | undefined = user.avatar
            ? {
              orgId: domain.orgId,
              storageProvider: "custom",
              url: user.avatar.url,
              originalFileName: user.avatar.originalFileName,
              mimeType: user.avatar.mimeType,
              size: user.avatar.size,
              access: user.avatar.access,
              thumbnail: user.avatar.thumbnail,
              caption: user.avatar.caption,
              file: user.avatar.file,
              metadata: user.avatar.metadata,
              ownerId: user._id,
            }
            : undefined;
          return {
            id: user._id.toString(),
            email: sanitizedEmail,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            bio: user.bio,
            avatar: media,
            permissions: user.permissions || [],
            roles: user.roles || [],
            active: user.active,
            subscribedToUpdates: user.subscribedToUpdates,
          };
        } catch (error) {
          if (error instanceof Error) {
            Log.error("Firebase ID Token verification failed", error);

          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.user = {
          id: user.id,
          email: user.email!,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          bio: user.bio,
          avatar: user.avatar,
          permissions: user.permissions || [],
          roles: user.roles || [],
          active: user.active,
          subscribedToUpdates: user.subscribedToUpdates,
          // Membership data
          currentMembership: user.currentMembership,
        };
      }

      return token;
    },

    session: async ({ session, token }) => {
      if (token && token.user) {
        session.user = token.user;
      }
      return session;
    },
  },
  events: {
    signOut: async () => {
      try {
        // Sign out from Firebase if user is authenticated
        try {
          const firebaseAuth = getFirebaseAuth();
          if (firebaseAuth.currentUser) {
            await firebaseAuth.signOut();
          }
        } catch (error) {
        }
      } catch (error) {
        console.error("Error signing out from Firebase:", error);
        // Don't throw error - continue with NextAuth signOut
      }
    },
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    bio?: string;
    avatar?: IAttachmentMedia;
    permissions: string[];
    roles: string[];
    active: boolean;
    subscribedToUpdates: boolean;
    // Membership data
    currentMembership?: {
      id: string;
      entityId: string;
      entityType: string;
      role?: string;
      status: string;
    };
  }
  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user: {
      id: string;
      email: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      bio?: string;
      avatar?: IAttachmentMedia;
      permissions: string[];
      roles: string[];
      active: boolean;
      subscribedToUpdates: boolean;
      currentMembership?: {
        id: string;
        entityId: string;
        entityType: string;
        role?: string;
        status: string;
      };
    };
  }
}
