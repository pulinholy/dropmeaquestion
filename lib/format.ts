// Response windows can now be set in days (72, 168 hours), not just hours --
// show those as "3 days" / "7 days" rather than an unwieldy hour count.
export function formatResponseWindow(hours: number): string {
  if (hours >= 72 && hours % 24 === 0) {
    return `${hours / 24} days`
  }
  return `${hours} hours`
}

// Drop the trailing ".00" on whole-dollar prices ("$5" not "$5.00"), but
// keep cents when they're non-zero ("$4.50").
export function formatPrice(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `${dollars}` : dollars.toFixed(2)
}
