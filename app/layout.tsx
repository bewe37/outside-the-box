import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NavProvider } from "@/app/components/nav-context";
import { AuthProvider } from "@/app/components/auth-context";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OutsideTheBox",
  description: "A field guide to Toronto's painted utility boxes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full" style={{ display: "flex", flexDirection: "column" }}>
        <AuthProvider>
          <NavProvider>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {children}
            </div>
          </NavProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
