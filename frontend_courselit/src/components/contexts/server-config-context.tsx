"use client";

import { ServerConfig } from "@workspace/common-models";
import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { defaultState } from "./default-state";

type ServerConfigContextType = {
  config: ServerConfig;
  setConfig: Dispatch<SetStateAction<ServerConfig>>;
};

const ServerConfigContext = createContext<ServerConfigContextType>({
  config: defaultState.config,
  setConfig: () => {
    throw new Error("setConfig function not implemented");
  },
});

export const ServerConfigProvider = ({
  children,
  initialConfig,
}: PropsWithChildren<{
  initialConfig: ServerConfig;
}>) => {
  const [config, setConfig] = useState<ServerConfig>(initialConfig);

  return (
    <ServerConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </ServerConfigContext.Provider>
  );
};

export const useServerConfig = () => {
  const context = useContext(ServerConfigContext);
  if (!context) {
    throw new Error(
      "useServerConfig must be used within a ServerConfigProvider",
    );
  }
  return context;
};
