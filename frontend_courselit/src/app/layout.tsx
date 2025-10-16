import * as fonts from "@/lib/fonts";
import { getServerSiteInfo } from "@/server/lib/site-info";
import { TRPCReactProvider } from "@/server/provider";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import NoSubdomainPage from "./_components/no-subdomain-page";
import { getT } from "./i18n/server";

import "@/lib/global-client";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

// export async function generateStaticParams() {
//   return languages.map((lng) => ({ lng }))
// }

export async function generateMetadata(): Promise<Metadata> {
  const siteInfo = await getServerSiteInfo();
  // const { t } = await getT();

  return {
    title: `${siteInfo?.title || "Uyren AI"}`,
    description: siteInfo?.subtitle || "",
    openGraph: {
      title: `${siteInfo?.title || "Uyren AI"}`,
      description: siteInfo?.subtitle || "",
      images: [
        {
          url: siteInfo?.logo?.file as any,
          alt: siteInfo?.logo?.caption || "",
        },
      ],
    },
    twitter: {
      title: `${siteInfo?.title || "Uyren AI"}`,
      description: siteInfo?.subtitle || "",
      images: [
        {
          url: siteInfo?.logo?.file as any,
          alt: siteInfo?.logo?.caption || "",
        },
      ],
    },
    generator: "Uyren AI",
    applicationName: "Uyren AI",
  };
}

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  let hasError = false;
  let serverSiteInfo: any = null;
  try {
    serverSiteInfo = await getServerSiteInfo();
  } catch (error) {
    if (error instanceof TRPCError) {
      hasError = true;
    }
  }
  if (hasError || !serverSiteInfo) {
    return (
      <RootWrapper>
        <NoSubdomainPage />
      </RootWrapper>
    );
  }

  return (
    <RootWrapper>
      {children}
    </RootWrapper>
  );
}


const RootWrapper = async ({ children }: { children: React.ReactNode }) => {
  const { i18n } = await getT();
  const fontVars = [
    fonts.openSans.variable,
    fonts.montserrat.variable,
    fonts.lato.variable,
    fonts.poppins.variable,
    fonts.raleway.variable,
    fonts.notoSans.variable,
    fonts.merriweather.variable,
    fonts.inter.variable,
    fonts.alegreya.variable,
    fonts.roboto.variable,
    fonts.mulish.variable,
    fonts.nunito.variable,
    fonts.rubik.variable,
    fonts.playfairDisplay.variable,
    fonts.oswald.variable,
    fonts.ptSans.variable,
    fonts.workSans.variable,
    fonts.robotoSlab.variable,
    fonts.bebasNeue.variable,
    fonts.quicksand.variable,
  ]
  const fontClasses = fontVars.join(" ");
  const cls = `${fontClasses} font-sans ${inter.className}`;
  return (
    <html lang={i18n.language} suppressHydrationWarning>
      <body className={cls}>
        <NextTopLoader showSpinner={false} />
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
};
