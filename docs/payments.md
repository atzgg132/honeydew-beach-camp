# Payments

Honey Dew takes an advance online and the remaining balance at the camp. The only production
provider is **Razorpay Standard Checkout**. Cashfree is not used.

## Flow

1. The guest reviews the quote and the server allocates a 15-minute room hold.
2. `POST /api/checkout/holds/:holdId/payment-order` (or `POST /api/create-order` with the checkout
   session) creates a Razorpay order for `booking.advanceDuePaise`. The amount is never taken from
   the client. Minimum 100 paise.
3. The browser loads `https://checkout.razorpay.com/v1/checkout.js` and opens the modal with the
   Razorpay `order_id` and the public Key ID.
4. On success Razorpay returns `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`.
5. `POST /api/payments/verify` (also `/api/verify-payment`) checks
   `HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)` with a constant-time compare. A mismatch
   returns 400 and does **not** mark the booking paid. A match fetches the payment from Razorpay,
   requires `captured`, then runs the shared settlement path.
6. `POST /api/payments/webhook/razorpay` is the fallback for `payment.captured` / `order.paid` if
   the guest closes the modal after paying. It verifies `X-Razorpay-Signature` over the raw body
   with `PAYMENT_WEBHOOK_SECRET`.

The Key Secret never leaves the server. Settlement (`settleVerifiedPayment`) is provider-agnostic
and is the only place a booking becomes `CONFIRMED`.

## Development simulator

When `PAYMENT_PROVIDER=dev` and `ENABLE_DEV_PAYMENT=true` (and `NODE_ENV` is not production),
checkout uses the local simulator instead of Razorpay so CI can complete a booking. That path still
calls the same settlement function. The simulator route returns 404 in production.

## Credentials

See `docs/environment-variables.md` and blocker **B2**. Test cards are listed in the Razorpay
docs; never commit live keys.
