import { describe, expect, it } from "vitest";
import { fleetAtTime, fleetMetrics, ingestEvents, needsAttention, type Robot, type RobotEvent } from "../app/lib/fleet";

const robots: Robot[] = [
  { robot_id: "r1", robot_type: "picker", start: { x: 10, y: 20 } },
  { robot_id: "r2", robot_type: "hauler", start: { x: 30, y: 40 } },
];

const events: RobotEvent[] = [
  { t: 0, robot_id: "r1", x: 10, y: 20, status: "idle", battery: 80 },
  { t: 0, robot_id: "r2", x: 30, y: 40, status: "active", battery: 50 },
  { t: 5, robot_id: "r1", x: 12, y: 22, status: "error", battery: 79 },
];

describe("fleet state", () => {
  it("reconstructs the fleet at a selected replay time", () => {
    const fleet = fleetAtTime(robots, events, 0);
    expect(fleet.r1.status).toBe("idle");
    expect(fleet.r2.status).toBe("active");
  });

  it("ignores late events so state cannot move backwards", () => {
    const fleet = fleetAtTime(robots, events, 5);
    const next = ingestEvents(fleet, [{ ...events[0], t: 2, battery: 99 }]);
    expect(next.r1.battery).toBe(79);
  });

  it("derives operator-facing metrics from the same state", () => {
    const fleet = fleetAtTime(robots, events, 5);
    expect(fleetMetrics(fleet)).toMatchObject({ total: 2, working: 1, attention: 1 });
    expect(needsAttention(fleet.r1)).toBe(true);
  });
});
