import { videoLimitsFromEnv } from './limits'

export type VideoMode = 'dmq' | 'external'

// The switch for DMQ-hosted rooms. Anything but "dmq" means the existing
// behaviour (the expert pastes their own link), so a deploy changes nothing
// until this is set deliberately.
export function videoMode(): VideoMode {
  return process.env.FOLLOW_UP_VIDEO === 'dmq' ? 'dmq' : 'external'
}

export function videoLimits() {
  return videoLimitsFromEnv(process.env)
}
