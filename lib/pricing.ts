// Price rules for experts. Both prices are whole dollars only.
//   Questions:      $5 to $500
//   Conversations:  $15 to $100
// Shared by the register page, the Pricing page and the server, so the same
// rule is applied everywhere.

export const QUESTION_PRICE_MIN = 5
export const QUESTION_PRICE_MAX = 500
export const FOLLOW_UP_PRICE_MIN = 15
export const FOLLOW_UP_PRICE_MAX = 100

// DMQ keeps this share of every payment; the expert receives the rest.
export const PLATFORM_FEE_RATE = 0.15

export type PriceCheck = { ok: true; dollars: number } | { ok: false; message: string }

// Checks what was typed in a price box. Anything that isn't a whole number of
// dollars inside the range is refused with a message the person can act on.
export function checkWholeDollarPrice(raw: string, min: number, max: number): PriceCheck {
  const text = raw.trim()
  if (text.length === 0) {
    return { ok: false, message: `Enter a price between $${min} and $${max}.` }
  }
  if (!/^\d+$/.test(text)) {
    return { ok: false, message: 'Use whole dollars only, with no cents.' }
  }
  const dollars = parseInt(text, 10)
  if (dollars < min || dollars > max) {
    return { ok: false, message: `Price must be between $${min} and $${max}.` }
  }
  return { ok: true, dollars }
}

export function checkQuestionPrice(raw: string): PriceCheck {
  return checkWholeDollarPrice(raw, QUESTION_PRICE_MIN, QUESTION_PRICE_MAX)
}

export function checkFollowUpPrice(raw: string): PriceCheck {
  return checkWholeDollarPrice(raw, FOLLOW_UP_PRICE_MIN, FOLLOW_UP_PRICE_MAX)
}

// For a price box: keeps digits only, so cents, signs and letters can't be
// typed at all, and at most three digits (the largest price is $500).
export function onlyPriceDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 3)
}

// What the expert receives from a price in whole dollars, to the cent.
export function expertNetDollars(dollars: number): string {
  return ((dollars * 100 * (1 - PLATFORM_FEE_RATE)) / 100).toFixed(2)
}
