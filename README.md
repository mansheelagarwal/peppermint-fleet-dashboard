# Peppermint Fleet Operations

An operator-focused fleet dashboard for replaying fifteen minutes of recorded telemetry and switching to a continuously generated live feed. Both sources pass through the same normalized fleet-state model, so the map, roster, metrics, trend, filters, and robot inspector stay consistent.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal. To verify the submission:

```bash
npm test
npm run build
```

## What is included

- Site map with all eight robots and smooth position updates
- Recorded replay with pause, seek, restart-by-seeking, and 1x-32x speed control
- Browser-generated live telemetry every 650 ms
- Fleet-wide working and attention trends
- Robot search, attention/type filters, and map highlighting
- Robot inspector with status, battery, location, freshness, and operator guidance
- Responsive layout, keyboard-accessible controls, and reduced-motion support
- Pure state and metric functions with focused unit tests

## Design decisions

`app/lib/fleet.ts` owns domain types and pure transformations. `FleetState` is a record keyed by `robot_id`, which makes each update explicit and gives every view one current-state source. `app/components/FleetDashboard.tsx` owns source selection and timing. Recorded and generated events both end at the same `FleetState`: replay reconstructs a snapshot with `fleetAtTime`, while live mode sends generated events through `ingestEvents`.

The live source is deliberately browser-side. That keeps the deployed submission fully functional without a second service while still generating new, plausible events rather than replaying the file. The generator uses gradual movement and battery change, bounds positions to the site, and includes deterministic status transitions. Its update rate is approximately 1.54 batches per second, with one event per robot in each batch.

Statuses `active` and `on_mission` count as working. `blocked`, `error`, `maintenance`, and `offline` require attention, as does any battery below 20%. These rules are visible as named sets in `app/lib/fleet.ts`, rather than being buried in UI code.

## Project map

- `app/components/FleetDashboard.tsx` - dashboard UI, replay clock, live clock, and interactions
- `app/lib/fleet.ts` - parsing, current-state reconstruction, ingestion, simulation, metrics, and trend logic
- `app/globals.css` - responsive visual system and map-marker motion
- `public/data/` - supplied layout, roster, and event log
- `tests/fleet.test.ts` - state consistency, late-event handling, and derived metric tests
- `ANSWERS.md` - implementation-specific assignment answers
- `SYSTEM_DESIGN.md` - scale, reliability, bandwidth, and failure handling

## AI delegation notes

AI assisted with the initial implementation, styling, test scaffolding, and documentation. The product decisions—choosing a frontend-only live simulator, the normalized state shape, attention definitions, and the deliberately compact architecture—were reviewed as part of the submission. All behavior is concentrated in the files listed above so it can be explained and changed during a walkthrough.

## What I would do next

With more time I would add collision-aware path generation, URL-persisted filters, richer task-event annotations, component-level interaction tests, and production telemetry. For a real robot feed I would replace only the source adapter while retaining the state and selector layer.
