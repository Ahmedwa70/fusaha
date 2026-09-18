import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArchPattern } from "@/app/auth/login/_components/arch-pattern";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/constants/routes";
import { ResetPasswordForm } from "./_components/reset-password-form";

export default async function ResetPasswordPage() {
  const tApp = await getTranslations("app");
  const tResetPassword = await getTranslations("auth.resetPassword");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <div className="absolute top-4 inset-e-4 z-20 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="relative flex shrink-0 items-center justify-center overflow-hidden bg-brand-50 px-8 py-14 dark:bg-brand-900 lg:w-1/2">
        <ArchPattern className="absolute inset-0 h-full w-full text-brand-900/10 dark:text-gold-400/15" />
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 relative flex flex-col items-center gap-5 text-center motion-safe:duration-700">
          <Image
            src="/logo.png"
            alt={tApp("name")}
            width={112}
            height={112}
            priority
            className="h-20 w-20 lg:h-28 lg:w-28"
          />
          <div className="space-y-1.5">
            <h1 className="font-heading text-3xl font-semibold text-brand-900 dark:text-brand-50">{tApp("name")}</h1>
            <p className="text-sm text-brand-700/70 dark:text-brand-100/70">{tApp("description")}</p>
          </div>
          <p className="mt-2 text-sm font-medium tracking-wide text-gold-700 dark:text-gold-300">{tApp("tagline")}</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 w-full max-w-sm motion-safe:duration-700">
          {user ? (
            <>
              <div className="mb-8 space-y-2 text-center lg:text-start">
                <h2 className="font-heading text-2xl font-semibold">{tResetPassword("title")}</h2>
                <p className="text-sm text-muted-foreground">{tResetPassword("description")}</p>
              </div>
              <ResetPasswordForm />
            </>
          ) : (
            <div className="space-y-4 text-center lg:text-start">
              <h2 className="font-heading text-2xl font-semibold">{tResetPassword("invalidLinkTitle")}</h2>
              <p className="text-sm text-muted-foreground">{tResetPassword("invalidLinkDescription")}</p>
              <Link
                href={ROUTES.forgotPassword}
                className="inline-block text-sm font-medium text-foreground underline underline-offset-4"
              >
                {tResetPassword("requestNewLink")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
