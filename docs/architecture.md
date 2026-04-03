# Magic Flux — Architecture

## Project Overview

Magic Flux is a digital Magic: The Gathering platform that prioritizes **rules correctness over card count**. The system implements the MTG Comprehensive Rules as a pure TypeScript engine, serves games over WebSocket, and renders an Arena-quality UI in the browser.

The project uses a **plan-agent architecture** for parallel development: a Project Planner agent owns shared contracts (`docs/`, `packages/types/`), and four worker sessions each own one package. Workers build against contracts, not against each other's implementations.

### Goals (Priority Order)
1. Correct implementation of MTG Comprehensive Rules
2. Clean module boundaries enabling parallel development
3. Extensible card behavior system (keyword → oracle parse → manual override)
4. Playable multiplayer experience with real-time state sync
5. Arena-quality visual experience

---

## Directory Structure

```
magic-flux/
├── CLAUDE.md                          # Session instructions (Project Planner owns)
├── docs/                              # Contract files (Project Planner owns)
│   ├── architecture.md                # This file
│   ├── types-design.md                # Shared type descriptions
│   ├── api-contracts.md               # Module boundary signatures
│   ├── phase-plan.md                  # Implementation roadmap
│   ├── decisions.md                   # Architectural decision log
│   └── progress.md                    # Task tracking
├── packages/
│   ├── types/                         # [Project Planner] Shared TypeScript types
│   │   └── src/
│   │       ├── card.ts                # Card, CardData, CardInstance
│   │       ├── game-state.ts          # GameState, ActionResult
│   │       ├── mana.ts                # ManaColor, ManaCost, ManaPool
│   │       ├── zones.ts               # Zone, ZoneType
│   │       ├── player.ts              # Player
│   │       ├── abilities.ts           # SpellAbility, Effect, TargetRequirement
│   │       ├── events.ts              # GameEvent variants
│   │       ├── turn.ts                # Phase, Step, TurnState
│   │       ├── stack.ts               # StackItem
│   │       ├── actions.ts             # PlayerAction variants
│   │       └── index.ts               # Public API (re-exports all types)
│   ├── engine/                        # [Rules Engine worker] Pure game logic
│   │   ├── src/
│   │   │   ├── game.ts                # createGame, getGameStatus
│   │   │   ├── actions.ts             # executeAction, getLegalActions
│   │   │   ├── turn/
│   │   │   │   ├── phases.ts          # Phase/step advancement logic
│   │   │   │   └── priority.ts        # Priority granting and passing
│   │   │   ├── stack/
│   │   │   │   ├── stack.ts           # Push, resolve, fizzle
│   │   │   │   └── resolution.ts      # Effect resolution dispatch
│   │   │   ├── combat/
│   │   │   │   ├── attackers.ts       # Declare attackers logic
│   │   │   │   ├── blockers.ts        # Declare blockers logic
│   │   │   │   └── damage.ts          # Damage assignment and dealing
│   │   │   ├── mana/
│   │   │   │   ├── pool.ts            # ManaPool operations
│   │   │   │   └── payment.ts         # Cost calculation and payment
│   │   │   ├── state-based/
│   │   │   │   └── sba.ts             # All state-based action checks
│   │   │   ├── zones/
│   │   │   │   └── transfers.ts       # Zone transfer logic + event emission
│   │   │   ├── triggers/
│   │   │   │   └── triggers.ts        # Trigger checking and ordering
│   │   │   └── index.ts               # Public API
│   │   └── tests/
│   ├── cards/                         # [Card System worker] Card data & behaviors
│   │   ├── src/
│   │   │   ├── scryfall/
│   │   │   │   ├── client.ts          # Scryfall API client
│   │   │   │   ├── bulk-loader.ts     # Bulk data download and cache
│   │   │   │   └── types.ts           # Raw Scryfall response types
│   │   │   ├── parser/
│   │   │   │   ├── oracle-parser.ts   # Oracle text → structured abilities
│   │   │   │   ├── cost-parser.ts     # Mana cost string → ManaCost
│   │   │   │   └── decklist-parser.ts # Plain text decklist → Decklist
│   │   │   ├── keywords/
│   │   │   │   ├── registry.ts        # Keyword name → behavior mapping
│   │   │   │   └── behaviors/         # One file per keyword group
│   │   │   ├── overrides/             # Manual card implementations
│   │   │   │   └── [card-name].ts     # One file per override card
│   │   │   ├── registry/
│   │   │   │   └── card-registry.ts   # Card lookup, search, instantiation
│   │   │   └── index.ts               # Public API
│   │   └── tests/
│   ├── client/                        # [UI/Renderer worker] React frontend
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── Battlefield.tsx
│   │   │   │   ├── Hand.tsx
│   │   │   │   ├── StackDisplay.tsx
│   │   │   │   ├── PlayerPanel.tsx
│   │   │   │   ├── CardView.tsx
│   │   │   │   ├── GameLog.tsx
│   │   │   │   ├── PhaseIndicator.tsx
│   │   │   │   └── ManaPoolDisplay.tsx
│   │   │   ├── rendering/
│   │   │   │   ├── canvas.ts          # Canvas/WebGL battlefield renderer
│   │   │   │   └── card-images.ts     # Scryfall image loading + cache
│   │   │   ├── state/
│   │   │   │   ├── game-store.ts      # Zustand store for client game state
│   │   │   │   └── websocket.ts       # WebSocket connection management
│   │   │   ├── interaction/
│   │   │   │   ├── targeting.ts       # Click-to-target flow
│   │   │   │   ├── combat-ui.ts       # Drag-to-attack/block
│   │   │   │   └── actions.ts         # Action dispatch to server
│   │   │   └── mocks/
│   │   │       └── mock-state.ts      # Mock game states for UI dev
│   │   ├── public/
│   │   └── tests/
│   └── server/                        # [Game Coordinator worker] Runtime coordinator
│       ├── src/
│       │   ├── game-session/
│       │   │   ├── session.ts         # Single game lifecycle
│       │   │   └── state-filter.ts    # GameState → ClientGameState per player
│       │   ├── websocket/
│       │   │   ├── server.ts          # WebSocket server setup
│       │   │   ├── handlers.ts        # Message routing
│       │   │   └── protocol.ts        # Message type definitions
│       │   ├── lobby/
│       │   │   ├── lobby.ts           # Game creation, matchmaking
│       │   │   └── formats.ts         # Format rules (Standard, Modern, Commander)
│       │   ├── ai/
│       │   │   └── basic-ai.ts        # AI opponent (random legal plays → heuristic)
│       │   └── index.ts               # Server entry point
│       └── tests/
├── data/                              # Cached Scryfall bulk data (gitignored)
├── package.json                       # Monorepo root (npm workspaces)
├── tsconfig.json                      # Root TypeScript config
└── vitest.workspace.ts                # Vitest workspace config
```

