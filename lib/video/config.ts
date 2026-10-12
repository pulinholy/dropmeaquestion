import { videoLimitsFromEnv } from './limits'

// Whether conversations can be offered at all. They need the video provider's
// keys, so a deploy without them offers nothing instead of an unusable room.
// FOLLOW_UP_VIDEO=off is the emergency stop: no new conversations are offered
// (existing bookings are not touched).
export function videoAvailable(): boolean {
  if (process.env.FOLLOW_UP_VIDEO === 'off') return false
  return Boolean(process.env.DAILY_API_KEY && process.env.DAILY_WEBHOOK_HMAC)
}

export function videoLimits() {
  return videoLimitsFromEnv(process.env)
}
