import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect, useState } from "react";
import { LightColors, DarkColors, ThemeColors } from "@/constants/colors";

const THEME_STORAGE_KEY = "ranchtrack_theme_mode";

export type ThemeMode = "light" | "dark";

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  const themeQuery = useQuery({
    queryKey: ["themeMode"],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "dark" || stored === "light") {
          return stored as ThemeMode;
        }
        return "dark" as ThemeMode;
      } catch (e) {
        console.log("Error loading theme:", e);
        return "dark" as ThemeMode;
      }
    },
  });

  useEffect(() => {
    if (themeQuery.data !== undefined) {
      setReady(true);
    }
  }, [themeQuery.data]);

  const themeMode: ThemeMode = themeQuery.data ?? "dark";

  const setThemeMutation = useMutation({
    mutationFn: async (mode: ThemeMode) => {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      return mode;
    },
    onSuccess: (mode) => {
      queryClient.setQueryData(["themeMode"], mode);
    },
  });

  const toggleTheme = useCallback(() => {
    const next = themeMode === "light" ? "dark" : "light";
    setThemeMutation.mutate(next);
  }, [themeMode, setThemeMutation]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeMutation.mutate(mode);
    },
    [setThemeMutation],
  );

  const isDark = themeMode === "dark";

  const colors: ThemeColors = useMemo(
    () => (isDark ? DarkColors : LightColors),
    [isDark],
  );

  return useMemo(() => ({
    themeMode,
    isDark,
    colors,
    toggleTheme,
    setThemeMode,
    ready,
  }), [themeMode, isDark, colors, toggleTheme, setThemeMode, ready]);
});

export function useColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}
