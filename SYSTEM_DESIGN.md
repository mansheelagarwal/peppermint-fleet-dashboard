# System Design

## 1. Adding a feature later

The current split supports additive features when they can be derived from telemetry. For example, a low-battery dispatch queue would add a selector beside `needsAttention` in `app/lib/fleet.ts`, then a focused view in `FleetDashboard.tsx`. The replay and live sources would gain it automatically because both produce the same `FleetState`. If the feature introduced commands sent to robots, the design would need a new command service rather than hiding writes in the view: the inspector would call that service, show an optimistic pending state, and reconcile acknowledgements delivered as events.

## 2. Growing from eight robots to five hundred

The first visible bottleneck would be rendering, not keyed state updates. `FleetDashboard` currently maps the full roster and all map markers on every fleet batch. At 500 robots, marker layout, DOM updates, and a 500-row roster would create frame drops. I would virtualize the roster, move map rendering to canvas or a clustered layer, memoize selectors, and batch incoming events to a screen-friendly refresh rate such as 5-10 Hz. The `FleetState` record can remain; if update volume grows further, I would move ingestion to an external store with per-robot subscriptions so one event does not rerender the entire page.

## 3. Limited bandwidth

The current browser simulator emits full snapshots because bandwidth is not constrained. With real robots I would introduce a compact transport schema at the source adapter: short numeric field identifiers, fixed-point coordinates, enumerated status bytes, and delta updates that omit unchanged fields. Position frequency would adapt to state—faster while moving, slower while idle or charging—while errors, task transitions, and large position changes would transmit immediately. Periodic full snapshots and sequence numbers would let the backend repair gaps without keeping delta chains forever.

## 4. A robot stops responding mid-task

Silence must become an explicit state. The backend should track `last_seen` for every robot and run a watchdog that marks one stale after a configurable heartbeat threshold. That synthesized `offline` event would enter the same feed consumed by this dashboard, causing `needsAttention` in `app/lib/fleet.ts` to surface it. The task coordinator should stop assigning work, mark the active task interrupted, alert an operator, and decide whether the task can be reassigned safely. Recovery should require a fresh heartbeat and state sync rather than assuming the robot continued where it stopped.

## 5. Slow, unreliable, or out-of-order connections

Every production event should carry a robot-scoped sequence number plus its device timestamp. The ingestion boundary represented here by `ingestEvents` would accept newer sequence numbers, reject duplicates and stale events, and expose connection freshness separately from the robot's last reported operational status. During a gap, the UI should keep the last known position but progressively label it stale, then offline, instead of pretending the value is current.

Robots should buffer a bounded number of unsent events and reconnect with exponential backoff and jitter. After reconnection they can send buffered critical transitions followed by a full current-state snapshot. The backend then publishes the recovered canonical state; clients reconnecting to the WebSocket should first fetch or receive a snapshot before applying subsequent sequenced deltas.
