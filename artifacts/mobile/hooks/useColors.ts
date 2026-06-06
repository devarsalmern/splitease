import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

type Palette = typeof colors.light;

export function useColors(): Palette & { radius: number } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark" && "dark" in colors;
  const palette: Palette = isDark
    ? (colors as typeof colors & { dark: Palette }).dark
    : colors.light;
  return { ...palette, radius: colors.radius };
}
