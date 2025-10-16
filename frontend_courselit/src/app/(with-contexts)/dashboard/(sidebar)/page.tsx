import { authOptions } from "@/lib/auth/options";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) {
    redirect("/auth/sign-in");
  } else if (user.roles.includes(UIConstants.roles.admin)) {
    redirect("/dashboard/admin");
  }
  else if (user.roles.includes(UIConstants.roles.instructor)) {
    redirect("/dashboard/instructor");
  }
  else {
    redirect("/dashboard/student");
  }
}
