// react-native-razorpay@3.0.0 ships no TypeScript types and the DefinitelyTyped
// package only covers the older 2.x API — this covers only what this app uses.
declare module "react-native-razorpay" {
  export interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    order_id: string;
    prefill?: { email?: string; contact?: string; name?: string };
    theme?: { color?: string };
  }

  export interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayErrorResponse {
    code?: number;
    description?: string;
    error?: { description?: string };
  }

  const RazorpayCheckout: {
    open: (options: RazorpayCheckoutOptions) => Promise<RazorpaySuccessResponse>;
  };

  export default RazorpayCheckout;
}
