# Honey Dew Beach Camp

Customer-facing website and booking journey for Honey Dew Beach Camp, Mousuni Island.

Milestone 1 is frontend only. Bookings live in the browser (`localStorage`). Nothing is sent to the hotel. No payment is taken.

## Setup

```bash
npm install
npm run optimize:media
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`optimize:media` reads originals in `assets/` and writes web derivatives to `public/`. Originals are never modified.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest domain math |
| `npm run test:e2e` | Playwright flows |
| `npx tsc --noEmit` | Typecheck |

## Demonstration bookings

On `/manage-booking`, or use:

| Reference | Phone | What it shows |
|---|---|---|
| `HD-DEMO-8841` | `9876543210` | 1 guest, Single-Bed Non-AC, +45 days. 2-head rate for one person. AC upgrade. 0% cancel slab. |
| `HD-DEMO-5520` | `9876543210` | 4 guests in two Single-Bed rooms, +5 days. Upgrade one room. 30% cancel slab. |
| `HD-DEMO-1033` | `9876543210` | Already cancelled. |

Clearing site data re-seeds these on the next visit. Older V1 bookings in localStorage are ignored (`honeydew.demo.bookings.v2`).

## Booking a new stay

1. Dates
2. Guests (1 or more; rooms are combined as needed)
3. Room setup (for example 4 guests: one Double-Bed, or two Single-Bed rooms)
4. AC or Non-AC per room
5. Contact details
6. Review (room-by-room folio; 30% advance in this demonstration)
7. Demonstration advance
8. `/book/confirmed`

Tariffs are **per person, per night**, calculated per room, and **include meals**. One guest in a Single-Bed Room uses the two-person rate for one person (₹1,499 AC / ₹1,199 Non-AC).

Special requests: call the camp. There is no special-request field.

## Content and configuration

| File | Holds |
|---|---|
| `src/data/hotel.ts` | Name, address, phones, email, maps, check-in/out |
| `src/data/rooms.ts` | Single-Bed / Double-Bed groups and physical room numbers |
| `src/data/tariffs.ts` | Per-person occupancy matrix |
| `src/data/policies.ts` | Cancellation slabs, children, ID |
| `src/data/booking-config.ts` | Advance %, stay limits |
| `src/data/media.ts` | Image ids and alts |
| `src/lib/booking/arrangements.ts` | Room-combination engine |
| `assets/` | Original logos and WhatsApp media. Do not edit. |

## Architecture

- Next.js 16 App Router, Tailwind v4, TypeScript
- One booking reference can cover multiple rooms
- AC mode is per room and does not change inventory
- Physical room numbers are stored as `null` until hotel assignment
- `getBookingService()` is the Milestone 2 seam

## Deploy

Vercel: import the GitHub repo and use the default Next.js settings (`npm run build`, output `.next`).

Set `NEXT_PUBLIC_SITE_URL` to the production origin so canonical URLs, sitemap, and Open Graph resolve correctly.

## Brand

Use only:

- `assets/logo 1.png` (emblem)
- `assets/logo 2.png` (lockup)
- `assets/logo with bg.png` (poster)

`assets/honey-dew-beach-camp-logo.svg` is deprecated and not used on the site.
