import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NavProvider } from "@/app/components/nav-context";
import { AuthProvider } from "@/app/components/auth-context";
import AppShell from "@/app/components/AppShell";

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
          <NavProvider>
            <AppShell>
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {children}
              </div>
            </AppShell>
          </NavProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
