# Magic Flux — Phase Plan

Each phase defines what gets built, who builds it, what "done" means, and a concrete test scenario that proves it works.

---

## Phase 1: Foundation — Game State, Turns, Priority, Mana

**Goal:** A game engine that can create a game, advance through all phases and steps, pass priority between players, manage mana pools, and check state-based actions. No cards, no combat, no stack resolution — just the skeleton.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/types/` | All foundational types: GameState, Player, Zone, ManaPool, ManaCost, ManaColor, Phase, Step, TurnState, ZoneType, PlayerAction (passPriority + playLand only), ActionResult, EngineError, GameEvent (phaseChanged, turnBegan, lifeChanged, manaAdded). |
| `packages/engine/` | `createGame` — create a game with N players, empty decklists (just basic lands for testing), shuffled libraries, drawn hands. Turn structure — advance through all phases and steps in correct order. Priority system — grant priority, track consecutive passes, advance when all pass. Mana pool — add mana, empty at phase transitions. State-based actions — 0 life loss, empty library draw loss. `getLegalActions` — returns passPriority and playLand when applicable. `executeAction` — handles passPriority and playLand. Zone management — create zones, move cards between zones. |

### Active Workers
- **Project Planner:** Implements `packages/types/`
- **Rules Engine:** Implements `packages/engine/`

### Dependencies
None — this is the first phase.

### Acceptance Criteria
1. `createGame` produces a valid GameState with correct player setup (life totals, empty mana pools, shuffled libraries, 7-card hands).
2. Calling `executeAction` with `passPriority` from all players in turn order advances through phases: Untap → Upkeep → Draw → Main 1 → Beginning of Combat → Declare Attackers → Declare Blockers → Combat Damage → End of Combat → Main 2 → End Step → Cleanup → next turn's Untap.
3. Active player drawing a card during Draw step works correctly (library shrinks by 1, hand grows by 1).
4. Player can play a basic land during Main Phase (stack empty), land moves to battlefield, `landsPlayedThisTurn` increments, cannot play a second land.
5. Tapping a land for mana adds the correct color to the player's mana pool.
6. Mana pool empties at each phase/step transition.
7. State-based action: setting a player's life to 0 causes them to lose on the next SBA check.
8. All of the above is covered by passing unit tests.

### Test Scenario
> Two players start a game with decks of 60 basic Plains. They take turns doing nothing but passing priority. The game correctly advances through every phase and step of turn 1, then turn 2. On turn 2, the active player plays a Plains from hand, taps it for W, and their mana pool shows 1 white mana. The mana empties when they pass to the next phase. Priority passes correctly between the two players at every priority window.

---

## Phase 2: Stack, Spells, and Card Data

**Goal:** Players can cast spells, spells go on the stack, resolve, and produce effects. Card data is loaded from Scryfall. The targeting system works.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/types/` | StackItem, SpellAbility, Effect (core variants: dealDamage, destroy, drawCards, gainLife, loseLife, addMana, bounce, createToken), TargetRequirement, ResolvedTarget, ActivationCost, ManaPaymentPlan, CastingChoices. Extend PlayerAction with castSpell and activateAbility. Extend GameEvent with spellCast, abilityActivated, stackItemResolved, stackItemCountered. |
| `packages/engine/` | Stack implementation: push items, resolve top (LIFO), fizzle when all targets illegal. Effect resolution: dispatch to handlers per effect type. `executeAction` handles castSpell — validate timing, pay costs, add to stack. `executeAction` handles activateAbility. Targeting: validate targets on cast and on resolution. Mana payment: full implementation of `payManaCost` including mana abilities. `getLegalActions` returns castable spells and activatable abilities. |
| `packages/cards/` | Scryfall bulk data pipeline: download Oracle Cards JSON, parse into CardData, cache locally. `getCardData`, `getCardDataByName`, `searchCards`. Cost parser: mana cost strings → ManaCost objects. `instantiateCard` (basic version — keywords and oracle parsing come later). Manual implementation of ~10 test cards: Lightning Bolt, Giant Growth, Shock, Healing Salve, Ancestral Recall, Dark Ritual, Counterspell, Doom Blade, Naturalize, Divination. |

### Active Workers
- **Project Planner:** Extends `packages/types/`
- **Rules Engine:** Stack, resolution, targeting, mana payment
- **Card System:** Scryfall pipeline, cost parser, first card implementations

### Dependencies
- Phase 1 complete (game state, turns, priority, mana pools).

