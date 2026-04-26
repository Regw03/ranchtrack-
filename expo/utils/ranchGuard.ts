import { router } from "expo-router";

let redirectPending = false;

export class NoActiveRanchError extends Error {
  constructor() {
    super("No active ranch");
    this.name = "NoActiveRanchError";
  }
}

function silentRedirect(action: string): void {
  console.log(`[ranchGuard] Blocked ${action} - no active ranch`);
  if (redirectPending) return;
  redirectPending = true;
  setTimeout(() => {
    try {
      router.replace("/onboarding/ranch-name");
    } catch (e) {
      console.log("ranchGuard: failed to redirect", e);
    } finally {
      redirectPending = false;
    }
  }, 0);
}

export function requireRanch(
  ranchId: string | undefined | null,
  action: string,
): asserts ranchId is string {
  if (!ranchId) {
    silentRedirect(action);
    throw new NoActiveRanchError();
  }
}

export function isNoActiveRanchError(error: unknown): boolean {
  return error instanceof NoActiveRanchError;
}
