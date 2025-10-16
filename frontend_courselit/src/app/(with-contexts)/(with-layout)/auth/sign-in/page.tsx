import { Metadata, ResolvingMetadata } from "next";
import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SignInForm from "./sign-in-form";

export async function generateMetadata(
  _: any,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `Sign In | ${(await parent)?.title?.absolute}`,
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  const redirectTo = (await searchParams).redirect;

  if (session) {
    redirect(
      typeof redirectTo === "string" ? redirectTo : "/dashboard",
    );
  }

  return <SignInForm />;
}
