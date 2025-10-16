import { trpc } from "@/utils/trpc";
import { Community } from "@workspace/common-models";
import { useEffect, useState } from "react";

export const useCommunity = (communityId?: string) => {
  const [community, setCommunity] = useState<Community | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const loadQuery = trpc.communityModule.community.getByCommunityId.useQuery(
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
      setCommunity(loadQuery.data);
    }
    if (loadQuery.error) {
      setError(loadQuery.error.message);
    }
    setLoaded(loadQuery.isFetched);
  }, [loadQuery.data, loadQuery.error, loadQuery.isFetched]);

  return { community, error, loaded, setCommunity };
};
