import { StyleSheet, View } from "react-native";
import { spacing } from "@footconnect/ui";
import { Input } from "../ui";

interface ProfileLocationFieldsProps {
  latitude: string;
  longitude: string;
  latitudeError?: string;
  longitudeError?: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
}

export function ProfileLocationFields({
  latitude,
  longitude,
  latitudeError,
  longitudeError,
  onLatitudeChange,
  onLongitudeChange,
}: ProfileLocationFieldsProps) {
  return (
    <View style={styles.row}>
      <View style={styles.input}>
        <Input
          label="Latitude"
          keyboardType="numbers-and-punctuation"
          value={latitude}
          error={latitudeError}
          onChangeText={onLatitudeChange}
        />
      </View>
      <View style={styles.input}>
        <Input
          label="Longitude"
          keyboardType="numbers-and-punctuation"
          value={longitude}
          error={longitudeError}
          onChangeText={onLongitudeChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  input: { flex: 1 },
});
