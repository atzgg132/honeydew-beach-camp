import { cn } from "@/lib/cn";

export function Container({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "main";
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[72rem] px-5 md:px-8", className)}>
      {children}
    </Tag>
  );
}
