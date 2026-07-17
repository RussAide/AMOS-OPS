import { describe, expect, it } from "vitest";

import {
  mayUseNotificationDemoData,
  resolveNotificationCollection,
} from "./notification-context";

describe("RM.1 notification production data boundary", () => {
  it("permits demo fixtures only in evaluation or the training workspace", () => {
    expect(mayUseNotificationDemoData(false, "operational")).toBe(false);
    expect(mayUseNotificationDemoData(false, null)).toBe(false);
    expect(mayUseNotificationDemoData(false, "training")).toBe(true);
    expect(mayUseNotificationDemoData(true, "operational")).toBe(true);
  });

  it("never substitutes demo notifications for absent Production data", () => {
    const demo = [{ id: "synthetic-notification" }];

    expect(resolveNotificationCollection(undefined, demo, false)).toEqual([]);
    expect(resolveNotificationCollection([], demo, false)).toEqual([]);
  });

  it("preserves authoritative Production notifications", () => {
    const authoritative = [{ id: "notification-1" }];
    const demo = [{ id: "synthetic-notification" }];

    expect(resolveNotificationCollection(authoritative, demo, false)).toEqual(
      authoritative,
    );
  });

  it("allows fixture fallback only inside the isolated demo boundary", () => {
    const demo = [{ id: "synthetic-notification" }];

    expect(resolveNotificationCollection(undefined, demo, true)).toEqual(demo);
    expect(resolveNotificationCollection([], demo, true)).toEqual(demo);
  });
});
