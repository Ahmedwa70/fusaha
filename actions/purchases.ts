"use server";

import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { creditPackages, purchases } from "@/database/schema";
import { requireTeacher } from "@/lib/auth/dal";
import { getPaddleClient, getOrCreatePaddleCustomer } from "@/lib/paddle";
import { logger } from "@/lib/logger";

export type PurchaseActionState = { error: string };
export type PurchaseActionResult = PurchaseActionState | { transactionId: string };

// Creates a Paddle draft transaction for a credit package. Unlike Stripe,
// Paddle checkout runs client-side (Paddle.js overlay against this
// transaction id) rather than a server redirect — see BuyButton. The
// purchase row starts "pending"; the webhook (app/api/webhooks/paddle) is
// what actually credits the account once Paddle confirms payment.
export async function createCheckoutSession(packageId: string): Promise<PurchaseActionResult> {
  const teacher = await requireTeacher();
  const tErrors = await getTranslations("dashboard.credits.errors");

  const [pkg] = await db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.id, packageId))
    .limit(1);
  if (!pkg || !pkg.active) return { error: tErrors("packageNotFound") };
  if (!pkg.paddlePriceId) return { error: tErrors("checkoutFailed") };

  let paddle;
  try {
    paddle = getPaddleClient();
  } catch {
    return { error: tErrors("checkoutFailed") };
  }

  let customerId: string;
  try {
    customerId = await getOrCreatePaddleCustomer(teacher);
  } catch (err) {
    logger.error({ err, teacherId: teacher.id }, "Failed to get/create Paddle customer");
    return { error: tErrors("checkoutFailed") };
  }

  const [purchase] = await db
    .insert(purchases)
    .values({
      userId: teacher.id,
      packageId: pkg.id,
      creditsAmount: pkg.creditsAmount,
      price: pkg.price,
      currency: pkg.currency,
      status: "pending",
      paddleTransactionId: "pending",
    })
    .returning({ id: purchases.id });

  // Anything past this point (a bad Paddle account setting like a missing
  // default payment link, a network blip, etc.) must not throw — an
  // uncaught error here crashes the whole page with Next.js's generic error
  // screen instead of showing the teacher a normal "checkout failed"
  // message next to the button.
  try {
    const transaction = await paddle.transactions.create({
      items: [{ priceId: pkg.paddlePriceId, quantity: 1 }],
      customerId,
      customData: { purchaseId: purchase.id, userId: teacher.id, packageId: pkg.id },
    });

    await db.update(purchases).set({ paddleTransactionId: transaction.id }).where(eq(purchases.id, purchase.id));

    return { transactionId: transaction.id };
  } catch (err) {
    logger.error({ err, purchaseId: purchase.id }, "Failed to create Paddle transaction");
    await db.update(purchases).set({ status: "failed" }).where(eq(purchases.id, purchase.id));
    return { error: tErrors("checkoutFailed") };
  }
}
