import type { Metadata, ResolvingMetadata } from "next";
import { ReactNode } from "react";

export async function generateMetadata(
  _: any,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `Database Management | Studio | ${(await parent)?.title?.absolute}`,
    description: "Manage database records with full CRUD operations. View, create, update, and delete records across all data models including users, courses, quizzes, and more.",
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
} 