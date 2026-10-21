import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { AuthHeader } from "@/app/auth/_components/auth-header";
import { LoginForm } from "./_components/login-form";
import { ArchPattern } from "./_components/arch-pattern";

export default async function LoginPage() {
  const tApp = await getTranslations("app");
  const tLogin = await getTranslations("auth.login");

  return (
    <main className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <AuthHeader />

      <div className="relative flex shrink-0 items-center justify-center overflow-hidden bg-brand-50 px-8 py-14 dark:bg-background lg:w-1/2">
        <ArchPattern className="absolute inset-0 h-full w-full text-brand-900/10 dark:text-gold-400/15" />
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 relative flex flex-col items-center gap-5 text-center motion-safe:duration-700">
          <Image
            src="/book-transparent.png"
            alt={tApp("name")}
            width={112}
            height={60}
            priority
            className="h-20 w-auto object-contain lg:h-28"
          />
          <div className="space-y-1.5">
            <h1 className="font-heading text-3xl font-semibold text-brand-900 dark:text-foreground">{tApp("name")}</h1>
            <p className="text-sm text-brand-700/70 dark:text-brand-100/70">{tApp("description")}</p>
          </div>
          <p className="mt-2 text-sm font-medium tracking-wide text-gold-700 dark:text-gold-300">{tApp("tagline")}</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 w-full max-w-sm motion-safe:duration-700">
          <div className="mb-8 space-y-2 text-center lg:text-start">
            <h2 className="font-heading text-2xl font-semibold">{tLogin("title")}</h2>
            <p className="text-sm text-muted-foreground">{tLogin("description")}</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
