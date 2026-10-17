# Drop Me A Question: explainer video

`explainer.html` is a self-playing, 62-second animation made from DMQ's own colours and fonts. No avatar, no voice, no stock footage. The text does the talking, so it works muted on YouTube, Instagram and Facebook. Add music at the end (see below).

## Watch it

Double-click `explainer.html` (it opens in your browser). Press **Space** to play.

| Key | What it does |
|---|---|
| Space | play / pause |
| R | restart |
| Left / Right arrow | back / forward 2 seconds |
| F11 | full screen |

Add `?v=1` to the address for the **vertical** version (Reels, Shorts, Facebook Stories): `explainer.html?v=1`.

## Scenes

| Time | On screen |
|---|---|
| 0:00 | "People ask you things." Three messages arrive. "In DMs. In comments. Over coffee. For free." |
| 0:05 | "What if they paid for your answers?" |
| 0:10 | "Set your price." A $25 question; "You receive $21.25 after DMQ's 15% platform fee"; "Replies within 24 hours" |
| 0:19 | "Share one link." The page link goes in a bio, a newsletter and DMs |
| 0:27 | "They ask you directly." A question is typed; "Their card is held, not charged. You're paid when you answer." |
| 0:38 | "You answer in your own words." The answer email; "Your email stays private" |
| 0:46 | "Want to go deeper?" An optional 15-minute conversation: you set the price, no links to send, not recorded |
| 0:54 | "Your experience is valuable. Make it count." Create your page. dropmeaquestion.com |

The price, name and question in the animation are made-up examples. Change them in `explainer.html` if you like (search for "25", "Alex Rivera" and the typed question).

## The video files

**Version 2 (use this one)**: opens with the home page line, follows Maya from setup to answer, and adds the optional conversation. About 50 seconds. Source: `explainer-v2.html`.
- `out/dmq-explainer-v2-16x9.mp4` (1920x1080) for YouTube and Facebook.
- `out/dmq-explainer-v2-9x16.mp4` (1080x1920) for Reels, Shorts and Stories.
- `voiceover-v2.md` is the timed narration to record, and `captions-v2.srt` the matching captions.

Version 1 (the first draft, 64 seconds, generic example) is still in `out/`: `dmq-explainer-16x9.mp4` and `dmq-explainer-9x16.mp4`.

All files are 30 fps with a silent audio track so you can add your own voice and music.

To change the text or timing and make new files:

```
cd promo/tools
npm install            (first time only)
node render.cjs --file explainer-v2.html --name dmq-explainer-v2            (16:9)
node render.cjs --file explainer-v2.html --name dmq-explainer-v2 --vertical   (9:16)
```

Each takes about four to five minutes. It needs Google Chrome installed. Edit `explainer.html` first, and preview it by opening the file and pressing Space.

## Music

Keep it quiet and warm: light acoustic or soft piano, no lyrics. Use only music you may use commercially:
- the YouTube Audio Library (free, in YouTube Studio),
- Clipchamp's stock audio, or
- the music library inside Instagram or Facebook (for posts made in their apps).

## Posting

- **YouTube (16:9):** upload the horizontal file. Title: "Get paid for what you know: Drop Me A Question in 60 seconds". Add the link `https://www.dropmeaquestion.com` as the first line of the description.
- **YouTube Shorts, Instagram Reels, Facebook Reels (9:16):** upload the vertical file. Shorts can now be up to 3 minutes, so 64 seconds is fine.
- Put the link in the first line of every description, in the bio, and pinned in the first comment.
- **Post it when the site is live.** Until the site leaves maintenance mode, people who click the link see "coming soon".
- Suggested thumbnail text: "Get paid for your answers".
