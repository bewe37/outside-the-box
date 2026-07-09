import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NavProvider } from "@/app/components/nav-context";
import { AuthProvider } from "@/app/components/auth-context";
import { ThemeProvider } from "@/app/components/theme-context";
import AppShell from "@/app/components/AppShell";
import { RouteTransition } from "@/app/components/RouteTransition";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OutsideTheBox",
  description: "A field guide to Toronto's painted utility boxes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full" style={{ display: "flex", flexDirection: "column" }}>
        <AuthProvider>
          <ThemeProvider>
          <NavProvider>
            <AppShell>
              {/* Reserve the fixed nav's height so page scroll containers start
                  below it — keeps the scrollbar from being clipped by the nav. */}
              <div className="page-shell" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingTop: 44 }}>
                {children}
              </div>
            </AppShell>
            <RouteTransition />
          </NavProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
