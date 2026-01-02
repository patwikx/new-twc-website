import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { GlobalChatWidget } from "@/components/chat/GlobalChatWidget";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
      <GlobalChatWidget />
    </>
  );
}