---

## Package Boundaries

### `packages/types/` — Shared Type Definitions

**Owner:** Project Planner agent

**Exports:** All shared interfaces, types, enums, and constants used across packages.

**Imports:** Nothing. This is a leaf dependency with zero runtime code.

**Rules:**
- Contains only TypeScript type definitions, interfaces, enums, and compile-time constants
- No runtime code, no functions, no classes
- No dependencies on any other package
- All other packages import from here

### `packages/engine/` — Rules Engine

**Owner:** Rules Engine worker

**Exports:** Pure functions for game state management — creating games, executing actions, querying legal actions, checking state-based actions, processing triggers, running combat.

**Imports:**
- `packages/types/` — all shared types

**Must never import:**
- `packages/cards/` — the engine does not know about Scryfall or card data. It operates on CardInstances that are already populated with abilities.
- `packages/client/` — no UI dependencies
- `packages/server/` — the engine is a library, not a consumer of the server

**Runtime role:** A pure library. The server imports engine functions and calls them. The engine never initiates anything — it only responds to function calls.

**Key constraint:** Every exported function must be pure. Given the same inputs, it must produce the same outputs. No randomness (shuffling uses a seeded RNG passed in via GameState), no I/O, no global state.

### `packages/cards/` — Card System

**Owner:** Card System worker

