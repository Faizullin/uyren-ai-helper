import { UIConstants } from "@workspace/common-logic/lib/ui/constants";

export const checkForInvalidPermissions = (userPermissions: string[]) => {
  const invalidPerms = userPermissions.filter(
    (x) => !Object.values(UIConstants.permissions).includes(x),
  );
  if (invalidPerms.length) {
    throw new Error("Invalid permission");
  }
};
