export function formatApproximateArea(area: { lat: number; lng: number }) {
  return `~${area.lat.toFixed(2)}, ${area.lng.toFixed(2)}`;
}
