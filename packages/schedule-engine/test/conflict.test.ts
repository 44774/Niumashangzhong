import { describe, expect, it } from "vitest";
import { findOverlapConflicts, intervalsOverlap } from "../src/conflict.js";

describe("排班冲突", () => {
  it("时间重叠", () => {
    expect(
      intervalsOverlap(
        { id: "a", startsAt: "2026-08-04T01:00:00Z", endsAt: "2026-08-04T09:30:00Z", kind: "work" },
        { id: "b", startsAt: "2026-08-04T08:00:00Z", endsAt: "2026-08-04T12:00:00Z", kind: "work" },
      ),
    ).toBe(true);
  });

  it("端点相接不重叠", () => {
    expect(
      intervalsOverlap(
        { id: "a", startsAt: "2026-08-04T01:00:00Z", endsAt: "2026-08-04T09:00:00Z", kind: "work" },
        { id: "b", startsAt: "2026-08-04T09:00:00Z", endsAt: "2026-08-04T12:00:00Z", kind: "work" },
      ),
    ).toBe(false);
  });

  it("跨午夜与次日早班重叠检测", () => {
    const conflicts = findOverlapConflicts(
      { id: "new", startsAt: "2026-08-05T01:00:00Z", endsAt: "2026-08-05T09:00:00Z", kind: "work" },
      [{ id: "night", startsAt: "2026-08-04T13:00:00Z", endsAt: "2026-08-04T23:00:00Z", kind: "work" }],
    );
    expect(conflicts).toHaveLength(0);
  });

  it("休息班不参与冲突", () => {
    expect(
      intervalsOverlap(
        { id: "a", startsAt: "2026-08-04T01:00:00Z", endsAt: "2026-08-04T09:00:00Z", kind: "rest" },
        { id: "b", startsAt: "2026-08-04T08:00:00Z", endsAt: "2026-08-04T12:00:00Z", kind: "work" },
      ),
    ).toBe(false);
  });
});
