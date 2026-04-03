# Magic Flux — Progress Tracker

Updated by the Project Planner agent. Workers report progress here; only the Planner edits this file.

**Current Phase: 3 — Creatures and Combat**

---

## Phase 1: Foundation

### Project Planner

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Write architecture.md | Done | — | |
| Write types-design.md | Done | — | |
| Write api-contracts.md | Done | — | |
| Write phase-plan.md | Done | — | |
| Write decisions.md | Done | — | |
| Write progress.md | Done | — | |
| Write CLAUDE.md | Done | — | |
| Implement `packages/types/` — foundational types (ManaColor, ZoneType, Phase, Step) | Done | architecture.md, types-design.md | |
| Implement `packages/types/` — GameState, Player, Zone, TurnState | Done | foundational types | |
| Implement `packages/types/` — ManaPool, ManaCost, ManaSymbol | Done | foundational types | |
| Implement `packages/types/` — PlayerAction (passPriority, playLand + all future variants stubbed) | Done | GameState types | |
| Implement `packages/types/` — ActionResult, EngineError | Done | PlayerAction | |
| Implement `packages/types/` — GameEvent (all Phase 1 events + Phase 2/3 stubs) | Done | foundational types | |
| Implement `packages/types/` — CardData, CardInstance (basic fields) | Done | foundational types | |

### Rules Engine Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Set up `packages/engine/` with Vitest, tsconfig, package.json | Done | types foundational types done | |
| Implement `createGame` — player setup, library creation, shuffle, draw hands | Done | GameState, Player, Zone types | game.ts — creates game with players, zones, shuffled libraries, drawn hands; includes getGameStatus. Seeded RNG (rng.ts) also done as part of engine setup |
| Implement zone management — create zones, move cards between zones | Done | Zone types | zones/transfers.ts |
| Implement turn structure — phase/step advancement logic | Done | Phase, Step, TurnState types | turn/phases.ts — full phase/step progression with untap, draw, cleanup |
| Implement priority system — grant, pass, track consecutive passes, advance | Done | turn structure | turn/priority.ts |
| Implement `executeAction` for passPriority | Done | priority system | actions.ts — advances phase when all pass on empty stack |
| Implement `executeAction` for playLand | Done | zone management, mana pool | actions.ts — validates timing, moves to battlefield, increments land count |
| Implement mana pool — add mana, empty at phase transitions | Done | ManaPool types | mana/pool.ts |
| Implement basic mana abilities — tap land for mana | Done | mana pool, activated abilities | actions.ts — Phase 1 basic land tap via activateAbility |
| Implement `getLegalActions` — passPriority + playLand | Done | all above | actions.ts — also includes mana abilities and concede |
| Implement state-based actions — 0 life loss, empty library draw loss | Done | GameState types | state-based/sba.ts — also poison and commander damage |
| Implement `processStateBasedActions` loop | Done | SBA checks | state-based/sba.ts — processStateBasedActionsLoop |
| Write tests for all Phase 1 engine logic | Done | all above | 35 tests across 5 test files, all passing |
| Integration test: full turn cycle with two players | Done | all above | integration.test.ts — full Phase 1 acceptance scenario |

---

## Phase 2: Stack, Spells, and Card Data

### Project Planner

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Implement `packages/types/` — StackItem, SpellAbility, Effect (core variants) | Done | Phase 1 types | Implemented during Phase 1 types setup — all variants present in stack.ts, abilities.ts |
| Implement `packages/types/` — TargetRequirement, ResolvedTarget, ActivationCost | Done | Phase 1 types | Implemented during Phase 1 types setup — all variants present in abilities.ts |
| Implement `packages/types/` — ManaPaymentPlan, CastingChoices | Done | ManaCost types | Implemented during Phase 1 types setup — ManaPaymentPlan in stack.ts, CastingChoices in card.ts |
| Extend PlayerAction with castSpell, activateAbility | Done | StackItem types | Implemented during Phase 1 types setup — CastSpellAction and ActivateAbilityAction in actions.ts |
| Extend GameEvent with spellCast, abilityActivated, stackItemResolved, stackItemCountered | Done | StackItem types | Implemented during Phase 1 types setup — all variants present in events.ts |

