import { authOptions } from "@/lib/auth/options";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Dashboard",
  };
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?redirect=/dashboard");
  }

  return children;
}
