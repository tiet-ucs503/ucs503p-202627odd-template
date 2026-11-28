import type { PaymentMethod } from '@/lib/api/types';

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadCheckoutScript(): Promise<RazorpayConstructor> {
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT}"]`,
    );
    const script = existing ?? document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.addEventListener('load', () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay checkout failed to initialise'));
    });
    script.addEventListener('error', () =>
      reject(new Error('Could not load Razorpay checkout')),
    );
    if (!existing) document.body.appendChild(script);
  });
}

/**
 * Stable codes instead of copy: the gateway adapter has no locale, so the caller
 * maps these to `order.payment.errors.*` (same pattern as `lib/speech.ts`).
 */
export type CheckoutErrorCode = 'not-configured' | 'load-failed' | 'cancelled' | 'failed';

export type CheckoutResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: CheckoutErrorCode };

/**
 * Opens Razorpay Checkout and resolves once the buyer finishes or dismisses it.
 *
 * The returned payment id is passed to `POST /orders/:id/payment/confirm`, which is
 * what actually moves the payment into escrow server-side.
 */
export async function openRazorpayCheckout(options: {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  description: string;
  method: PaymentMethod;
}): Promise<CheckoutResult> {
  if (!options.keyId || !options.razorpayOrderId) {
    return { ok: false, error: 'not-configured' };
  }

  let Razorpay: RazorpayConstructor;
  try {
    Razorpay = await loadCheckoutScript();
  } catch {
    return { ok: false, error: 'load-failed' };
  }

  return new Promise<CheckoutResult>((resolve) => {
    let settled = false;
    const settle = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const checkout = new Razorpay({
      key: options.keyId,
      order_id: options.razorpayOrderId,
      amount: options.amountPaise,
      currency: 'INR',
      name: 'AgriConnect',
      description: options.description,
      // Preselect the method the buyer picked in our UI.
      method: options.method === 'cod' ? undefined : options.method,
      handler: (response: RazorpayResponse) =>
        settle({ ok: true, paymentId: response.razorpay_payment_id }),
      modal: {
        ondismiss: () => settle({ ok: false, error: 'cancelled' }),
      },
    });

    checkout.on('payment.failed', () => settle({ ok: false, error: 'failed' }));
    checkout.open();
  });
}
