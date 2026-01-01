import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { GlobalChatWidget } from "@/components/chat/GlobalChatWidget";
import { Toaster } from "@/components/ui/sonner";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Tropicana Worldwide Corporation",
  description: "Award-winning hotels and resorts worldwide.",
};

import { AuthProvider } from "@/components/providers/session-provider";
import { auth } from "@/auth";

// ... imports

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <AuthProvider session={session}>
      <html lang="en" className="scroll-smooth">
        <body
          className={`${cormorant.variable} ${montserrat.variable} font-sans antialiased min-h-screen flex flex-col bg-neutral-950 text-neutral-50 selection:bg-orange-500/30`}
        >
          <ScrollToTop />
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <GlobalChatWidget />
          <Toaster />
        </body>
      </html>
    </AuthProvider>
  );
}
