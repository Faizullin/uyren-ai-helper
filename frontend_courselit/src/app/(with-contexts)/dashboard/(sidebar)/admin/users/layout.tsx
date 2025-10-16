import { Metadata, ResolvingMetadata } from "next";
import { ReactNode } from "react";

export async function generateMetadata(
  {
    searchParams,
  }: {
    params: any;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const tab = (await searchParams)?.["tab"] || "All users";

  return {
    title: `${tab} | ${(await parent)?.title?.absolute}`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}