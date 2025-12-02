import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ToastDisplay } from "@/components/ui/toast-display";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Pixell Agent Framework",
  description: "Advanced AI agent orchestration platform",
};

export const dynamic = 'force-dynamic';

// Removed force-dynamic from layout to prevent build conflicts with static error pages

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ToastProvider>
            <ToastDisplay />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
