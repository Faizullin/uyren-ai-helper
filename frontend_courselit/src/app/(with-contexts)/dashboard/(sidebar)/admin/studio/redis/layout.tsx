import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redis Management | Studio",
};

export default function RedisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
