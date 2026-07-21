export interface RetryDecision {
  status: "queued" | "dead_letter";
  nextScheduledAt: Date | null;
}

const BASE_BACKOFF_SECONDS = 60;

/** Exponential backoff (60s, 120s, 240s, ...) up to maxAttempts, then dead_letter for manual requeue. */
export function decideRetry(attemptsAfterThisFailure: number, maxAttempts: number): RetryDecision {
  if (attemptsAfterThisFailure >= maxAttempts) {
    return { status: "dead_letter", nextScheduledAt: null };
  }
  const backoffSeconds = BASE_BACKOFF_SECONDS * 2 ** (attemptsAfterThisFailure - 1);
  return { status: "queued", nextScheduledAt: new Date(Date.now() + backoffSeconds * 1000) };
}
