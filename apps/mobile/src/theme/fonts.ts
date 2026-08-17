import {
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_700Bold_Italic,
} from "@expo-google-fonts/barlow-condensed";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import {
  ArchivoNarrow_500Medium,
  ArchivoNarrow_700Bold,
} from "@expo-google-fonts/archivo-narrow";

/** Passed to useFonts() in App.tsx. Keys double as the fontFamily strings in styles. */
export const fontMap = {
  // Barlow Condensed (Headlines / Titles / Scoreboards)
  BarlowCondensed_400Regular,
  BarlowCondensed_500Medium,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_700Bold_Italic,

  // JetBrains Mono (Stats / Elo / Metrics / Distances / Timers)
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,

  // Inter (Body / UI / Multilingual descriptions)
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,

  // Archivo backward compatibility
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  ArchivoNarrow_500Medium,
  ArchivoNarrow_700Bold,
};

/**
 * Stitch Pitch Dark Kinetic Font Family constants.
 */
export const fontFamily = {
  // Headlines (Barlow Condensed)
  display: "BarlowCondensed_800ExtraBold",
  headline: "BarlowCondensed_700Bold",
  headlineItalic: "BarlowCondensed_700Bold_Italic",
  headlineSemi: "BarlowCondensed_600SemiBold",

  // Body (Inter)
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  label: "Inter_600SemiBold",

  // Stats / Data (JetBrains Mono)
  stats: "JetBrainsMono_700Bold",
  statsRegular: "JetBrainsMono_400Regular",

  // Legacy mappings for existing screens
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemibold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  condensed: "BarlowCondensed_700Bold",
  condensedBold: "BarlowCondensed_800ExtraBold",
} as const;
