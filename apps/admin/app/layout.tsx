import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/admin/ui/globals.css";

export const metadata: Metadata = {
  title: "MineRelay Admin",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
