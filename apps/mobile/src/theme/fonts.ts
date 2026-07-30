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

/** Passed to useFonts(). Keys double as the `fontFamily` strings in styles. */
export const fontMap = {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  ArchivoNarrow_500Medium,
  ArchivoNarrow_700Bold,
};

/**
 * Family name constants. "Archivo Expanded" is not on the Google Fonts Expo
 * registry, so display falls back to the heaviest Archivo weight.
 */
export const fontFamily = {
  sans: "Archivo_400Regular",
  sansMedium: "Archivo_500Medium",
  sansSemibold: "Archivo_600SemiBold",
  sansBold: "Archivo_700Bold",
  display: "Archivo_700Bold",
  condensed: "ArchivoNarrow_500Medium",
  condensedBold: "ArchivoNarrow_700Bold",
} as const;
