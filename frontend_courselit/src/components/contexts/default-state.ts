import {
  Address,
  Message,
  Profile,
  ServerConfig,
  SiteInfo,
} from "@workspace/common-models";

export const defaultState: {
  siteinfo: SiteInfo;
  networkAction: boolean;
  profile: Profile;
  address: Address;
  config: ServerConfig;
  message: Message;
} = {
  siteinfo: {
    title: "Uyren AI",
    subtitle: "AI-Powered Learning",
    logo: undefined,
    currencyISOCode: "",
    paymentMethod: "",
    stripeKey: "",
    codeInjectionHead: "",
    codeInjectionBody: "",
    mailingAddress: "",
    hideCourseLitBranding: false,
  },
  networkAction: false,
  profile: {
    name: "",
    id: "",
    fetched: false,
    purchases: [],
    email: "",
    bio: "",
    permissions: [],
    userId: "",
    avatar: {
      file: "",
      thumbnail: "",
      caption: "",
    },
    subscribedToUpdates: false,
  },
  message: {
    open: false,
    message: "",
    action: null,
  },
  address: {
    backend: "",
    frontend: "",
  },
  config: {
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "",
    queueServer: process.env.QUEUE_SERVER || "",
  },
};
