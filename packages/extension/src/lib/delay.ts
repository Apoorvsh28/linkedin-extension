export function randomIntBetween(min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delay before a simulated click/keystroke, in ms — short and human-scale, not the long inter-action pacing. */
export function microActionDelayMs(): number {
  return randomIntBetween(250, 1100);
}
