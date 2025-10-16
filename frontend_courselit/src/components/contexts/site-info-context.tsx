"use client";

import { SiteInfo } from "@workspace/common-models";
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
import { getGlobalAppClient } from "@/lib/global-client";

type SiteInfoContextType = {
  siteInfo: SiteInfo;
  setSiteInfo: Dispatch<SetStateAction<SiteInfo>>;
};

const SiteInfoContext = createContext<SiteInfoContextType>({
  siteInfo: defaultState.siteinfo,
  setSiteInfo: () => {
    throw new Error("setSiteInfo function not implemented");
  },
});

export const SiteInfoProvider = ({
  children,
  initialSiteInfo,
}: PropsWithChildren<{ initialSiteInfo?: SiteInfo }>) => {
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(
    initialSiteInfo || defaultState.siteinfo,
  );

  useEffect(() => {
    const appClient = getGlobalAppClient();
    appClient.setConfig({ siteInfo });
  }, [siteInfo]);

  return (
    <SiteInfoContext.Provider value={{ siteInfo, setSiteInfo }}>
      {children}
    </SiteInfoContext.Provider>
  );
};

export const useSiteInfo = () => {
  const context = useContext(SiteInfoContext);
  if (!context) {
    throw new Error("useSiteInfo must be used within a SiteInfoProvider");
  }
  return context;
};
