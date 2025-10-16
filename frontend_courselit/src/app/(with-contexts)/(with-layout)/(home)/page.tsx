import { getDomainData } from "@/server/lib/domain";
import WebsiteSettingsManager from "@/server/lib/website-settings-manager";
import HomePageClient from "./_components/home-page-client";

export default async function HomePage() {
  const { domainObj } = await getDomainData();

  if (!domainObj) {
    throw new Error("Domain not found");
  }
  const websiteSettings = await WebsiteSettingsManager.getOrCreate(domainObj);
  return <HomePageClient websiteSettings={JSON.parse(JSON.stringify(websiteSettings))} />;
}