**Exports:** Functions for loading card data from Scryfall, looking up cards, parsing oracle text into structured abilities, registering keyword behaviors, and instantiating card instances for use in a game.

**Imports:**
- `packages/types/` — all shared types
- `packages/engine/` — **event type constants and ability interface definitions only**. The cards package needs to know what event types exist (to define triggers) and what ability shapes the engine expects (to produce valid SpellAbility objects). It must not import engine game-loop functions.

**Must never import:**
- `packages/client/` — no UI dependencies
- `packages/server/` — no network dependencies

**Runtime role:** A data/behavior library. The server and engine use it to resolve card data into game-ready instances. The Scryfall pipeline runs at startup or on a refresh schedule, not during gameplay.

### `packages/client/` — UI/Renderer

**Owner:** UI/Renderer worker

**Exports:** A React application (entry point for the browser).

**Imports:**
- `packages/types/` — shared types (specifically `ClientGameState` and related view types)

**Must never import:**
- `packages/engine/` — the client does not run game logic
- `packages/cards/` — the client does not access card data directly; it receives card info as part of ClientGameState
- `packages/server/` — the client communicates with the server only via WebSocket messages

**Runtime role:** Renders game state received over WebSocket, captures player interactions, sends actions back to the server. The client is an untrusted renderer — it never decides what's legal; it displays what the server tells it.

### `packages/server/` — Game Coordinator

**Owner:** Game Coordinator worker

**Exports:** A Node.js server entry point.

**Imports:**
- `packages/types/` — all shared types
- `packages/engine/` — game logic functions
- `packages/cards/` — card data loading and instantiation

**Must never import:**
- `packages/client/` — the server serves the client's built assets statically but does not import its code

**Runtime role:** The integration point. Creates game sessions, loads card data, connects players via WebSocket, drives the engine game loop (action → engine → state + events → broadcast), filters state per player, manages lobby/matchmaking.

---

## Import Rule Summary

```
types ← engine ← server
types ← cards  ← server
types ← client
cards → engine (event/ability types only, not game-loop functions)
```

No circular dependencies. `types` is always a leaf. `server` is always a root. `engine` and `cards` are mid-tier libraries. `client` is isolated — it talks to `server` only over the network.

---

## Runtime Communication

### Engine ↔ Server (function calls, same process)

The server imports engine functions and calls them synchronously. The typical game loop:

```
1. Server receives player action via WebSocket
2. Server calls engine.executeAction(currentState, action)
3. Engine returns { state, events } or error
4. Server calls engine.checkTriggeredAbilities(state, events) → new stack items
5. Server adds triggered abilities to stack
6. Server calls engine.checkStateBasedActions(state) → repeat until stable
7. Server determines who has priority next
8. Server filters state per player, broadcasts via WebSocket
9. Wait for next player action
```

The engine is passive. The server drives the loop.

### Server ↔ Client (WebSocket, JSON messages)

All communication uses a typed message protocol (defined in `docs/api-contracts.md`). Messages are JSON-serialized. The server sends filtered game state — clients never see hidden information.

**Server → Client:**
- Full/partial state updates
- Prompts (choose targets, assign damage, make choices)
- Legal action lists
- Game events (for log and animations)
- Game over notification

