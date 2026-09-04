export const STATUSES = [
  "idle", "active", "on_mission", "charging", "blocked", "error", "maintenance", "offline",
] as const;

export type RobotStatus = (typeof STATUSES)[number];

export type Robot = {
  robot_id: string;
  robot_type: "picker" | "hauler";
  start: { x: number; y: number };
};

export type RobotEvent = {
  t: number;
  robot_id: string;
  x: number;
  y: number;
  status: RobotStatus;
  battery: number;
  task_event?: "task_started" | "task_completed";
};

export type RobotState = RobotEvent & { robot_type: Robot["robot_type"] };
export type FleetState = Record<string, RobotState>;

export const WORKING_STATUSES = new Set<RobotStatus>(["active", "on_mission"]);
export const ATTENTION_STATUSES = new Set<RobotStatus>(["blocked", "error", "maintenance", "offline"]);

export function parseEventLog(source: string): RobotEvent[] {
  return source.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line) as RobotEvent;
    } catch {
      throw new Error(`Invalid event data on line ${index + 1}`);
    }
  });
}

export function eventsBySecond(events: RobotEvent[]): Map<number, RobotEvent[]> {
  const timeline = new Map<number, RobotEvent[]>();
  for (const event of events) {
    const existing = timeline.get(event.t) ?? [];
    existing.push(event);
    timeline.set(event.t, existing);
  }
  return timeline;
}

export function fleetAtTime(robots: Robot[], events: RobotEvent[], time: number): FleetState {
  const fleet: FleetState = Object.fromEntries(robots.map((robot) => [robot.robot_id, {
    t: 0,
    robot_id: robot.robot_id,
    robot_type: robot.robot_type,
    x: robot.start.x,
    y: robot.start.y,
    status: "idle" as RobotStatus,
    battery: 100,
  }]));

  for (const event of events) {
    if (event.t > time) break;
    const robot = fleet[event.robot_id];
    if (robot) fleet[event.robot_id] = { ...event, robot_type: robot.robot_type };
  }
  return fleet;
}

export function ingestEvents(fleet: FleetState, updates: RobotEvent[]): FleetState {
  const next = { ...fleet };
  for (const event of updates) {
    const current = next[event.robot_id];
    if (current && event.t >= current.t) next[event.robot_id] = { ...event, robot_type: current.robot_type };
  }
  return next;
}

export function needsAttention(robot: RobotState): boolean {
  return ATTENTION_STATUSES.has(robot.status) || robot.battery < 20;
}

export function fleetMetrics(fleet: FleetState) {
  const robots = Object.values(fleet);
  const working = robots.filter((robot) => WORKING_STATUSES.has(robot.status)).length;
  const attention = robots.filter(needsAttention).length;
  const averageBattery = robots.length
    ? robots.reduce((sum, robot) => sum + robot.battery, 0) / robots.length
    : 0;
  return { total: robots.length, working, attention, averageBattery };
}

export type TrendPoint = { t: number; working: number; attention: number };

export function buildTrend(robots: Robot[], events: RobotEvent[], interval = 30): TrendPoint[] {
  const maxTime = events.at(-1)?.t ?? 0;
  const points: TrendPoint[] = [];
  for (let t = 0; t <= maxTime; t += interval) {
    const metrics = fleetMetrics(fleetAtTime(robots, events, t));
    points.push({
      t,
      working: metrics.total ? (metrics.working / metrics.total) * 100 : 0,
      attention: metrics.total ? (metrics.attention / metrics.total) * 100 : 0,
    });
  }
  return points;
}

export function createLiveEvents(fleet: FleetState, tick: number): RobotEvent[] {
  return Object.values(fleet).map((robot, index) => {
    const phase = tick / 12 + index * 1.7;
    const charging = robot.status === "charging";
    const nextStatus: RobotStatus = robot.battery < 18 ? "charging" :
      tick % 75 === index * 4 ? "idle" :
      tick % 95 === index * 5 ? "on_mission" : robot.status === "offline" ? "idle" : robot.status;
    return {
      t: robot.t + 2,
      robot_id: robot.robot_id,
      x: Math.max(5, Math.min(895, robot.x + Math.cos(phase) * (nextStatus === "idle" || charging ? 0.3 : 2.5))),
      y: Math.max(5, Math.min(555, robot.y + Math.sin(phase) * (nextStatus === "idle" || charging ? 0.3 : 2.5))),
      status: nextStatus,
      battery: Math.max(5, Math.min(100, robot.battery + (charging ? 0.35 : -0.07))),
    };
  });
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function statusLabel(status: RobotStatus): string {
  return status.replace("on_mission", "on mission").replace(/_/g, " ");
}
