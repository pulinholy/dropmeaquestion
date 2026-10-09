// Spots the in-app browsers (Instagram, Facebook, TikTok and similar) that
// often can't use the microphone, so people can be told to open the page in
// their normal browser before the conversation starts. A heuristic from the
// browser's own description; a miss only means no hint is shown.

const NAMED: [RegExp, string][] = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/\bLine\//i, 'Line'],
  [/Twitter/i, 'X'],
]

export function detectInAppBrowser(userAgent: string): string | null {
  for (const [pattern, name] of NAMED) {
    if (pattern.test(userAgent)) return name
  }
  // Any other app showing a web page inside itself. An Android WebView marks
  // itself "wv"; on iPhone, a normal browser always says "Safari" and an app's
  // embedded page doesn't.
  if (/; wv\)/.test(userAgent)) return 'another app'
  if (/(iPhone|iPad|iPod)/.test(userAgent) && /AppleWebKit/.test(userAgent) && /Mobile\//.test(userAgent) && !/Safari/.test(userAgent)) {
    return 'another app'
  }
  return null
}
