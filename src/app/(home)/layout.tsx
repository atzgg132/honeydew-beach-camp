import { SiteShell } from "@/components/layout/SiteShell";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell overlay>{children}</SiteShell>;
}