### Acceptance Criteria
1. `loadCardDatabase` downloads and caches Scryfall data. `getCardData` returns valid CardData for known cards.
2. A player can cast Lightning Bolt from hand by paying {R}. It goes on the stack with a target (opponent). If the opponent passes priority, it resolves and deals 3 damage (opponent life 20 → 17).
3. A player can cast Counterspell targeting a spell on the stack. When it resolves, the target spell is removed from the stack and goes to its owner's graveyard.
4. If a spell's only target becomes illegal before resolution (e.g., the target creature leaves the battlefield), the spell fizzles and goes to graveyard without resolving.
5. Mana payment correctly handles: basic costs ({R}, {1}{R}), generic mana (any color pays generic), and auto-tapping mana abilities.
6. Giant Growth resolves and modifies target creature's power/toughness until end of turn.
7. Dark Ritual resolves and adds {B}{B}{B} to the caster's mana pool.
8. All test cards have behavioral tests that pass.

### Test Scenario
> Player A has a Mountain on the battlefield and Lightning Bolt in hand. Player A taps Mountain for {R}, casts Lightning Bolt targeting Player B. Lightning Bolt goes on the stack. Player B (holding Counterspell and two Islands) declines to counter. Lightning Bolt resolves, deals 3 to Player B (life: 17). Player B then draws a creature next turn, plays it, and Player A casts Shock (paying {R}) targeting the creature. The creature takes 2 damage.

---

## Phase 3: Creatures and Combat

**Goal:** Creatures can be cast, enter the battlefield, attack, block, and deal combat damage. Triggered and activated abilities work. Basic keywords function.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/types/` | CombatState, AttackerInfo, BlockerInfo, DamageAssignment. Extend PlayerAction with declareAttackers, declareBlockers, assignDamageOrder, assignCombatDamage. Extend GameEvent with attackersDeclared, blockersDeclared, combatDamageDealt, cardTapped, cardUntapped, cardDestroyed, tokenCreated, counterAdded, counterRemoved. ContinuousEffect, layer fields. |
| `packages/engine/` | Creature entering the battlefield (summoning sickness tracking). Full combat system: declare attackers (tap, vigilance exception), declare blockers (menace check), damage assignment order, first strike / double strike damage, regular combat damage, trample, deathtouch + trample interaction, lifelink. Triggered ability system: event matching, trigger queuing, APNAP ordering (default order for now). Activated ability execution (non-mana). Continuous effects and the layer system (at least layers 6 and 7 — ability granting and P/T modification). |
| `packages/cards/` | Keyword registry with initial 20 keywords: Flying, Trample, Deathtouch, Lifelink, Vigilance, Haste, First Strike, Double Strike, Reach, Hexproof, Indestructible, Menace, Flash, Defender, Ward, Prowess, Equip, First implementation of oracle text parser (handle "When [this] enters the battlefield, [simple effect]" and "[Cost]: [simple effect]" patterns). Implement 30+ creature cards, plus basic enchantments and artifacts (Grizzly Bears, Serra Angel, Llanowar Elves, Goblin Guide, Lightning Greaves, Oblivion Ring, etc.). |

### Active Workers
- **Project Planner:** Extends `packages/types/`
- **Rules Engine:** Combat, triggers, continuous effects, layers
- **Card System:** Keywords, oracle parser v1, card implementations

### Dependencies
- Phase 2 complete (stack, spells, card data).

### Acceptance Criteria
1. A creature can be cast, enters the battlefield, has summoning sickness, and can attack next turn.
2. Full combat round: active player declares attackers → defending player declares blockers → combat damage is dealt → creatures with lethal damage die (SBA).
3. Unblocked attacker deals damage to defending player.
4. Blocked attacker deals damage to blockers in assignment order; blockers deal damage back.
5. First strike creatures deal damage first; if the blocker dies to first strike, it doesn't deal regular damage.
6. Double strike works (damage in both first strike and regular steps).
7. Trample: excess damage carries through to defending player.
8. Deathtouch: 1 damage is lethal. Deathtouch + trample: assign 1 to each blocker, rest tramples.
9. Lifelink: controller gains life equal to damage dealt.
10. Vigilance: creature doesn't tap when attacking.
11. Flying: can only be blocked by creatures with flying or reach.
12. Menace: must be blocked by 2+ creatures or not at all.
13. Hexproof: can't be targeted by opponents' spells/abilities.
14. Haste: no summoning sickness.
15. A creature with "When this enters the battlefield, deal 2 damage to target creature" triggers correctly.
16. An activated ability like "{T}: Add {G}" (Llanowar Elves) produces mana correctly.
17. Equipment (Equip cost, attach to creature, stat modification) works.
18. All keywords and cards have tests.

### Test Scenario
> Player A controls a Serra Angel (4/4 flying vigilance) and Llanowar Elves (1/1, tap for {G}). Player B controls a Grizzly Bears (2/2). Player A attacks with Serra Angel. Player B cannot block (no flying/reach). Serra Angel deals 4 damage to Player B (life: 16). Serra Angel does NOT tap (vigilance). Next turn, Player B casts Giant Spider (2/4 reach). Player A attacks with Serra Angel. Player B blocks with Giant Spider. Serra Angel deals 4 damage to Giant Spider, Giant Spider deals 2 damage to Serra Angel. Giant Spider dies (4 damage >= 4 toughness). Serra Angel survives (2 damage < 4 toughness).

---

## Phase 4: UI Shell and Client-Server Integration

**Goal:** Two players can play a game through a web browser. The UI shows the battlefield, hand, stack, and game log. Players interact by clicking.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/types/` | ClientGameState type. WebSocket message types (all messages from api-contracts.md). |
| `packages/client/` | React app shell. Battlefield rendering (per-player zones, cards displayed with Scryfall images, tapped rotation, counters). Hand display (fan layout, hover zoom). Stack visualization. Player panel (life, mana pool, phase indicator, priority indicator). Click-to-cast interaction (click card in hand → show targets → confirm). Click-to-target (highlight legal targets, click to select). Pass priority button + spacebar shortcut. Game log display. Zustand store for client state. WebSocket connection to server. Mock state mode for development without server. |
| `packages/server/` | WebSocket server (ws or Socket.IO). Game session management (create game, join game, start game). Player action routing (receive WebSocket message → validate → call engine → broadcast results). State filtering (GameState → ClientGameState per player). Lobby (create game, list games, join). Basic game loop implementation (the SBA/trigger/priority loop from api-contracts.md). |

