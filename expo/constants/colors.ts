export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  background: string;
  backgroundDark: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  border: string;
  borderLight: string;
  shadow: string;
  success: string;
  warning: string;
  error: string;
  overlay: string;
}

export const LightColors: ThemeColors = {
  primary: "#14603A",
  primaryLight: "#1D7A4A",
  primaryDark: "#0E4A2B",
  secondary: "#6B5840",
  secondaryLight: "#EAE4DA",
  secondaryDark: "#54442F",
  accent: "#B04E12",
  accentLight: "#C86228",
  accentDark: "#8A3D0E",
  background: "#F0EDE8",
  backgroundDark: "#DED9D1",
  surface: "#FFFFFF",
  surfaceElevated: "#F8F7F5",
  text: "#111111",
  textSecondary: "#3A3A3A",
  textTertiary: "#5C5C5C",
  textInverse: "#FFFFFF",
  border: "#C2BBB0",
  borderLight: "#D8D2C9",
  shadow: "#111111",
  success: "#256B3E",
  warning: "#A87008",
  error: "#B53225",
  overlay: "rgba(17, 17, 17, 0.5)",
} as const;

export const DarkColors: ThemeColors = {
  primary: "#5FAF7B",
  primaryLight: "#74C490",
  primaryDark: "#4A9A66",
  secondary: "#8B7A5E",
  secondaryLight: "#3D3529",
  secondaryDark: "#A08E72",
  accent: "#E07A45",
  accentLight: "#E89060",
  accentDark: "#C4622D",
  background: "#141414",
  backgroundDark: "#1C1C1C",
  surface: "#1E1E1E",
  surfaceElevated: "#252525",
  text: "#E8E4E0",
  textSecondary: "#A0A0A0",
  textTertiary: "#6A6A6A",
  textInverse: "#FFFFFF",
  border: "#2E2E2E",
  borderLight: "#252525",
  shadow: "#000000",
  success: "#5BB97E",
  warning: "#E0A84C",
  error: "#E0655A",
  overlay: "rgba(0, 0, 0, 0.6)",
} as const;

const Colors = LightColors;
export default Colors;
