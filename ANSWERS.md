# Written Answers

## 1. What holds the fleet's state as data arrives, and why that shape?

The fleet state is stored as a normalized `FleetState` object in `app/lib/fleet.ts`, keyed by each robot's `robot_id`. Every value contains the robot's latest position, battery, status, timestamp, and type. This shape makes individual updates straightforward, prevents duplicate current state records, and gives the map, metrics, roster, trend, and inspector a single consistent source of truth.

Both data sources produce this same state shape. Recorded events are reconstructed for a selected timestamp using `fleetAtTime`, while generated live events are applied using `ingestEvents`. `FleetDashboard` in `app/components/FleetDashboard.tsx` manages the current state and switches between these sources. Because the views only consume `FleetState`, they do not need to know whether the data came from replay or live simulation.

## 2. Name one real tradeoff you made, and argue for the decision. What did it cost?

I implemented the live feed in the browser using `createLiveEvents` in `app/lib/fleet.ts`, instead of building and deploying a separate streaming backend. This kept the submission self-contained and ensured the live mode would work reliably from the deployed frontend. The simulator generates genuinely new events with gradual movement, battery changes, status transitions, and bounded coordinates, and those events pass through the same `ingestEvents` function that a real data source could use.

The cost is that the simulated feed exists only inside the current browser tab. Different users do not share the same live state, refreshing loses the generated history, and the implementation does not demonstrate real WebSocket behavior such as reconnection or missed event recovery. I accepted this tradeoff because the challenge primarily evaluates the frontend state model and operator experience, while the source boundary remains simple enough to replace with a WebSocket later.

## 3. What did you leave out, and what would you build next?

I left out collision aware movement, detailed task-event visualization, persisted filters, authentication, server backed event delivery, and broader component level interaction tests. Within the available time, I prioritized the required operator workflow: displaying all robots, replaying recorded telemetry, generating new live data, showing fleet level trends, locating robots that need attention, and inspecting their current information.

Given more time, I would first make the simulator aware of obstacles in `layout.png`, so robots follow believable paths instead of only remaining within the map boundaries. Next, I would display `task_started` and `task_completed` events on the timeline and inspector, add interaction tests for replay and filtering controls, and persist operator selections in the URL. For production use, I would replace the browser timer in `FleetDashboard.tsx` with a WebSocket source that supports sequence numbers, reconnection, stale feed detection, and an initial fleet snapshot.
