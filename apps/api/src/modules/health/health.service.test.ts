import { describe, expect, it } from "vitest";
import { computeHealthStatus } from "./health.service";

describe("computeHealthStatus", () => {
  it("is ok when db and redis are up", () => {
    expect(computeHealthStatus(true, true)).toBe("ok");
  });

  it("is degraded when only one dependency is up", () => {
    expect(computeHealthStatus(true, false)).toBe("degraded");
    expect(computeHealthStatus(false, true)).toBe("degraded");
  });

  it("is down when both dependencies are down", () => {
    expect(computeHealthStatus(false, false)).toBe("down");
  });
});
