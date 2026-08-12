/**
 * The current Damru Razorpay integration is order-backed Standard Checkout.
 * It does not expose Razorpay customer/token APIs, so there is no provider
 * source from which the app can safely list or mutate saved methods.
 *
 * Keep this capability response explicit instead of inventing local cards.
 * When customer tokenization is added server-side, this service is the single
 * mobile seam to replace with authenticated provider-backed API calls.
 */
export type SavedPaymentMethod = {
  id: string;
  provider: "razorpay";
  brand: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isPrimary: boolean;
};

export type PaymentMethodsCapability = {
  savedMethodsSupported: boolean;
  primaryMethodSupported: boolean;
  deleteMethodSupported: boolean;
  addFlow: "razorpay_checkout";
  methods: SavedPaymentMethod[];
};

const CHECKOUT_ONLY_CAPABILITY: PaymentMethodsCapability = {
  savedMethodsSupported: false,
  primaryMethodSupported: false,
  deleteMethodSupported: false,
  addFlow: "razorpay_checkout",
  methods: [],
};

export async function getPaymentMethods(): Promise<PaymentMethodsCapability> {
  return CHECKOUT_ONLY_CAPABILITY;
}
