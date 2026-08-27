"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StickyBookBar() {
  const pathname = usePathname();
  const onDeskPage = pathname === "/" || pathname.startsWith("/rooms");
  const [path, setPath] = useState(pathname);
  const [deskVisible, setDeskVisible] = useState(pathname === "/");

  if (path !== pathname) {
    setPath(pathname);
    setDeskVisible(pathname === "/");
  }

  useEffect(() => {
    const desk = document.getElementById("booking-desk");
    if (!desk) return;
    const observer = new IntersectionObserver(
      ([entry]) => setDeskVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(desk);
    return () => observer.disconnect();
  }, [pathname]);

  if (pathname.startsWith("/book") || pathname.startsWith("/manage-booking")) {
    return null;
  }
  if (onDeskPage && deskVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 p-3 backdrop-blur-sm lg:hidden">
      <Button href="/book" className="w-full">
        Book now
      </Button>
    </div>
  );
}