### Active Workers
- **Project Planner:** Extends `packages/types/`
- **UI/Renderer:** Full client implementation
- **Game Coordinator:** Full server implementation
- **Rules Engine:** Bug fixes from integration testing
- **Card System:** Bug fixes from integration testing

### Dependencies
- Phase 3 complete (creatures, combat, triggers, keywords).

### Acceptance Criteria
1. Server starts and accepts WebSocket connections.
2. Two browser tabs can connect, create a game, and start it.
3. Each player sees their own hand but not the opponent's cards.
4. The battlefield shows both players' permanents with Scryfall card images.
5. A player can cast a creature from hand by clicking it, see it go on the stack, and after resolution see it on the battlefield.
6. Combat works through the UI: click to select attackers, opponent clicks to select blockers, damage resolves and creatures die visually.
7. The game log shows all actions in human-readable text.
8. Phase indicator shows the current phase/step accurately.
9. Priority indicator shows whose turn it is to act.
10. Mana pool display updates when mana is added/spent.
11. Stack display shows pending spells/abilities with card art and description.
12. Players can import a deck by pasting Moxfield/MTGA-format text into the lobby. Unresolved card names are flagged. Format legality is validated before game start.

### Test Scenario
> Open two browser tabs. Both connect to the server. Player A creates a Standard game and pastes a decklist exported from Moxfield into the deck import field. The server validates it (correct card count, all cards Standard-legal) and confirms. Player B joins and imports their deck the same way. The game starts. Player A sees 7 cards in hand and their library. Player A plays a Mountain, taps it, casts a Goblin Guide, and ends turn (passing through all phases). Player B sees the Goblin Guide appear on Player A's battlefield. Player B draws, plays a Plains, casts a Soldier token generator. Both players can see each other's battlefield permanents. Player A attacks with Goblin Guide — the UI shows it tapped and an attack arrow. Player B has no creatures and takes 2 damage (life display updates to 18).

---

## Phase 5: Playable Standard Game

