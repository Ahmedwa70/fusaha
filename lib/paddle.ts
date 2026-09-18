import "server-only";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/database/schema";

let cachedClient: Paddle | null = null;

// Lazy on purpose: unlike DATABASE_URL, the app is meant to run (dashboard,
// lessons, everything except actually checking out) before Paddle keys are
// configured, so this must not crash module evaluation for pages that never
// touch payments.
export function getPaddleClient(): Paddle {
  if (!cachedClient) {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) throw new Error("PADDLE_API_KEY is not set");
    cachedClient = new Paddle(apiKey, {
      environment: process.env.PADDLE_ENV === "production" ? Environment.production : Environment.sandbox,
    });
  }
  return cachedClient;
}

export async function getOrCreatePaddleCustomer(user: {
  id: string;
  email: string;
  name: string;
  paddleCustomerId: string | null;
}) {
  if (user.paddleCustomerId) return user.paddleCustomerId;

  const customer = await getPaddleClient().customers.create({
    email: user.email,
    name: user.name,
    customData: { userId: user.id },
  });

  await db.update(users).set({ paddleCustomerId: customer.id }).where(eq(users.id, user.id));
  return customer.id;
}
