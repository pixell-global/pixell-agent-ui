import type { Metadata } from "next";
import { inter, jetbrainsMono, poppins } from "./fonts";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ToastDisplay } from "@/components/ui/toast-display";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Pixell Agent Framework",
  description: "Advanced AI agent orchestration platform",
  icons: {
    icon: '/assets/px_app_favicon.png',
    apple: '/assets/px_app_favicon.png',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${poppins.variable}`}>
      <body className="antialiased selection:bg-white/10 selection:text-white text-white bg-pixell-black">
        <AuthProvider>
          <ToastProvider>
            {/* Decorative backdrop blur elements */}
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute -top-24 -left-20 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
              <div className="absolute top-2/3 -right-16 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="absolute top-1/3 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-fuchsia-500/5 blur-3xl" />
            </div>
            <ToastDisplay />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
