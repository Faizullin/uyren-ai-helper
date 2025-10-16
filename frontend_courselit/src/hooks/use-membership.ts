import { trpc } from "@/utils/trpc";
import { Membership } from "@workspace/common-models";
import { useEffect, useState } from "react";

export const useMembership = (communityId?: string) => {
  const [membership, setMembership] = useState<
    Pick<Membership, "status" | "role" | "rejectionReason"> | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const loadQuery =
    trpc.communityModule.community.getCommunityMembership.useQuery(
      {
        data: {
          communityId: communityId!,
        },
      },
      {
        enabled: !!communityId,
      },
    );

  useEffect(() => {
    if (loadQuery.data) {
      setMembership({
        status: loadQuery.data.status,
        role: loadQuery.data.role,
        rejectionReason: loadQuery.data.rejectionReason,
      });
    }
    if (loadQuery.error) {
      setError(loadQuery.error.message);
    }
    setLoaded(loadQuery.isFetched);
  }, [loadQuery.data, loadQuery.error, loadQuery.isFetched]);

  return { membership, setMembership, error, loaded };
};
