"use client";

import { IAuthProfile } from "@/lib/auth/types";
import { getGlobalAppClient } from "@/lib/global-client";
import { trpc } from "@/utils/trpc";
import { useToast } from "@workspace/components-library";
import { signOut, useSession } from "next-auth/react";
import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";
import { defaultState } from "./default-state";

type ProfileContextType = {
  profile: IAuthProfile;
  setProfile: Dispatch<SetStateAction<IAuthProfile>>;
};

export const ProfileContext = createContext<ProfileContextType>({
  profile: defaultState.profile,
  setProfile: () => {
    throw new Error("setProfile function not implemented");
  },
});

export const ProfileProvider = ({
  children,
}: PropsWithChildren<{
  // defaultProfile: ProfileType;
}>) => {
  const session = useSession();
  const [profile, setProfile] = useState<IAuthProfile>(defaultState.profile);
  const { toast } = useToast();

  const loadUserProfileQuery =
    trpc.userModule.user.getProfile.useQuery(undefined, {
      retry: false,
      enabled: !!session.data?.user,
    });

  useEffect(() => {
    const userProfile = loadUserProfileQuery.data;
    if (userProfile) {
      setProfile({
        id: userProfile._id,
        username: userProfile.username,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        fullName: userProfile.fullName,
        email: userProfile.email,
        bio: userProfile.bio || "",
        permissions: userProfile.permissions,
        avatar: userProfile.avatar || undefined,
        active: userProfile.active,
        subscribedToUpdates: userProfile.subscribedToUpdates,
        roles: userProfile.roles,
      });
    }
  }, [loadUserProfileQuery.data]);

  useEffect(() => {
    const error = loadUserProfileQuery.error;
    if (loadUserProfileQuery.error) {
      // Handle authentication errors (401/403) - trigger sign-out
      if (
        error?.data?.code === "UNAUTHORIZED" ||
        error?.data?.code === "FORBIDDEN"
      ) {
        toast({
          title: "Session expired",
          description: "Please log in again to continue",
          variant: "destructive",
        });

        // Sign out and redirect to login
        signOut();
        return;
      }

      // Handle other errors
      toast({
        title: "Error",
        description: error?.data?.message || error?.message,
        variant: "destructive",
      });
    }
  }, [loadUserProfileQuery.error, toast]);

  useEffect(() => {
    const appClient = getGlobalAppClient();
    appClient.setConfig({ profile });
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
