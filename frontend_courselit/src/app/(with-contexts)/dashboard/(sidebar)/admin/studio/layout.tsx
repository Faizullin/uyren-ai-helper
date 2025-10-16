import type { Metadata, ResolvingMetadata } from "next";
import { ReactNode } from "react";

export async function generateMetadata(
  _: any,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `Studio | ${(await parent)?.title?.absolute}`,
    description: "Manage your application data and perform database operations with the Studio tools.",
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
} 