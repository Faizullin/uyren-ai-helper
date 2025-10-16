import { ThemeProvider } from "@/components/layout/theme-provider";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