**Client → Server:**
- Player actions (cast spell, activate ability, play land, pass priority)
- Prompt responses (selected targets, damage assignment, choices)
- Lobby actions (create game, join, leave)

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `game-state.ts`, `oracle-parser.ts` |
| Directories | kebab-case | `state-based/`, `game-session/` |
| Interfaces/Types | PascalCase | `GameState`, `ManaCost`, `CardInstance` |
| Functions | camelCase | `createGame`, `getLegalActions` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_HAND_SIZE`, `STARTING_LIFE` |
| Enums | PascalCase name + PascalCase values | `Phase.MainPhaseOne`, `ZoneType.Battlefield` |
| Type discriminants | camelCase string literals | `{ type: "dealDamage" }`, `{ type: "cardEnteredZone" }` |
| Test files | `[module-name].test.ts` | `priority.test.ts`, `sba.test.ts` |
| Override card files | kebab-case card name | `chains-of-mephistopheles.ts` |

---

## Error Handling

### Engine Errors

Two categories:

1. **Invalid player actions** — A player tries to do something illegal (cast a spell they can't afford, target an invalid permanent). These are expected at runtime because the UI may allow submitting actions that become illegal between selection and execution. The engine returns an `ActionResult` with `success: false` and an `EngineError` describing what went wrong. The server relays this to the client.

2. **Internal engine bugs** — A state that should be unreachable (e.g., resolving a stack item that doesn't exist, a zone transfer for a card not in the source zone). These throw exceptions. The server catches them, logs the full error, and can attempt recovery (reload last known good state) or abort the game.

### Server Errors

- WebSocket disconnection: server holds the game state. Reconnection resumes from current state. If a player is disconnected during a priority window, a configurable timeout applies before auto-passing or auto-conceding.
- Card data loading failure: server starts without card data and retries. Games cannot start until card data is loaded.

### Client Errors

- Rendering errors: caught by React error boundaries. Display fallback UI.
- WebSocket errors: auto-reconnect with exponential backoff. Display connection status to the player.

---

## Logging

| Package | Logging Approach |
|---------|-----------------|
| `packages/types/` | None (no runtime code) |
| `packages/engine/` | **None.** The engine is a pure library. It communicates through return values, not logs. The server logs engine inputs/outputs as needed. |
| `packages/cards/` | Minimal — log Scryfall data loading progress and parse failures. Use `console.warn` for cards that fail to parse (with card name and oracle text). |
| `packages/client/` | `console.debug` for development. Stripped or silenced in production builds. |
| `packages/server/` | Structured JSON logging. Every log entry includes `{ gameId, action, playerId, timestamp }`. Log levels: `info` for game events, `warn` for recoverable issues, `error` for failures. |

---

## Randomness

The engine must be deterministic given the same seed. All randomness (shuffling, coin flips, random discard) uses a **seeded pseudo-random number generator** stored in `GameState.rngState`. This enables:

- Deterministic replay (same seed + same actions = same game)
- Reproducible test scenarios
- Server-authoritative randomness (clients cannot manipulate RNG)

The server generates the initial seed when creating a game. The engine advances the RNG state as part of the returned GameState.

---

## Testing Standards

### General
- **Framework:** Vitest
- **Location:** `tests/` directory within each package
- **Naming:** `[module-name].test.ts`
- **Style:** `describe`/`it`/`expect` blocks. Descriptive test names.

### Engine Tests
- Set up a GameState (use helper functions, not raw construction)
- Execute an action or function
- Assert on the output GameState and/or events
- Test both success and failure paths

### Card Behavior Tests
- One test file per card (or per card group for simple vanilla/French-vanilla creatures)
- Each test creates a game scenario, puts the card in the relevant zone, and exercises its abilities
- Assert on game state changes: life totals, zone contents, counters, etc.
- Test edge cases: fizzle, illegal targets on resolution, interaction with other keywords

### Integration Tests
- Located in `packages/server/tests/`
- Test the full loop: create game → player action → engine processing → state broadcast
- Use mock WebSocket clients

### Coverage
- Target 80%+ line coverage for engine and cards
- No hard coverage gate initially, but coverage must not decrease as features are added
