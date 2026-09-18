"use client";

// Paddle.js attaches itself to window.Paddle; there's no npm client SDK for
// this, so we load and initialize it once, lazily, the first time a checkout
// is actually opened rather than on every page that might render BuyButton.
declare global {
  interface Window {
    Paddle?: {
      Environment: { set(environment: "sandbox" | "production"): void };
      Initialize(options: { token: string }): void;
      Checkout: { open(options: { transactionId: string; settings?: { successUrl?: string } }): void };
    };
  }
}

let loadPromise: Promise<void> | null = null;

export function loadPaddle(): Promise<void> {
  if (loadPromise) return loadPromise;

  // A rejected attempt (e.g. a transient network blip) must not be cached —
  // otherwise every later click reuses the same dead promise and the button
  // can never recover without a full page reload.
  const promise: Promise<void> = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("loadPaddle called on the server"));
    if (window.Paddle) return resolve();

    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return reject(new Error("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set"));

    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.async = true;
    script.onload = () => {
      // Environment must be set before Initialize — Initialize itself takes
      // no "environment" option, so passing one there throws.
      try {
        if (process.env.NEXT_PUBLIC_PADDLE_ENV === "production") {
          window.Paddle?.Environment.set("production");
        } else {
          window.Paddle?.Environment.set("sandbox");
        }
        window.Paddle?.Initialize({ token });
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Failed to initialize Paddle.js"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });

  loadPromise = promise;
  promise.catch(() => {
    loadPromise = null;
  });

  return promise;
}
