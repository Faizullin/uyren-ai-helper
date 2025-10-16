import { defaultState } from "@/components/contexts/default-state";
import { ProfileProvider } from "@/components/contexts/profile-context";
import { ServerConfigProvider } from "@/components/contexts/server-config-context";
import { SiteInfoProvider } from "@/components/contexts/site-info-context";
import SessionWrapper from "@/components/layout/session-wrapper";
import TranslationWrapper from "@/components/layout/translation-wrapper";
import { ThemeProvider as NextThemesProvider } from "@/components/next-theme-provider";
import { authOptions } from "@/lib/auth/options";
import { getServerSiteInfo } from "@/server/lib/site-info";
import { ISiteInfo } from "@workspace/common-logic/models/organization.types";
import { Provider as NiceModalProvider } from "@workspace/components-library";
import { getServerSession } from "next-auth";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";
import { Toaster } from "sonner";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const siteInfo = await getServerSiteInfo();
  const formattedSiteInfo = formatInitialSiteInfo(siteInfo);
  return (
    <TranslationWrapper>
      <SessionWrapper session={session}>
        <SiteInfoProvider initialSiteInfo={formattedSiteInfo}>
          <ServerConfigProvider initialConfig={defaultState.config}>
            <NextThemesProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <ProfileProvider>
                <NiceModalProvider>
                  <NuqsAdapter>{children}</NuqsAdapter>
                </NiceModalProvider>
              </ProfileProvider>
            </NextThemesProvider>
          </ServerConfigProvider>
        </SiteInfoProvider>
        <Toaster />
      </SessionWrapper>
    </TranslationWrapper>
  );
}


const formatInitialSiteInfo = (siteInfo?: ISiteInfo) => {
  return {
    title: siteInfo?.title || defaultState.siteinfo.title,
    subtitle: siteInfo?.subtitle || defaultState.siteinfo.subtitle,
    logo: siteInfo
      ? {
        originalFileName: siteInfo.logo?.originalFileName!,
        size: siteInfo.logo?.size!,
        url: siteInfo.logo?.url || defaultState.siteinfo.logo?.url!,
        mimeType: siteInfo.logo?.mimeType!,
        access: siteInfo.logo?.access!,
        thumbnail: siteInfo.logo?.thumbnail!,
        storageProvider: siteInfo.logo?.storageProvider!,
      }
      : defaultState.siteinfo.logo!,
    currencyISOCode:
      siteInfo?.currencyISOCode || defaultState.siteinfo.currencyISOCode,
    paymentMethod: siteInfo?.paymentMethods?.stripe?.stripeKey || defaultState.siteinfo.stripeKey,
    codeInjectionHead:
      siteInfo?.codeInjectionHead || defaultState.siteinfo.codeInjectionHead,
    codeInjectionBody:
      siteInfo?.codeInjectionBody || defaultState.siteinfo.codeInjectionBody,
    mailingAddress:
      siteInfo?.mailingAddress || defaultState.siteinfo.mailingAddress,
  };
};