**Goal:** A full game of Standard can be played with correct rules. 200+ cards implemented. Replacement effects and the full layer system work. Basic AI opponent available.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/engine/` | Replacement effects (e.g., "If a creature would die, exile it instead"). Full layer system (all 7 layers + sublayers). Triggered ability ordering prompts (APNAP with player choice). "Until end of turn" and "until your next turn" duration tracking. Simultaneous damage (multiple blockers). Copy effects. X spell handling (chosen on cast, remembered on resolution). Kicker, flashback, and other alternative/additional cost mechanics. Mulligan system (London mulligan). |
| `packages/cards/` | Oracle text parser v2 — handle 50%+ of card templates. Keyword implementation expansion (all evergreen + deciduous keywords from the project prompt). 200+ Standard-legal cards fully implemented and tested. Card override implementations for complex Standard staples. |
| `packages/client/` | Drag-to-attack/block interaction. Right-click context menu for abilities. Card hover zoom with full card text. Auto-yield / F6-style "pass until end of turn". Phase stop configuration. Undo for in-progress actions. Game over screen. |
| `packages/server/` | AI opponent (basic: choose random legal action → improved: heuristic weighting). Reconnection handling (player disconnects and rejoins). Game timeout handling. |

### Active Workers
All four workers + Project Planner.

### Dependencies
- Phase 4 complete (UI and server working end-to-end).

### Acceptance Criteria
1. A full game of Standard plays to completion with correct rules at every step.
2. 200+ Standard-legal cards each have at least one behavioral test.
3. Replacement effects work (e.g., Rest in Peace exiles instead of going to graveyard).
4. The layer system correctly resolves conflicting continuous effects.
5. Players can mulligan at game start.
6. A player can play against a basic AI opponent.
7. Kicker works (optional additional cost, enhanced effect if paid).
8. Flashback works (cast from graveyard, exile on resolution).
9. X spells work (choose X, pay {X}{R}{R}, deal X damage).
10. No game-crashing bugs in 10 consecutive playtested games.

### Test Scenario
> Two players play a 10-turn game of Standard. Player A plays a red/white aggro deck with Goblin Guide, Lightning Bolt, and Boros Charm. Player B plays a blue/black control deck with Counterspell, Doom Blade, and Divination. Turn sequences include: casting creatures, countering spells, combat with first strike and lifelink creatures, a kicked Burst Lightning dealing 4, and a Torrential Gearhulk casting a spell from graveyard. The game ends when Player B's life reaches 0. All rules interactions resolve correctly.

---

## Phase 6: Format Expansion

**Goal:** Commander/EDH and Modern formats. Multiplayer games (3-6 players). Deck builder.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/engine/` | Commander rules: command zone, commander tax ({2} per previous cast), commander damage tracking (21+ from single commander = loss), color identity enforcement. Multiplayer priority passing (APNAP for N players). Player elimination in multiplayer (removed from turn order, their permanents leave, triggered abilities fire). |
| `packages/cards/` | Modern card pool expansion (500+ cards). Commander staples (Sol Ring, Command Tower, popular commanders). |
| `packages/client/` | Multiplayer battlefield layout (3-6 player zones). Deck builder UI: card search, deck list editor, format legality validation, mana curve display, color distribution. Commander-specific UI: command zone display, commander tax indicator, commander damage tracker per opponent. |
| `packages/server/` | Multiplayer game sessions (3-6 players). Modern format with banlist. Commander format configuration. Deck validation per format. |

### Active Workers
All four workers + Project Planner.

### Dependencies
- Phase 5 complete (Standard fully playable with 200+ cards).

### Acceptance Criteria
1. A 4-player Commander game plays to completion with correct rules.
2. Commander tax is tracked and enforced correctly.
3. Commander damage from a single commander reaching 21 eliminates a player.
4. Color identity enforcement prevents illegal cards in Commander decks.
5. Modern banlist is enforced.
6. Deck builder allows creating and saving decks for all three formats.
7. Multiplayer priority passing works correctly (APNAP order).
8. Player elimination correctly handles all their permanents and triggers.

### Test Scenario
> Four players start a Commander game. Each has a different commander and a 100-card singleton deck. Player A casts their commander, it gets destroyed, they recast it for {2} more (commander tax). Player B attacks Player C with their commander dealing 7 damage (commander damage tracked). Over several turns, Player C accumulates 21 commander damage from Player B's commander and loses. Player C's permanents leave the game. The remaining three players continue. The game ends when one player remains.

---

## Phase 7: Polish and Scale

**Goal:** 5,000+ cards, matchmaking, audio/visual polish, performance optimization, mobile support.

### What Gets Built

| Package | Work |
|---------|------|
| `packages/cards/` | Oracle parser v3 — target 80%+ automated card coverage. Card override sprint for complex cards. 5,000+ cards total. |
| `packages/client/` | Sound effects (card play, damage, life change, phase transitions). Animations (card movement, damage effects, spell resolution). Mobile-responsive layout. Performance: virtualized card lists, lazy image loading, WebGL optimization for large boards. |
| `packages/server/` | Matchmaking / lobby system with Elo or similar rating. Game history persistence (SQLite). Spectator mode. Performance: handle 100+ concurrent games. |
| `packages/engine/` | Performance optimization for large board states (100+ permanents). Caching for `getLegalActions`. |

### Active Workers
All four workers + Project Planner.

### Dependencies
- Phase 6 complete (all formats, multiplayer, deck builder).

### Acceptance Criteria
1. 5,000+ cards implemented with behavioral tests.
2. Matchmaking pairs players of similar skill.
3. Game history is stored and can be replayed.
4. Sound and animation play for key game events.
5. The UI is usable on a tablet-sized screen.
6. A game with 100+ permanents on the battlefield runs at 30+ FPS.
7. Server handles 100 concurrent games without degradation.

### Test Scenario
> A new player connects, goes through a deck builder to create a Standard deck (format legality validated), queues for matchmaking, gets paired, plays a full game with sound and animation, and reviews the game in match history afterward. A Commander game with 6 players and 200+ permanents total on the battlefield runs smoothly.
