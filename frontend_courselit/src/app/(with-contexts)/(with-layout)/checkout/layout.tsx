import { ReactNode } from "react";

interface CheckoutLayoutProps {
  children: ReactNode;
}

export default function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
