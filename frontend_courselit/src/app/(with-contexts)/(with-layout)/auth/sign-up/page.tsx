import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SignUpForm from "./sign-up-form";

export default async function SignUpPage({
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

  return <SignUpForm />;
}
