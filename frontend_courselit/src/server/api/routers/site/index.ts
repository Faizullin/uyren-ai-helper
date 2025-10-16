import { router } from "../../core/trpc";
import { apiKeyRouter } from "./api-key";
import { domainRouter } from "./domain";
import { siteInfoRouter } from "./site-info";
import { tagRouter } from "./tag";
import { websiteSettingsRouter } from "./website-settings";

export const siteModuleRouter = router({
  apiKey: apiKeyRouter,
  domain: domainRouter,
  siteInfo: siteInfoRouter,
  websiteSettings: websiteSettingsRouter,
  tag: tagRouter,
});
