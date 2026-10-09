import { describe, expect, it } from "vitest";
import { formatApproximateArea } from "./approximate-area";

describe("formatApproximateArea", () => {
  it("renders rounded latitude and longitude as a readable area", () => {
    expect(formatApproximateArea({ lat: 36.75, lng: 3.06 })).toBe(
      "~36.75, 3.06",
    );
  });
});
