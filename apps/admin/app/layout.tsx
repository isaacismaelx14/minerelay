import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@minerelay/ui/globals.css";

export const metadata: Metadata = {
  title: "MineRelay Admin",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const adminApiOrigin = process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN ?? "";

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__MSS_ADMIN_API_ORIGIN__ = ${JSON.stringify(adminApiOrigin)};`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
