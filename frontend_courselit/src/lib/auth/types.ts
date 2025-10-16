import { IAttachmentMedia } from "@workspace/common-logic/models/media.types";

type IClientAttachmentMedia = Omit<IAttachmentMedia, "orgId" | "ownerId"> & {
    orgId: string;
    ownerId: string;
};

export type IAuthProfile = {
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    bio?: string;
    avatar?: IClientAttachmentMedia;
    permissions: string[];
    roles: string[];
    active: boolean;
    subscribedToUpdates: boolean;
}