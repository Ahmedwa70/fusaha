import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { EventName, type TransactionCompletedEvent, type TransactionPaymentFailedEvent } from "@paddle/paddle-node-sdk";
import { db } from "@/lib/db";
import { purchases, users, creditsLedgerEntries } from "@/database/schema";
import { getPaddleClient } from "@/lib/paddle";

const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

// transaction.completed fires once Paddle has collected payment. A
// transaction can rack up failed payment attempts (declined card, etc.)
// before one finally succeeds within the same checkout session — those
// attempts flip the purchase to "failed" (see failPurchase below), so the
// guard here must allow crediting from any non-"completed" status, not just
// "pending", or a later successful retry silently never credits. Guarding
// on "not completed" (rather than no guard at all) is still what prevents a
// retried webhook delivery from double-crediting.
async function creditPurchase(event: TransactionCompletedEvent) {
  const purchaseId = event.data.customData?.purchaseId;
  if (typeof purchaseId !== "string") return;

  const paymentMethod = event.data.payments[0]?.methodDetails?.type ?? null;

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(purchases)
      .set({ status: "completed", completedAt: new Date(), paddlePaymentMethod: paymentMethod })
      .where(and(eq(purchases.id, purchaseId), ne(purchases.status, "completed")))
      .returning({ id: purchases.id, userId: purchases.userId, creditsAmount: purchases.creditsAmount });
    const purchase = updated[0];
    if (!purchase) return;

    await tx.insert(creditsLedgerEntries).values({
      userId: purchase.userId,
      delta: purchase.creditsAmount,
      reason: "purchase",
      refId: purchase.id,
    });

    await tx
      .update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${purchase.creditsAmount}` })
      .where(eq(users.id, purchase.userId));
  });
}

async function failPurchase(event: TransactionPaymentFailedEvent) {
  const purchaseId = event.data.customData?.purchaseId;
  if (typeof purchaseId !== "string") return;

  await db
    .update(purchases)
    .set({ status: "failed" })
    .where(and(eq(purchases.id, purchaseId), eq(purchases.status, "pending")));
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = await getPaddleClient().webhooks.unmarshal(body, webhookSecret, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event?.eventType) {
    case EventName.TransactionCompleted:
      await creditPurchase(event);
      break;
    case EventName.TransactionPaymentFailed:
      await failPurchase(event);
      break;
  }

  return NextResponse.json({ received: true });
}
