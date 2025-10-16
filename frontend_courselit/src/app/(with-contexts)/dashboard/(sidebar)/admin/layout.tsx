import PermissionError from "@/components/dashboard/permission-error";
import { authOptions } from "@/lib/auth/options";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import type { Metadata, ResolvingMetadata } from "next";
import { getServerSession } from "next-auth";


export async function generateMetadata(
    _: any,
    parent: ResolvingMetadata,
): Promise<Metadata> {
    return {
        title: `Admin | ${(await parent)?.title?.absolute}`,
    }
}

export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions)
    const hasAccess = session?.user?.roles.includes(UIConstants.roles.admin)
    if (!hasAccess) {
        return (
            <PermissionError />
        )
    }
    return children;
}