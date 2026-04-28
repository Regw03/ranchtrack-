export class NoActiveRanchError extends Error {
  constructor() {
    super("No active ranch");
    this.name = "NoActiveRanchError";
  }
}

export function requireRanch(
  ranchId: string | undefined | null,
  action: string,
): asserts ranchId is string {
  if (!ranchId) {
    console.log(`[ranchGuard] Blocked ${action} - no active ranch`);
    throw new NoActiveRanchError();
  }
}

export function isNoActiveRanchError(error: unknown): boolean {
  return error instanceof NoActiveRanchError;
}
