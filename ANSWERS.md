# Written Answers

## 1. What holds the fleet state, and why that shape?

`FleetState` in `app/lib/fleet.ts` is a normalized record keyed by `robot_id`. Each value contains the robot's latest telemetry plus its fixed `robot_type`. A keyed record makes an individual robot update direct, prevents duplicate current-state entries, and makes it easy for the map, roster, summary cards, and inspector to read the same snapshot. The replay and live modes differ only in how they produce that snapshot: `fleetAtTime` reconstructs it for seeking through recorded history, while `ingestEvents` applies live batches and rejects updates older than the current robot record.

`FleetDashboard` in `app/components/FleetDashboard.tsx` owns the current `FleetState` and source controls. Neither the map nor the metrics understand where an event came from. That boundary means a future WebSocket source can call the same ingestion function without rewriting the views.

## 2. One real tradeoff

I generated the live feed in the browser through `createLiveEvents` instead of deploying a separate streaming server. This makes the required deployed link reliable and self-contained, and it keeps the exercise focused on frontend state and operator experience. The cost is that the live stream is local to one tab: different operators do not share a clock, reconnecting does not recover missed events, and it cannot model real network behavior as faithfully as a server-backed WebSocket feed.

I reduced that cost by making the source boundary explicit. The simulator returns ordinary `RobotEvent` objects and `ingestEvents` applies them. Replacing the timer with a WebSocket listener would be a contained change in `FleetDashboard`, while the state rules and views would remain unchanged.

## 3. What I left out and what comes next

I left out collision-aware navigation, persisted operator preferences, authentication, server-backed event delivery, and detailed task-event UI. Within the timebox I prioritized the required operator loop: see all robots move, understand fleet trends, find a robot that needs attention, and inspect enough context to act.

Next I would first add route-aware simulation based on the layout obstacles because it improves the credibility of the live mode. Then I would add task-event markers and component interaction tests. For production use I would introduce a WebSocket source adapter, reconnect/backoff handling, server sequence numbers, and telemetry for stale or malformed feeds.
