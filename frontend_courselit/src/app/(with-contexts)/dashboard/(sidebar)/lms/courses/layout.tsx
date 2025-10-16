import type { Metadata, ResolvingMetadata } from "next";
import { ReactNode } from "react";

export async function generateMetadata(
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `Courses | ${(await parent)?.title?.absolute
      }`,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
