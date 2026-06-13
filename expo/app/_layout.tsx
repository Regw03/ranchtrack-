import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { isNoActiveRanchError } from "@/utils/ranchGuard";
import { Stack, useRouter, useSegments } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RanchProvider } from "@/providers/RanchProvider";
import { ProcessingSessionProvider } from "@/providers/ProcessingSessionProvider";
import { ThemeProvider, useColors } from "@/providers/ThemeProvider";
import { OnboardingProvider, useOnboarding } from "@/providers/OnboardingProvider";
import { useRanch } from "@/providers/RanchProvider";
import UserSwitchToast from "@/components/UserSwitchToast";
import { getCurrentAuthUserId } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

void SplashScreen.preventAutoHideAsync();

const AUTH_STORAGE_KEY = "ranchtrack_auth_user_id";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isNoActiveRanchError(error)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (isNoActiveRanchError(error)) {
        console.log("[queryCache] silenced NoActiveRanchError");
        return;
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isNoActiveRanchError(error)) {
        console.log("[mutationCache] silenced NoActiveRanchError");
        return;
      }
    },
  }),
});

function RootLayoutNav() {
  const Colors = useColors();

  const screenOptions = useMemo(
    () => ({
      headerBackTitle: "Back",
      headerStyle: { backgroundColor: Colors.background },
      headerTintColor: Colors.primary,
      headerTitleStyle: { color: Colors.text, fontWeight: "600" as const },
      contentStyle: { backgroundColor: Colors.background },
    }),
    [Colors],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="animal/[id]"
        options={{ title: "Animal Details" }}
      />
      <Stack.Screen
        name="add-animal"
        options={{ presentation: "modal", title: "Add Animal" }}
      />
      <Stack.Screen
        name="add-health-record"
        options={{ presentation: "modal", title: "Add Health Record" }}
      />
      <Stack.Screen
        name="add-weight-record"
        options={{ presentation: "modal", title: "Add Weight Record" }}
      />
      <Stack.Screen
        name="add-breeding-record"
        options={{ presentation: "modal", title: "Add Breeding Record" }}
      />
      <Stack.Screen
        name="list/[id]"
        options={{ title: "List" }}
      />
      <Stack.Screen
        name="create-list"
        options={{ presentation: "modal", title: "Create List" }}
      />
      <Stack.Screen
        name="edit-list"
        options={{ presentation: "modal", title: "Edit List" }}
      />
      <Stack.Screen
        name="add-to-list"
        options={{ presentation: "modal", title: "Add Animals" }}
      />
      <Stack.Screen
        name="add-animal-to-list"
        options={{ presentation: "modal", title: "New Animal Profile" }}
      />
      <Stack.Screen
        name="breeding-group/[id]"
        options={{ title: "Breeding Group" }}
      />
      <Stack.Screen
        name="create-breeding-group"
        options={{ presentation: "modal", title: "New Breeding Group" }}
      />
      <Stack.Screen
        name="edit-breeding-group"
        options={{ presentation: "modal", title: "Edit Group" }}
      />
      <Stack.Screen
        name="add-animals-to-breeding-group"
        options={{ presentation: "modal", title: "Add Animals" }}
      />
      <Stack.Screen
        name="processing-sessions"
        options={{ title: "Processing Sessions" }}
      />
      <Stack.Screen
        name="processing-session/[id]"
        options={{ title: "Session Details" }}
      />
      <Stack.Screen
        name="create-processing-session"
        options={{ presentation: "modal", title: "New Processing Session" }}
      />
      <Stack.Screen
        name="log-session-event"
        options={{ presentation: "modal", title: "Log Event" }}
      />
      <Stack.Screen
        name="add-group-to-session"
        options={{ presentation: "modal", title: "Add Group" }}
      />
      <Stack.Screen
        name="log-doctoring-event"
        options={{ presentation: "modal", title: "Doctor Animal" }}
      />
      <Stack.Screen
        name="needs-attention"
        options={{ title: "Needs Attention" }}
      />
      <Stack.Screen
        name="for-sale"
        options={{ title: "For Sale" }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="ranch-profile"
        options={{ title: "Ranch Profile" }}
      />
      <Stack.Screen
        name="ranch-notes"
      />
      <Stack.Screen
        name="log-calving"
        options={{ presentation: "modal", title: "Log Calving" }}
      />
      <Stack.Screen
        name="create-calving-list"
        options={{ presentation: "modal", title: "New Calving List" }}
      />
      <Stack.Screen
        name="edit-calving-list"
        options={{ presentation: "modal", title: "Edit Calving List" }}
      />
      <Stack.Screen
        name="calving-list/[id]"
        options={{ title: "Calving List" }}
      />
      <Stack.Screen
        name="calving-record/[id]"
        options={{ title: "Calving Record" }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

function OnboardingGate() {
  const { isLoading, isOnboardingComplete } = useOnboarding();
  const { ranch, isLoading: isRanchLoading } = useRanch();
  const segments = useSegments();
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedId, authId] = await Promise.all([
          AsyncStorage.getItem(AUTH_STORAGE_KEY),
          getCurrentAuthUserId(),
        ]);
        const authenticated = !!(storedId && authId);
        console.log("[OnboardingGate] auth check —", authenticated ? "logged in" : "not logged in");
        setIsAuthenticated(authenticated);
      } catch (e) {
        console.log("[OnboardingGate] auth check error", e);
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading || isRanchLoading || !authChecked) return;

    const inOnboarding = segments[0] === "onboarding";
    const hasRanch = !!ranch?.name && !!ranch?.id;

    if (isOnboardingComplete && hasRanch) {
      if (inOnboarding) {
        console.log("[OnboardingGate] setup complete, leaving onboarding -> dashboard");
        router.replace("/(tabs)/dashboard");
      }
      return;
    }

    if (!hasRanch && !isOnboardingComplete && !inOnboarding) {
      if (isAuthenticated) {
        console.log("[OnboardingGate] authenticated but no ranch -> sign-in");
        router.replace("/onboarding/sign-in");
      } else {
        console.log("[OnboardingGate] no auth, no ranch -> welcome");
        router.replace("/onboarding/welcome");
      }
    }
  }, [isLoading, isRanchLoading, authChecked, ranch, segments, router, isOnboardingComplete, isAuthenticated]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((err) =>
        console.log("Failed to lock orientation:", err),
      );
    }
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <OnboardingProvider>
            <RanchProvider>
              <ProcessingSessionProvider>
                <OnboardingGate />
                <RootLayoutNav />
                <UserSwitchToast />
              </ProcessingSessionProvider>
            </RanchProvider>
          </OnboardingProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
