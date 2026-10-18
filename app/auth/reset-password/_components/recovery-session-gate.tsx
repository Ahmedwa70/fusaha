"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { parseRecoveryLink } from "@/lib/auth/recovery-link";
import { ROUTES } from "@/constants/routes";
import { ResetPasswordForm } from "./reset-password-form";

// Password-recovery links arrive with the session either in the URL fragment
// (implicit grant — invisible to the server) or as a PKCE code in the query.
// This gate establishes the session client-side first, then decides whether
// the reset form may render — replacing the old server-side getUser() check,
// which could never see fragment-carried sessions and always showed the
// "invalid link" state for them. An already-signed-in user with no link
// params keeps the previous behavior (the form renders).
export function RecoverySessionGate() {
  const t = useTranslations("auth.resetPassword");
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");

  useEffect(() => {
    const link = parseRecoveryLink(window.location.hash, window.location.search);
    // auth-js exchanges a `?code=` it finds in the URL during client
    // initialization (detectSessionInUrl defaults to true in browsers). That
    // auto-exchange runs before the explicit exchange below (both await the
    // same init promise), consumes the one-time code, and deletes the PKCE
    // verifier — so the explicit exchange always fails and a valid recovery
    // link is misreported as invalid. This page handles the URL itself, so
    // auto-detection must stay off for this client.
    const supabase = createClient({ auth: { detectSessionInUrl: false } });

    (async () => {
      try {
        if (link.kind === "session-tokens") {
          const { error } = await supabase.auth.setSession({
            access_token: link.accessToken,
            refresh_token: link.refreshToken,
          });
          if (error) throw error;
        } else if (link.kind === "pkce-code") {
          const { error } = await supabase.auth.exchangeCodeForSession(link.code);
          if (error) throw error;
        }

        // Strip tokens/code from the URL so a refresh or a copied link can
        // neither reuse nor leak them.
        window.history.replaceState(null, "", window.location.pathname);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        setState(user ? "ready" : "invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="space-y-4 text-center lg:text-start">
        <h2 className="font-heading text-2xl font-semibold">{t("invalidLinkTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("invalidLinkDescription")}</p>
        <Link
          href={ROUTES.forgotPassword}
          className="inline-block text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 space-y-2 text-center lg:text-start">
        <h2 className="font-heading text-2xl font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <ResetPasswordForm />
    </>
  );
}
