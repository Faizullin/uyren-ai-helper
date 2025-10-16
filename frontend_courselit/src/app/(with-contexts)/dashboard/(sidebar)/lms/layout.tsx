import { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
    _: any,
    parent: ResolvingMetadata,
): Promise<Metadata> {
    return {
        title: `LMS | ${(await parent)?.title?.absolute}`,
    };
}

export default async function Layout({ children }: { children: React.ReactNode }) {
    return children;
}