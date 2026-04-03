# Architectural Decisions

Decisions are appended by the Project Planner agent. Workers must not edit this file directly.

## Format
### DEC-[number]: [title]
- **Date:** [date]
- **Context:** [what prompted the decision]
- **Decision:** [what was decided]
- **Rationale:** [why]
- **Affects:** [which packages/workers]

---

### DEC-001: Immutable GameState with pure engine functions
- **Date:** 2026-04-03
- **Context:** The engine needs a clear data-flow model. Mutable shared state between engine, server, and client is a source of subtle bugs, especially with undo/replay and network serialization.
- **Decision:** All engine functions are pure: they take a GameState (and an action/input) and return a new GameState plus any emitted events. No in-place mutation of game state objects.
- **Rationale:** Immutability gives us: free undo (keep prior states), trivial replay (re-apply actions to initial state), safe serialization (no aliasing bugs), easy testing (assert on output state), and no shared-mutation bugs across module boundaries. The memory cost is acceptable — game states are small (hundreds of objects, not millions), and we can use structural sharing if needed later.
- **Affects:** packages/engine, packages/server, packages/types

### DEC-002: Functional event model, not EventEmitter
- **Date:** 2026-04-03
- **Context:** The engine must emit game events (card entered battlefield, damage dealt, etc.) for triggered abilities and for the game log. EventEmitter-style systems create implicit dependencies and make testing harder.
- **Decision:** Engine functions return `{ state, events }` tuples. Trigger checking is a separate pure function that reads events and returns new stack items. No pub/sub, no listeners, no side effects.
- **Rationale:** Keeps the engine fully deterministic and testable. The server owns the "game loop" — it calls engine functions, collects events, feeds them back for trigger processing, and broadcasts to clients. This separation makes the engine a library, not a framework.
- **Affects:** packages/engine, packages/server

### DEC-003: Card data vs card instance separation
- **Date:** 2026-04-03
- **Context:** Cards have static data (name, mana cost, oracle text from Scryfall) and dynamic game state (tapped, counters, damage, zone). These must be modeled separately.
- **Decision:** `CardData` is the immutable Scryfall-sourced definition. `CardInstance` is a game-specific object referencing a CardData ID plus all mutable game state. The cards package owns CardData; the engine creates and manages CardInstances within GameState.
- **Rationale:** Static data is shared across all games and loaded once. Instance data is per-game and changes every action. Separating them avoids duplicating 25,000 card definitions in every game state snapshot.
- **Affects:** packages/types, packages/cards, packages/engine

### DEC-004: npm workspaces for monorepo management
- **Date:** 2026-04-03
- **Context:** Need a monorepo tool that supports independent package compilation, shared dependencies, and cross-package imports.
- **Decision:** Use npm workspaces (built into npm 7+). No turborepo or nx — added complexity not justified at this scale.
- **Rationale:** npm workspaces handle dependency hoisting, cross-package linking, and per-package scripts. If build performance becomes an issue later, turborepo can be added as a drop-in layer without restructuring.
- **Affects:** All packages

### DEC-005: Vitest for all testing
- **Date:** 2026-04-03
- **Context:** Need a test runner that supports TypeScript natively, runs fast, and works well in a monorepo.
- **Decision:** Vitest for all unit and integration tests. Each package has its own test configuration.
- **Rationale:** Vitest is TypeScript-native (no separate compilation step), Jest-compatible API (low learning curve), fast (uses Vite's transform pipeline), and supports workspaces.
- **Affects:** All packages

### DEC-006: Engine exposes functions, not classes
- **Date:** 2026-04-03
- **Context:** The engine API could be a class with methods (OOP) or a set of pure functions (FP). Given DEC-001 (immutable state), the FP approach is more natural.
- **Decision:** The engine is a collection of exported pure functions. No `GameEngine` class. State is always passed in and returned, never stored internally.
- **Rationale:** Pure functions compose better, test better, and don't carry hidden state. The server can call any engine function in any order without worrying about engine-internal state. This also makes it trivial to run the engine in a Web Worker or server-side without worrying about instance lifecycle.
- **Affects:** packages/engine, packages/server

### DEC-007: Server filters game state per player before sending to clients
- **Date:** 2026-04-03
- **Context:** The full GameState contains hidden information (library order, opponents' hands). Clients must not receive this.
- **Decision:** The server creates a `ClientGameState` per player by filtering the full GameState. Library contents are replaced with count-only. Opponents' hands are replaced with card-back placeholders. Face-down exiled cards are hidden unless the viewing player controls the exiling effect.
- **Rationale:** Security-critical. If hidden info reaches the client, cheating is trivial. The server is the single source of truth; clients are untrusted renderers.
- **Affects:** packages/server, packages/client, packages/types

### DEC-008: Three-tier card behavior system
- **Date:** 2026-04-03
- **Context:** MTG has 25,000+ unique cards. Hard-coding each is impossible. A fully automated parser can't handle complex interactions. Need a hybrid approach.
- **Decision:** Three tiers in priority order: (1) Engine-level keyword handlers (from Scryfall `keywords` array), (2) Oracle text parser producing structured ability definitions, (3) Hand-written TypeScript overrides for cards that resist automation. Target: 80%+ coverage from tiers 1+2.
- **Rationale:** Mirrors Forge's proven approach (scripted DSL + Java overrides) but uses structured data instead of a custom DSL. Keywords are finite and well-defined. Oracle text follows templates. Only genuinely weird cards need manual work.
- **Affects:** packages/cards, packages/engine

### DEC-009: Plain-text deck import as primary deck input method
- **Date:** 2026-04-03
- **Context:** Players need to submit decklists to start games. Building a full visual deck builder is Phase 6 work, but games need decks starting at Phase 4. Most MTG players already have decklists in Moxfield, Archidekt, or MTGA.
- **Decision:** Support copy-paste import of the standard plain-text decklist format (`[count] [card name]` with `Sideboard`/`Commander` section headers) starting in Phase 4. This is the format Moxfield, MTGA, Archidekt, and most tools export. The parser lives in `packages/cards/` (it needs the card database for name resolution). Validation against format rules is a separate function.
- **Rationale:** Lowest-friction path to playable games. Every deckbuilding site exports this format. Avoids blocking gameplay on a full deck builder UI. Parser is straightforward (~100 lines), validation reuses existing `isLegalInFormat`.
- **Affects:** packages/cards (parser), packages/server (validation), packages/client (paste UI)
