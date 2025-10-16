import { checkForInvalidPermissions } from "@/lib/check-invalid-permissions";
import { recordActivity } from "@/lib/models/record-activity";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { IAttachmentMedia } from "@workspace/common-logic/models/media.types";
import { IOrganizationHydratedDocument } from "@workspace/common-logic/models/organization.model";
import { UserModel } from "@workspace/common-logic/models/user.model";

export async function createUser({
  organization,
  fullName,
  email,
  avatar,
  superAdmin = false,
  subscribedToUpdates = true,
  invited,
  permissions = [],
  providerData,
}: {
  organization: IOrganizationHydratedDocument;
  fullName?: string;
  email: string;
  avatar?: IAttachmentMedia;
  superAdmin?: boolean;
  subscribedToUpdates?: boolean;
  invited?: boolean;
  permissions?: string[];
  providerData?: {
    provider: string;
    uid: string;
    name?: string;
  };
}) {
  if (permissions.length) {
    checkForInvalidPermissions(permissions);
  }

  const rawResult = await UserModel.findOneAndUpdate(
    { orgId: organization._id, email },
    {
      $setOnInsert: {
        orgId: organization._id,
        fullName,
        email: email.toLowerCase(),
        active: true,
        avatar,
        permissions: superAdmin
          ? [
            UIConstants.permissions.manageCourse,
            UIConstants.permissions.manageAnyCourse,
            UIConstants.permissions.publishCourse,
            UIConstants.permissions.manageMedia,
            UIConstants.permissions.manageSite,
            UIConstants.permissions.manageSettings,
            UIConstants.permissions.manageUsers,
            UIConstants.permissions.manageCommunity,
          ]
          : [
            UIConstants.permissions.enrollInCourse,
            UIConstants.permissions.manageMedia,
            ...permissions,
          ],
        roles: superAdmin ? [UIConstants.roles.admin] : [],
        subscribedToUpdates,
        invited,
        providerData,
      },
    },
    { upsert: true, new: true },
  );

  const createdUser = rawResult;
  const isNewUser = !rawResult.isModified();
  if (isNewUser) {
    // if (superAdmin) {
    //   await initMandatoryPages(domain, createdUser);
    //   await createInternalPaymentPlan(domain, createdUser.userId);
    // }

    await recordActivity({
      orgId: organization._id,
      userId: createdUser._id,
      type: "user_created",
      message: `User ${createdUser.username} created`,
    });

    if (createdUser.subscribedToUpdates) {
      await recordActivity({
        orgId: organization._id,
        userId: createdUser._id,
        type: "newsletter_subscribed",
        message: `User ${createdUser.username} subscribed to updates`,
      });
    }
  }

  return createdUser;
}