const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpayCheckoutSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  handler: (response: RazorpayCheckoutSuccess) => void;
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: { error?: { description?: string; reason?: string; code?: string } }) => void,
  ) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

export async function ensureRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("The payment form can only open in the browser.");
  }
  if (window.Razorpay) return;

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load the payment form.")), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment form."));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(input: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}): Promise<RazorpayCheckoutSuccess> {
  await ensureRazorpayScript();
  const Checkout = window.Razorpay;
  if (!Checkout) {
    throw new Error("Could not load the payment form.");
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const checkout = new Checkout({
      key: input.keyId,
      amount: input.amountPaise,
      currency: input.currency,
      name: input.name,
      description: input.description,
      order_id: input.orderId,
      prefill: input.prefill,
      theme: { color: "#c9973f" },
      handler(response) {
        if (settled) return;
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss() {
          finish(new Error("Payment was cancelled."));
        },
      },
    });
    checkout.on("payment.failed", (response) => {
      finish(new Error(response.error?.description || "Payment failed."));
    });
    checkout.open();
  });
}
