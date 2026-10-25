import { PublicHeader } from "@/app/_components/public-header";
import { SiteFooter } from "@/app/_components/site-footer";
import { ROUTES } from "@/constants/routes";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader homeHref={ROUTES.home} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
