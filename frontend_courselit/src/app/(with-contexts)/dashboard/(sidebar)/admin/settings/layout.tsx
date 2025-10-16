import { getT } from "@/app/i18n/server";
import type { Metadata, ResolvingMetadata } from "next";
import { ReactNode } from "react";

export async function generateMetadata(
  _: any,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const t = await getT("sidebar.settings");
  return {
    title: `${getT("sidebar.settings")} | ${(await parent)?.title?.absolute}`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
