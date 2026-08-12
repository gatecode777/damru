import { post } from "@/lib/api";

/**
 * Thin wrappers around the SAME backend Razorpay endpoints the website uses
 * (app/api/payments/razorpay/{order,verify}) — no separate mobile payment
 * logic or amount calculation. Throws ApiRequestError on failure, same as
 * every other call in this file's siblings (rewardsApi.ts); callers catch it
 * the same way they already catch order placement failures.
 */

export interface RazorpayOrderResponse {
  success: true;
  zeroPayable?: boolean;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
}

export const createRazorpayOrder = (orderId: string) =>
  post<RazorpayOrderResponse>("/api/payments/razorpay/order", { orderId });

export const verifyRazorpayPayment = (input: {
  orderId: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}) => post<{ success: true; alreadyFinalized: boolean }>("/api/payments/razorpay/verify", input);

export const reportRazorpayPaymentFailed = (input: { orderId: string; razorpayOrderId: string }) =>
  post<{ success: true }>("/api/payments/razorpay/fail", input);
