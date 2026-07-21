import { randomIntBetween, sleep } from "./delay.js";

/** Words-per-minute reading speed range used to calibrate dwell time from visible content length. */
const WPM_MIN = 180;
const WPM_MAX = 280;
const MIN_READING_MS = 1200;
const MAX_READING_MS = 12_000;

/** Estimates how long a human would spend reading this much text, with randomized reading speed. */
export function readingDelayMs(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const wpm = randomIntBetween(WPM_MIN, WPM_MAX);
  const ms = (wordCount / wpm) * 60_000;
  return Math.min(Math.max(ms, MIN_READING_MS), MAX_READING_MS);
}

/** A few small scroll movements with pauses — mostly downward, occasionally back up like re-reading. */
export async function randomScroll(steps = 3): Promise<void> {
  for (let i = 0; i < steps; i++) {
    const goingBack = Math.random() < 0.15;
    const distance = randomIntBetween(150, 600) * (goingBack ? -1 : 1);
    window.scrollBy({ top: distance, behavior: "smooth" });
    await sleep(randomIntBetween(400, 1400));
  }
}