### Rules Engine Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Implement stack — push, resolve top (LIFO), remove | Done | StackItem types | stack/stack.ts |
| Implement effect resolution dispatch (per effect type) | Done | Effect types, stack | stack/resolution.ts — dealDamage, destroy, drawCards, gainLife, loseLife, addMana, bounce, counter, modifyPT, exile, discardCards |
| Implement `executeAction` for castSpell | Done | stack, mana payment | actions.ts — validates, moves to stack, creates StackItem, pays costs |
| Implement `executeAction` for activateAbility | Done | stack, abilities | actions.ts — extended from Phase 1 |
| Implement target validation (on cast and on resolution) | Done | TargetRequirement types | stack/targeting.ts — handles card, player, and stack item targets |
| Implement fizzle (all targets illegal) | Done | target validation | stack/targeting.ts |
| Implement `payManaCost` with mana abilities | Done | ManaPaymentPlan types | mana/payment.ts — activates mana abilities, deducts from pool |
| Implement `canPayCost` check | Done | mana system | mana/pool.ts — colored + generic cost checking |
| Extend `getLegalActions` with castSpell + activateAbility | Done | all above | actions.ts — shows castable spells in hand |
| Implement `checkTriggeredAbilities` (basic — no ordering prompts) | Done | GameEvent types | triggers/triggers.ts — event matching, APNAP default ordering |
| Write tests for stack, spells, targeting, mana payment | Done | all above | 45 engine tests total across 6 test files |

### Card System Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Set up `packages/cards/` with Vitest, tsconfig, package.json | Done | Phase 1 types | package.json, tsconfig.json, vitest.config.ts, src/index.ts |
| Implement Scryfall bulk data download | Done | — | src/scryfall/client.ts — HTTP client for bulk data metadata + download |
| Implement Scryfall data parsing into CardData | Done | CardData types | src/scryfall/transformer.ts — maps raw Scryfall fields to CardData, parses type lines and mana costs during transform. src/scryfall/types.ts — raw JSON shape |
| Implement local card database cache | Done | bulk data pipeline | src/scryfall/bulk-loader.ts — download/cache pipeline with staleness checking against Scryfall metadata |
| Implement `getCardData`, `getCardDataByName`, `searchCards` | Done | card database | src/registry/card-registry.ts — in-memory indexes (byId, byName, byOracleId) |
| Implement mana cost string parser | Done | ManaCost, ManaSymbol types | src/parser/cost-parser.ts — all 8 ManaSymbol variants ({R}, {2}, {W/U}, {2/W}, {W/P}, {C}, {S}, {X}) with CMC calculation |
| Implement type-line parser | Done | — | src/parser/type-line-parser.ts — splits type lines into supertypes, cardTypes, subtypes |
| Implement `instantiateCard` (basic — populate from CardData) | Done | CardInstance types | src/registry/card-registry.ts — basic instantiation (keywords/oracle parser/overrides still needed) |
| Implement `isLegalInFormat` | Done | card database | src/registry/card-registry.ts |
| Write technical design doc | Done | — | docs/cards-technical-design.md |
| Write tests for parsers, transformer, registry | Done | above | 58 tests across 4 test files (cost-parser, type-line-parser, transformer, card-registry) |
| Manually implement Lightning Bolt | Done | Phase 2 types + engine effect resolution | overrides/lightning-bolt.ts |
| Manually implement Counterspell | Done | Phase 2 types + engine stack interaction | overrides/counterspell.ts |
| Manually implement Giant Growth | Done | Phase 2 types + engine effect resolution | overrides/giant-growth.ts |
| Manually implement Shock | Done | Phase 2 types + engine effect resolution | overrides/shock.ts |
| Manually implement Dark Ritual | Done | Phase 2 types + engine effect resolution | overrides/dark-ritual.ts |
| Manually implement Doom Blade | Done | Phase 2 types + engine effect resolution | overrides/doom-blade.ts |
| Manually implement Healing Salve | Done | Phase 2 types + engine effect resolution | overrides/healing-salve.ts |
| Manually implement Ancestral Recall | Done | Phase 2 types + engine effect resolution | overrides/ancestral-recall.ts |
| Manually implement Naturalize | Done | Phase 2 types + engine effect resolution | overrides/naturalize.ts |
| Manually implement Divination | Done | Phase 2 types + engine effect resolution | overrides/divination.ts |
| Write tests for all 10 card implementations | Done | card implementations | 180 card tests, all passing |

---

## Phase 3: Creatures and Combat

### Project Planner

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Implement `packages/types/` — CombatState, AttackerInfo, BlockerInfo, DamageAssignment | Done | Phase 1 types | Implemented during Phase 1 types setup |
| Implement `packages/types/` — combat PlayerAction variants (declareAttackers, declareBlockers, orderBlockers, assignDamage) | Done | Phase 1 types | Implemented during Phase 1 types setup |
| Implement `packages/types/` — combat GameEvent variants (attackersDeclared, blockersDeclared, combatDamageDealt) | Done | Phase 1 types | Implemented during Phase 1 types setup |
| Implement `packages/types/` — ContinuousEffect | Done | Phase 1 types | Implemented during Phase 1 types setup |

