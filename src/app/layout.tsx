import type { Metadata } from "next";

import "./globals.css";
import { SidebarProvider } from "@/components/sidebar-context";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { template: "%s - WBOS", default: "WBOS" },
  description: "Wholesale Business Operating System",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

const INLINE_SCRIPT = `
(function(){
  try {
    var s = localStorage.getItem('wbos-sidebar-collapsed');
    document.documentElement.dataset.sidebarCollapsed = String(s === 'true');
    var o = localStorage.getItem('wbos-onboarding-dismissed');
    document.documentElement.dataset.onboardingDismissed = String(o === 'true');
    document.documentElement.dataset.sidebarReady = '';
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: INLINE_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SidebarProvider>{children}</SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
