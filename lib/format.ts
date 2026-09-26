// Response windows can now be set in days (72, 168 hours), not just hours --
// show those as "3 days" / "7 days" rather than an unwieldy hour count.
export function formatResponseWindow(hours: number): string {
  if (hours >= 72 && hours % 24 === 0) {
    return `${hours / 24} days`
  }
  return `${hours} hours`
}
