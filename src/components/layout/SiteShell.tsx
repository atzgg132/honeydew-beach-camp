import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StickyBookBar } from "@/components/layout/StickyBookBar";

export function SiteShell({
  children,
  overlay = false,
}: {
  children: React.ReactNode;
  overlay?: boolean;
}) {
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-cream focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header overlay={overlay} />
      <div id="content" className="flex flex-1 flex-col">
        {children}
      </div>
      <Footer />
      <StickyBookBar />
    </>
  );
}
