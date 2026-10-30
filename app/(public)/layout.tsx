import { PublicHeader } from "@/app/_components/public-header";
import { SiteFooter } from "@/app/_components/site-footer";
import { ROUTES } from "@/constants/routes";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div data-ar-type="calibrated" className="flex min-h-full flex-1 flex-col">
      <PublicHeader homeHref={ROUTES.home} isAuthenticated={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
