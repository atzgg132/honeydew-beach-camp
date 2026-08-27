"use client";

import { useEffect, useRef, useState } from "react";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { SiteImage } from "@/components/media/SiteImage";
import { getMedia, galleryOrder } from "@/data/media";

export function GalleryMosaic() {
  const ids = [...galleryOrder];
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const current = index === null ? null : getMedia(ids[index]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (index === null) {
      if (node.open) node.close();
      document.body.style.overflow = "";
      return;
    }
    if (!node.open) node.showModal();
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIndex(null);
      if (event.key === "ArrowRight") setIndex((value) => (value === null ? value : (value + 1) % ids.length));
      if (event.key === "ArrowLeft") {
        setIndex((value) => (value === null ? value : (value - 1 + ids.length) % ids.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, ids.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {ids.map((id, i) => {
          const wide = i === 0 || i === 6;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setIndex(i)}
              className={wide ? "relative col-span-2 aspect-[16/10] overflow-hidden" : "relative aspect-[4/3] overflow-hidden"}
            >
              <SiteImage
                id={id}
                priority={i === 0}
                className="absolute inset-0 motion-safe transition-transform duration-500 hover:scale-105"
              />
            </button>
          );
        })}
      </div>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 z-[60] m-0 hidden h-full max-h-none w-full max-w-none items-center justify-center bg-lagoon-900 p-4 text-cream open:flex backdrop:bg-lagoon-900"
        onClose={() => setIndex(null)}
        aria-label="Photograph"
        onTouchStart={(event) => {
          touchStart.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const delta = event.changedTouches[0].clientX - touchStart.current;
          touchStart.current = null;
          if (Math.abs(delta) < 40) return;
          setIndex((value) => {
            if (value === null) return value;
            return delta < 0 ? (value + 1) % ids.length : (value - 1 + ids.length) % ids.length;
          });
        }}
      >
        {current && index !== null ? (
          <div className="relative max-h-full w-full max-w-5xl">
            <SiteImage id={current.id} fit="contain" className="mx-auto" />
            <p className="mt-3 text-sm text-cream/80">{current.alt}</p>
            <button
              type="button"
              className="absolute right-0 top-0 z-10 inline-flex h-11 w-11 items-center justify-center bg-lagoon-900/70"
              onClick={() => setIndex(null)}
            >
              <X size={28} />
              <span className="sr-only">Close</span>
            </button>
            <button
              type="button"
              className="absolute top-1/2 left-0 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center"
              onClick={() => setIndex((value) => (value === null ? 0 : (value - 1 + ids.length) % ids.length))}
            >
              <CaretLeft size={32} />
              <span className="sr-only">Previous</span>
            </button>
            <button
              type="button"
              className="absolute top-1/2 right-0 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center"
              onClick={() => setIndex((value) => (value === null ? 0 : (value + 1) % ids.length))}
            >
              <CaretRight size={32} />
              <span className="sr-only">Next</span>
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
