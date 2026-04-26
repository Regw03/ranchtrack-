import { Alert, Platform } from "react-native";
import { router } from "expo-router";

let alertShown = false;

export class NoActiveRanchError extends Error {
  constructor() {
    super("No active ranch");
    this.name = "NoActiveRanchError";
  }
}

function notifyAndRedirect(action: string): void {
  if (alertShown) return;
  alertShown = true;
  const reset = () => {
    alertShown = false;
  };
  const goToSetup = () => {
    try {
      router.replace("/onboarding/ranch-name");
    } catch (e) {
      console.log("ranchGuard: failed to redirect", e);
    } finally {
      reset();
    }
  };

  console.log(`[ranchGuard] Blocked ${action} - no active ranch`);

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert("Please set up your ranch before continuing.");
    }
    goToSetup();
    return;
  }

  Alert.alert(
    "No ranch selected",
    "Please set up your ranch before continuing.",
    [
      {
        text: "Set up ranch",
        onPress: goToSetup,
      },
    ],
    { onDismiss: reset },
  );
}

export function requireRanch(
  ranchId: string | undefined | null,
  action: string,
): asserts ranchId is string {
  if (!ranchId) {
    notifyAndRedirect(action);
    throw new NoActiveRanchError();
  }
}

export function isNoActiveRanchError(error: unknown): boolean {
  return error instanceof NoActiveRanchError;
}
