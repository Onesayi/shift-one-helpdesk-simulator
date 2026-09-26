# Billing setup

Shift One is a static site with no server and no database. Billing is handled by **hosted payment pages**: the buyer clicks a button, pays on the provider's secure page, and comes back. Card details never touch this site, so there's no PCI scope to worry about.

Everything is configured in [`js/config.js`](../js/config.js).

---

## Option A: Stripe Payment Links (recommended)

1. Create a free account at [stripe.com](https://stripe.com) and complete business verification so you can receive payouts.
2. **Product catalog → Add product** for each paid plan:
   - *1:1 Tutoring*: one-time price, e.g. $25
   - *Interview Prep Pack*: one-time price, e.g. $80
3. On each product: **Create payment link**. Useful settings:
   - *Collect customers' names* and *phone numbers*: on
   - *After payment → Don't show confirmation page → Redirect* to your booking page (see below), so buyers schedule straight away
   - Optional custom field: "What role are you preparing for?"
4. Paste each link into `config.js`:

```js
{
  id: 'session',
  name: '1:1 Tutoring',
  price: 25,
  paymentLink: 'https://buy.stripe.com/xxxxxxxxxxxxxx',
  ...
}
```

5. Commit and push. GitHub Pages redeploys automatically.

Test first with Stripe's **test mode** links (`https://buy.stripe.com/test_...`) and the test card `4242 4242 4242 4242`.

## Option B: Booking tool with payment built in

Cal.com and Calendly can both take payment at booking time through a Stripe integration. Create an event type (e.g. "Help desk coaching, 60 min") with a price, then either:

- put the booking URL in a plan's `paymentLink`, or
- set `bookingUrl` in `config.js` to show a "See availability" link under the plans.

## Contact-based plans

Plans with `action: 'contact'` (Classroom & Bootcamp) open an email to `contactEmail`. Set it in `config.js`. Until a plan has a link (or an email is configured), its button shows **Coming soon**.

> Publishing your email in a public repo exposes it to scrapers. A separate business address or a contact form (e.g. Formspree, Tally) is a good idea.

---

## Changing prices and plans

Each entry in `CONFIG.plans` renders one card:

| Field | Meaning |
|---|---|
| `name`, `blurb`, `features` | Card text |
| `price` | Number; `0` shows *Free*, `null` shows *Let's talk* |
| `per` | Small print next to the price |
| `paymentLink` | Where the button goes |
| `action` | `'play'` starts the game; `'contact'` emails you |
| `highlight` | Adds the "Most popular" ribbon |

`currency` sets the symbol shown on every card.

---

## Later: paid in-app features

Payment links are perfect for selling **your time**. If you later want to sell **software features** (e.g. a Pro scenario pack), you need a small backend so the purchase can't be bypassed in the browser:

1. **Auth + database:** Supabase or Firebase (user accounts, a `subscriptions` table).
2. **Stripe Checkout + webhooks:** a serverless function (Supabase Edge Functions, Cloudflare Workers, Vercel) receives `checkout.session.completed` and marks the user as Pro.
3. **Serve Pro content from the backend** only to Pro users. Anything shipped in the static JS can be read by anyone.

## Before you take payments

- Check local rules on registering a business and declaring income, and set up your Stripe tax settings.
- Publish a short refund and cancellation policy (e.g. free rescheduling with 24h notice).
- Keep receipts. Stripe emails them automatically when enabled.