### Rules Engine Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Implement creature entering battlefield + summoning sickness | Not Started | Phase 2 done | |
| Implement declare attackers step | Not Started | CombatState types | |
| Implement declare blockers step | Not Started | CombatState types | |
| Implement damage assignment order selection | Not Started | combat | |
| Implement first strike / double strike damage | Not Started | combat damage | |
| Implement regular combat damage | Not Started | combat damage | |
| Implement trample | Not Started | combat damage | |
| Implement deathtouch + trample interaction | Not Started | combat damage | |
| Implement lifelink | Not Started | combat damage | |
| Implement triggered ability system (event matching, queuing) | Not Started | GameEvent types | |
| Implement continuous effects + layer system (layers 6, 7) | Not Started | ContinuousEffect types | |
| Write combat tests | Not Started | all combat | |

### Card System Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Implement keyword registry | Not Started | Phase 2 done | |
| Implement 20 keywords (see Phase 3 acceptance criteria) | Not Started | keyword registry | |
| Implement oracle text parser v1 (ETB triggers, simple activated abilities) | Not Started | SpellAbility types | |
| Implement 30+ creature cards | Not Started | keywords, parser | |
| Implement basic enchantments + artifacts | Not Started | keywords, parser | |
| Write tests for all keywords and cards | Not Started | implementations | |

---

## Phase 4: UI Shell and Client-Server Integration

### UI/Renderer Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Set up `packages/client/` — React, Vite, Zustand, tsconfig | Not Started | Phase 3 done | |
| Implement battlefield rendering | Not Started | ClientGameState types | |
| Implement hand display | Not Started | ClientGameState types | |
| Implement stack visualization | Not Started | ClientGameState types | |
| Implement player panel (life, mana, phase, priority) | Not Started | ClientGameState types | |
| Implement card rendering with Scryfall images | Not Started | CardData types | |
| Implement click-to-cast interaction | Not Started | PlayerAction types | |
| Implement click-to-target interaction | Not Started | TargetRequirement types | |
| Implement pass priority button + spacebar shortcut | Not Started | UI shell | |
| Implement game log display | Not Started | GameEvent types | |
| Implement Zustand game store | Not Started | ClientGameState types | |
| Implement WebSocket connection | Not Started | server ready | |
| Implement deck import UI (paste Moxfield/MTGA text, show validation results) | Not Started | decklist parser, lobby | |
| Write UI tests (component rendering) | Not Started | all above | |

### Game Coordinator Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Set up `packages/server/` — Node.js, WebSocket, tsconfig | Not Started | Phase 3 done | |
| Implement WebSocket server | Not Started | — | |
| Implement game session lifecycle | Not Started | engine API | |
| Implement state filtering (GameState → ClientGameState) | Not Started | ClientGameState types | |
| Implement player action routing | Not Started | WebSocket + engine | |
| Implement game loop (SBA/trigger/priority cycle) | Not Started | engine API | |
| Implement lobby (create/join/list games) | Not Started | WebSocket | |
| Implement deck validation per format | Not Started | card database, decklist types | |
| Integration test: two clients play a game | Not Started | all above | |

### Card System Worker

| Task | Status | Dependencies | Notes |
|------|--------|--------------|-------|
| Implement decklist text parser (Moxfield/MTGA/Archidekt format) | Not Started | Decklist types, card database | |
| Implement `exportDecklistText` | Not Started | Decklist types | |
| Implement `validateDecklist` per format | Not Started | decklist parser, format legality | |
| Write tests for decklist parsing (various formats, edge cases, fuzzy matching) | Not Started | decklist parser | |

---

## Phase 5–7

Tasks will be detailed when earlier phases are complete. See `docs/phase-plan.md` for high-level scope.

---

## Blockers

| Blocker | Reported By | Date | Affects | Status |
|---------|-------------|------|---------|--------|
| `SpellAbilitySpell` needs a `targets` field — spells like Lightning Bolt need target requirements for engine validation. Without this, card implementations cannot define targeting. | Card System Worker | 2026-04-03 | Card implementations (all 10 manual cards), engine target validation | RESOLVED — all 10 cards implemented |
| Phase 2 types + engine effect resolution not yet available | Card System Worker | 2026-04-03 | All 10 manual card implementations, override registry | RESOLVED — engine Phase 2 complete, cards unblocked |
| `vitest.workspace.ts` listed `packages/client` and `packages/server` but those dirs don't exist yet — root-level test runs failed. Card System Worker commented them out as workaround. | Card System Worker | 2026-04-03 | Root-level `vitest` runs | WORKAROUND applied |
