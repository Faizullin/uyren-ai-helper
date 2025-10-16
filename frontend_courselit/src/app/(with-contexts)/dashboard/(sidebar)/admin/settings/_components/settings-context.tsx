"use client";

import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type SettingsType =
  GeneralRouterOutputs["siteModule"]["siteInfo"]["getSiteInfo"]["settings"];

interface SettingsContextType {
  settings: SettingsType | null;
  loadSettingsQuery: ReturnType<
    typeof trpc.siteModule.siteInfo.getSiteInfo.useQuery
  >;
  updateSettingsMutation: ReturnType<
    typeof trpc.siteModule.siteInfo.updateSiteInfo.useMutation
  >;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loadSettingsQuery: (() => {
    throw new Error("loadSettingsQuery is not implemented");
  }) as any,
  updateSettingsMutation: (() => {
    throw new Error("updateSettingsMutation is not implemented");
  }) as any,
});

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<SettingsType | null>(null);

  const loadSettingsQuery = trpc.siteModule.siteInfo.getSiteInfo.useQuery();
  const updateSettingsMutation =
    trpc.siteModule.siteInfo.updateSiteInfo.useMutation({
      onSuccess: (response) => {
        if (response?.settings) {
          setSettings(response.settings);
        }
        loadSettingsQuery.refetch();
      },
    });

  useEffect(() => {
    if (loadSettingsQuery.data?.settings) {
      setSettings(loadSettingsQuery.data.settings);
    }
  }, [loadSettingsQuery.data]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loadSettingsQuery,
        updateSettingsMutation,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error(
      "useSettingsContext must be used within a SettingsProvider",
    );
  }
  return context;
}
