# Magic Flux — Shared Types Design

This document describes every type that will live in `packages/types/`. These are prose specifications — the Types worker (Project Planner) will implement them as TypeScript interfaces and types.

For each type: what it represents, what fields it contains, how it relates to other types, and which worker session primarily produces or consumes it.

---

## Foundational Enums and Constants

### ManaColor

A union of the six mana types: `W` (white), `U` (blue), `B` (black), `R` (red), `G` (green), `C` (colorless).

Generic mana is **not** a color — it's a cost concept meaning "any color or colorless can pay this." Generic appears in `ManaCost` but never in `ManaPool`.

### ZoneType

Enumeration of all game zones: `Library`, `Hand`, `Battlefield`, `Graveyard`, `Exile`, `Stack`, `CommandZone`.

### Phase

Enumeration of turn phases: `Beginning`, `PreCombatMain`, `Combat`, `PostCombatMain`, `Ending`.

### Step

Enumeration of turn steps within phases:
- Beginning phase: `Untap`, `Upkeep`, `Draw`
- Combat phase: `BeginningOfCombat`, `DeclareAttackers`, `DeclareBlockers`, `FirstStrikeDamage`, `CombatDamage`, `EndOfCombat`
- Ending phase: `EndStep`, `Cleanup`

Main phases have no steps — they are a single priority window.

`FirstStrikeDamage` only exists as a step when at least one creature in combat has first strike or double strike. The engine creates this step dynamically.

### CardType

The supertypes, types, and subtypes of a card, parsed from the type line:
- **Supertypes:** `Basic`, `Legendary`, `Snow`, `World`
- **Card types:** `Creature`, `Instant`, `Sorcery`, `Enchantment`, `Artifact`, `Planeswalker`, `Land`, `Battle`, `Tribal`, `Kindred`
- **Subtypes:** Creature types (Human, Elf, Dragon...), land types (Plains, Island...), spell types (Arcane, Trap...), etc.

Stored as three separate arrays on the card: `supertypes`, `cardTypes`, `subtypes`.

---

## Card and CardData

**Primary producer:** Card System worker (from Scryfall data)
**Primary consumers:** Engine (via CardInstance), Server (for game setup), Client (for display)

### CardData

The static, immutable definition of a card as sourced from Scryfall. One `CardData` exists per unique printing, shared across all games.

**Fields:**
- `id` — Scryfall UUID. Primary key for all lookups.
- `oracleId` — Scryfall oracle ID. Groups all printings of the same card.
- `name` — Card name. For double-faced cards, the front face name. For split cards, both names joined with " // ".
- `manaCost` — Mana cost string as printed (e.g., `"{2}{W}{U}"`). Parsed into `ManaCost` at load time.
- `cmc` — Converted mana cost / mana value (number).
- `typeLine` — Full type line string (e.g., `"Legendary Creature — Human Wizard"`).
- `supertypes`, `cardTypes`, `subtypes` — Parsed from typeLine.
- `oracleText` — Rules text. For double-faced cards, front face text only (back face in `faces`).
- `power`, `toughness` — Strings, not numbers, because they can be `"*"` or `"1+*"`. Null for non-creatures.
- `loyalty` — Starting loyalty for planeswalkers. Null otherwise.
- `defense` — Starting defense for battles. Null otherwise.
- `colors` — Array of ManaColor. The card's colors (not color identity).
- `colorIdentity` — Array of ManaColor. Includes mana symbols in rules text. Used for Commander.
- `keywords` — Array of keyword strings from Scryfall (e.g., `["Flying", "Vigilance"]`).
- `layout` — Card layout: `"normal"`, `"transform"`, `"modal_dfc"`, `"split"`, `"adventure"`, `"flip"`, `"meld"`, `"saga"`, etc.
- `faces` — Array of face objects for multi-faced cards. Each face has its own name, manaCost, typeLine, oracleText, power, toughness, etc. For single-faced cards, this is null or a single-element array.
- `imageUris` — Map of image size to URL (e.g., `{ small: "...", normal: "...", large: "..." }`). For multi-faced cards, each face has its own imageUris.
- `legalities` — Map of format name to legality (`"legal"`, `"not_legal"`, `"banned"`, `"restricted"`).
- `isToken` — False for real cards. Tokens have separate CardData entries in Scryfall.
- `producedMana` — Array of ManaColor that this card can produce (from Scryfall). Used for UI hints, not for rules.

### Multi-Faced Cards

Cards with `layout` of `"transform"`, `"modal_dfc"`, `"split"`, `"adventure"`, or `"flip"` have two or more faces stored in the `faces` array. Each face is a sub-object with its own name, manaCost, typeLine, oracleText, power/toughness, loyalty, imageUris, etc.

- **Transform / Modal DFC:** Two faces. Only the front face's mana cost counts for CMC. The back face may or may not have a mana cost.
- **Split:** Two halves. CMC is the sum of both halves (while on the stack, only the cast half's cost matters, but everywhere else the combined CMC applies — this is a rules detail for the engine).
- **Adventure:** The creature face and the adventure face. The adventure is cast as an instant/sorcery; the creature is cast normally. Exile tracking needed (cast adventure → exile → can cast creature from exile).
- **Flip:** Two halves sharing one card frame. The bottom half has different name/type/P-T.

### Tokens

Tokens use the same `CardData` structure but with `isToken: true`. They lack a mana cost (CMC 0 unless copying something). Tokens that are copies of cards have the copied card's characteristics.

Tokens cease to exist when they leave the battlefield — this is a state-based action, handled by the engine, not by the types.

---

## CardInstance

**Primary producer:** Engine (created when cards enter the game)
**Primary consumers:** Engine (game logic), Server (state serialization), Client (display)

A specific card in a specific game. Mutable game state attached to a CardData reference.

**Fields:**
- `instanceId` — Unique string within this game. Generated when the card enters any zone (deck construction, token creation, etc.).
- `cardDataId` — Reference to the static CardData by Scryfall ID.
- `owner` — Player ID of the player who started the game with this card in their deck. For tokens, the player who created the token. Never changes.
- `controller` — Player ID of the player who currently controls this card. Can differ from owner (e.g., mind control effects). Defaults to owner.
- `zone` — ZoneType where this card currently exists.
- `zoneOwnerId` — For per-player zones (hand, library, graveyard): which player's zone. For shared zones (battlefield, exile, stack, command): null.
- `tapped` — Boolean. Only meaningful on the battlefield.
- `flipped` — Boolean. For flip cards.
- `faceDown` — Boolean. For morph/manifest face-down creatures, or face-down exile.
- `transformedOrBack` — Boolean. For double-faced cards, whether currently showing the back face.
- `phasedOut` — Boolean. For phasing.
- `summoningSickness` — Boolean. True when a creature enters the battlefield and hasn't been under its controller's control since the beginning of their most recent turn. Reset at the start of the controller's untap step.
- `damage` — Number. Damage marked on this permanent. Reset during cleanup step. Only meaningful for creatures/planeswalkers on the battlefield.
- `counters` — Map of counter type string (e.g., `"+1/+1"`, `"loyalty"`, `"charge"`) to count (number).
- `attachedTo` — instanceId of the permanent this is attached to (for auras, equipment, fortifications). Null if not attached.
- `attachments` — Array of instanceIds attached to this permanent (auras, equipment on it).
- `abilities` — Array of `ResolvedAbility` objects. Populated during instantiation by combining keyword behaviors, parsed oracle abilities, and any overrides. The engine executes these.
- `modifiedPower` — Current power after all modifications (base + counters + effects). Null for non-creatures. Computed by the layer system, stored for quick access.
- `modifiedToughness` — Same as above for toughness.
- `currentLoyalty` — Current loyalty (for planeswalkers). Starts at `CardData.loyalty`, modified by abilities.
- `castingChoices` — Choices made when this spell was cast (kicker paid, X value, chosen mode for modal spells, etc.). Stored so resolution can reference them.
- `linkedEffects` — References to effects that link back to this card (e.g., "exile target card... return it at end of turn"). Maps effect ID to relevant data.

---

## GameState

**Primary producer:** Engine
**Primary consumers:** Server (drives game loop, serializes for clients), Client (via filtered ClientGameState)

The complete, authoritative snapshot of a game at any point in time. Contains all information needed to continue the game from this point.

**Fields:**
- `gameId` — Unique game identifier.
- `players` — Array of `Player` objects, in turn order.
- `cardInstances` — Map of instanceId to `CardInstance`. Flat lookup for all cards in the game.
- `zones` — Map of zone key to `Zone`. Zone keys are structured: `"battlefield"`, `"exile"`, `"stack"`, `"commandZone"`, `"player:{playerId}:library"`, `"player:{playerId}:hand"`, `"player:{playerId}:graveyard"`.
- `turnState` — `TurnState` object tracking current position in the turn.
- `activePlayerId` — The player whose turn it is.
- `priorityPlayerId` — The player who currently has priority. Null during steps where no player has priority (untap, cleanup normally).
- `consecutivePasses` — Number of consecutive priority passes without any player taking an action. When this equals the number of active players, the stack resolves (if non-empty) or the game advances (if empty).
- `stack` — Ordered array of `StackItem` IDs, top of stack first. The actual StackItem data lives in `cardInstances` or a parallel `stackItems` map.
- `turnNumber` — Current turn number (1-indexed).
- `gameOver` — Boolean.
- `winners` — Array of player IDs who won (empty if game not over, can be multiple in some multiplayer scenarios, usually one or zero).
- `losers` — Array of player IDs who have lost (eliminated in multiplayer).
- `pendingEvents` — Array of `GameEvent` objects that have been generated but not yet processed for triggers. Cleared after trigger processing.
- `rngState` — The current state of the seeded PRNG. Advances with each random operation.
- `continuousEffects` — Array of active continuous effects (from static abilities, resolved spells with durations, etc.). Each has a source, effect, duration, layer, and timestamp for ordering.
- `combatState` — `CombatState` or null. Present only during combat phase. Contains declared attackers, declared blockers, damage assignment orders.
- `format` — The game format (`"standard"`, `"modern"`, `"commander"`).
- `extraTurns` — Queue of extra turns to be taken (player ID and source). Processed LIFO.
- `turnFlags` — Transient flags for the current turn (e.g., `landsPlayedThisTurn` per player, `spellsCastThisTurn` per player). Reset at turn boundaries.

---

## Player

**Primary producer:** Engine
**Primary consumers:** Server, Client

**Fields:**
- `id` — Unique player identifier.
- `name` — Display name.
- `life` — Current life total. Starting life depends on format (20 for Standard/Modern, 40 for Commander).
- `poisonCounters` — Number of poison counters.
- `manaPool` — `ManaPool` object.
- `hasLost` — Boolean. True if eliminated (0 life, 10+ poison, drew from empty library, commander damage, or conceded).
- `hasConceded` — Boolean.
- `commanderDamageReceived` — Map of commander instanceId to total combat damage received from that commander. Only tracked in Commander format.
- `commanderId` — instanceId of this player's commander, if applicable.
- `commanderTax` — Number of times the commander has been cast from the command zone. Increases cost by {2} each time.
- `energyCounters` — Number of energy counters (for sets that use energy).
- `experienceCounters` — Number of experience counters (Commander).
- `landsPlayedThisTurn` — Number of lands played this turn.
- `maxLandsPerTurn` — Normally 1. Can be increased by effects (Exploration, etc.).
- `drewFromEmptyLibrary` — Boolean flag set when a player attempts to draw from an empty library. The SBA check uses this to eliminate the player.

---

## Zone

**Primary producer:** Engine
**Primary consumers:** Engine, Server

A zone is a named region where cards can exist.

**Fields:**
- `key` — Zone key matching the GameState zones map (e.g., `"battlefield"`, `"player:p1:hand"`).
- `type` — ZoneType enum value.
- `ownerId` — Player ID for per-player zones. Null for shared zones.
- `cardInstanceIds` — Ordered array of instanceIds. Order matters for Library (top to bottom) and Graveyard (most recent on top). For Battlefield, order is irrelevant to rules but maintained for UI consistency. For Stack, the stack order is managed by `GameState.stack`, not by this array.
- `visibility` — Who can see the cards in this zone:
  - Library: hidden from all (`"hidden"`)
  - Hand: visible to owner only (`"owner"`)
  - Battlefield: visible to all (`"public"`)
  - Graveyard: visible to all, ordered (`"public"`)
  - Exile: visible to all face-up; face-down cards hidden (`"public"` for zone, per-card `faceDown` for individual cards)
  - Stack: visible to all (`"public"`)
  - Command zone: visible to all (`"public"`)

---

## ManaPool

**Primary producer:** Engine (when mana abilities resolve)
**Primary consumers:** Engine (cost payment), Client (display)

The mana currently available to a player. Empties at each phase/step transition (unless effects prevent it).

**Fields:**
- `W` — Number of white mana.
- `U` — Number of blue mana.
- `B` — Number of black mana.
- `R` — Number of red mana.
- `G` — Number of green mana.
- `C` — Number of colorless mana.

All values are non-negative integers.

**Future extension:** Some effects restrict how mana can be spent ("spend this mana only to cast creature spells"). This will require tracking mana atoms individually rather than as aggregate counts. For Phase 1-3, the aggregate model is sufficient. When restrictions are needed, refactor to an array of `ManaAtom` objects with optional restriction metadata. This change should be backward-compatible (the aggregate pool can be derived from the atom array).

---

## ManaCost

**Primary producer:** Card System worker (parsed from Scryfall mana cost strings)
**Primary consumers:** Engine (cost payment), Client (display)

Represents the mana cost to cast a spell or activate an ability.

**Fields:**
- `symbols` — Ordered array of `ManaSymbol` objects representing each symbol in the cost, left to right as printed.
- `totalCMC` — The converted mana cost / mana value (number). Precomputed for efficiency.

### ManaSymbol

A discriminated union representing one symbol in a mana cost:

- `{ type: "generic", amount: number }` — Generic mana (any type pays). E.g., `{3}`.
- `{ type: "colored", color: ManaColor }` — Single colored mana. E.g., `{W}`.
- `{ type: "hybrid", colors: [ManaColor, ManaColor] }` — Hybrid mana. Pay either color. E.g., `{W/U}`.
- `{ type: "hybridGeneric", amount: number, color: ManaColor }` — Generic/color hybrid. Pay generic or colored. E.g., `{2/W}`.
- `{ type: "phyrexian", color: ManaColor }` — Phyrexian mana. Pay colored or 2 life. E.g., `{W/P}`.
- `{ type: "snow" }` — Snow mana. Pay with mana from a snow source.
- `{ type: "X" }` — X mana. Value chosen by the caster.
- `{ type: "colorless" }` — Specifically colorless mana (not generic). E.g., `{C}`.

**Mana cost string format from Scryfall:** `"{2}{W}{U}"`, `"{W/U}{W/U}"`, `"{X}{R}{R}"`, etc. The cost parser converts these strings into `ManaCost` objects.

---

## SpellAbility

**Primary producer:** Card System worker (from keywords, oracle parsing, overrides)
**Primary consumers:** Engine (execution/resolution)

The core executable unit. Every card has at least one SpellAbility (its "cast me" ability). Creatures have an implicit "cast" ability. Cards with oracle text have additional abilities.

### AbilityType (discriminant)

- `"spell"` — The act of casting the card itself (putting it on the stack from hand/command zone).
- `"activated"` — `[Cost]: [Effect]`. Player chooses to activate.
- `"triggered"` — `When/Whenever/At [condition], [effect]`. Fires automatically.
- `"static"` — Continuous effect. Not activated or triggered — always "on" while the source is in the relevant zone.
- `"mana"` — Special case of activated ability that produces mana. Does not use the stack.

### Fields (common to all)

- `id` — Unique identifier within the card's ability list.
- `type` — AbilityType discriminant.
- `sourceCardInstanceId` — The card this ability belongs to.
- `effects` — Array of `Effect` objects describing what happens when this ability resolves.
- `zones` — Which zones this ability functions from. Most abilities only work on the battlefield. Triggered abilities might function from the graveyard (e.g., "When this card is put into a graveyard from the battlefield...").

### Activated Ability Fields

- `cost` — `ActivationCost` object: mana cost, tap/untap, sacrifice, discard, life payment, exile, or any combination.
- `timing` — `"instant"` (can activate any time you have priority) or `"sorcery"` (only during your main phase, stack empty). Mana abilities are always instant-speed but don't use the stack.
- `targets` — Array of `TargetRequirement`. Empty if the ability doesn't target.
- `activationRestrictions` — Optional. "Activate only once each turn", "Activate only as a sorcery", etc.

### Triggered Ability Fields

- `triggerCondition` — Describes when this ability triggers. Contains:
  - `eventType` — Which GameEvent type(s) trigger this (e.g., `"cardEnteredZone"`, `"damageDealt"`).
  - `filter` — Additional conditions on the event (e.g., "a creature entered the battlefield" filters cardEnteredZone to creatures only).
  - `self` — Boolean. True if this triggers on the source card's own events (e.g., "When THIS creature enters the battlefield").
  - `optional` — Boolean. "You may" triggers vs. mandatory triggers.
  - `interveningIf` — Optional condition checked both at trigger time and resolution time. If false at either point, the ability doesn't trigger / fizzles.
- `targets` — Array of `TargetRequirement`. Chosen when the trigger goes on the stack.

### Static Ability Fields

- `effect` — A `ContinuousEffect` describing the ongoing modification (e.g., "+1/+1 to all creatures you control", "creatures you control have flying").
- `condition` — Optional condition for the static ability to be active (e.g., "as long as you control a Dragon").
- `layer` — Which layer(s) this effect applies in (see Layer System below).

### Mana Ability Fields

Same as activated, but `type` is `"mana"` and the effect must include at least one `addMana` effect. Mana abilities resolve immediately — they never go on the stack.

---

## ActivationCost

**Primary producer:** Card System worker
**Primary consumers:** Engine

Represents the total cost to cast a spell or activate an ability.

**Fields:**
- `manaCost` — Optional `ManaCost`. The mana portion of the cost.
- `tapSelf` — Boolean. Requires tapping the source permanent.
- `untapSelf` — Boolean. Requires untapping the source permanent (untap symbol).
- `sacrifice` — Optional filter describing what must be sacrificed (e.g., "sacrifice a creature", "sacrifice this permanent").
- `discard` — Optional filter describing what must be discarded.
- `payLife` — Optional number of life to pay.
- `exileSelf` — Boolean. Exile this card as part of the cost.
- `exileFromGraveyard` — Optional count/filter for exiling cards from graveyard (Delve, etc.).
- `removeCounters` — Optional. Remove counters from a permanent as part of the cost.
- `additionalCosts` — Array of arbitrary additional cost objects for costs not covered above.

---

## Effect

**Primary producer:** Card System worker (oracle parsing, overrides)
**Primary consumers:** Engine (resolution)

A discriminated union describing what happens when an ability resolves. Effects are the atomic units of game-state change.

### Variants

- `{ type: "dealDamage", amount: NumberOrExpression, to: TargetRef }` — Deal damage to a target creature, player, or planeswalker.
- `{ type: "destroy", target: TargetRef }` — Destroy target permanent.
- `{ type: "exile", target: TargetRef, faceDown?: boolean }` — Exile target card.
- `{ type: "bounce", target: TargetRef, to: ZoneType }` — Return target to hand (or library, etc.).
- `{ type: "drawCards", count: NumberOrExpression, player: PlayerRef }` — Draw cards.
- `{ type: "discardCards", count: NumberOrExpression, player: PlayerRef, filter?: CardFilter }` — Discard cards. If filter present, discard cards matching it; otherwise player chooses.
- `{ type: "gainLife", amount: NumberOrExpression, player: PlayerRef }` — Gain life.
- `{ type: "loseLife", amount: NumberOrExpression, player: PlayerRef }` — Lose life.
- `{ type: "addMana", mana: ManaPool, player: PlayerRef }` — Add mana to pool.
- `{ type: "createToken", token: TokenDefinition, count: NumberOrExpression, controller: PlayerRef }` — Create token creatures/artifacts/etc.
- `{ type: "addCounters", counterType: string, count: NumberOrExpression, target: TargetRef }` — Put counters on a permanent.
- `{ type: "removeCounters", counterType: string, count: NumberOrExpression, target: TargetRef }` — Remove counters.
- `{ type: "modifyPT", power: number, toughness: number, target: TargetRef, duration: Duration }` — Modify power/toughness.
- `{ type: "grantAbility", ability: SpellAbility, target: TargetRef, duration: Duration }` — Give a permanent an ability.
- `{ type: "tap", target: TargetRef }` — Tap target.
- `{ type: "untap", target: TargetRef }` — Untap target.
- `{ type: "counter", target: StackItemRef }` — Counter a spell or ability on the stack.
- `{ type: "search", zone: ZoneType, filter: CardFilter, player: PlayerRef, then: Effect }` — Search a zone for a card, then do something with it (typically put it in hand or on battlefield).
- `{ type: "sacrifice", filter: CardFilter, player: PlayerRef, count: NumberOrExpression }` — A player sacrifices permanents.
- `{ type: "preventDamage", amount: NumberOrExpression, target: TargetRef, duration: Duration }` — Prevent damage.
- `{ type: "copy", target: TargetRef }` — Copy a spell, ability, or permanent.
- `{ type: "composite", effects: Effect[] }` — Multiple effects in sequence.
- `{ type: "conditional", condition: Condition, thenEffects: Effect[], elseEffects?: Effect[] }` — If/then/else.
- `{ type: "forEach", selector: CardSelector, effect: Effect }` — For each card matching selector, apply effect.
- `{ type: "playerChoice", choices: Effect[], player: PlayerRef }` — Player chooses one of several effects.
- `{ type: "custom", resolveFunction: string }` — Reference to a hand-written resolve function (for override cards). The string is a function identifier that the engine looks up at resolution time.

### NumberOrExpression

Either a static number or a computation:
- Static: `5` — always 5.
- Expression: `{ countOf: CardSelector }` — counts cards matching a selector (e.g., "damage equal to the number of creatures you control").
- Expression: `{ variable: "X" }` — references the X value chosen during casting.

### Duration

- `"instant"` — happens once during resolution, no ongoing effect.
- `"endOfTurn"` — lasts until end of turn (cleaned up in cleanup step).
- `"untilYourNextTurn"` — lasts until the start of controller's next turn.
- `"permanent"` — lasts indefinitely (until the source leaves the battlefield, for static abilities).

### TargetRef and PlayerRef

References to targets and players within an effect, resolved at stack resolution time. These point to the chosen targets from the `StackItem`.

---

## TargetRequirement

**Primary producer:** Card System worker
**Primary consumers:** Engine (target selection validation)

Describes what constitutes a legal target for a spell or ability.

**Fields:**
- `id` — Unique within the spell/ability. Used to reference this target in effects via TargetRef.
- `description` — Human-readable description (e.g., "target creature", "target player or planeswalker").
- `count` — How many targets: `{ exactly: 1 }`, `{ upTo: 3 }`, `{ atLeast: 1, atMost: 3 }`.
- `targetTypes` — Array of what can be targeted: `"creature"`, `"player"`, `"planeswalker"`, `"permanent"`, `"spell"`, `"card-in-graveyard"`, etc.
- `filter` — A `CardFilter` or `PlayerFilter` for additional conditions (e.g., "target nonblack creature", "target opponent").
- `controller` — Whose things can be targeted: `"any"`, `"you"`, `"opponent"`.

### Target Legality

A target must be legal both when chosen (spell goes on stack) and when the ability resolves. Between those two points, the target may become illegal (leaves the battlefield, gains hexproof, etc.). The engine checks legality on resolution and fizzles abilities whose targets are all illegal.

For abilities with multiple targets where only some become illegal, the ability still resolves with the remaining legal targets (it only fizzles if ALL targets are illegal).

---

## GameEvent

**Primary producer:** Engine
**Primary consumers:** Engine (trigger checking), Server (game log, broadcasting), Client (game log display, animations)

Events represent observable game occurrences. They are emitted by engine functions and consumed for: (1) trigger checking, (2) game log, (3) client animations.

### Variants

- `{ type: "cardEnteredZone", cardInstanceId, toZone: ZoneType, fromZone?: ZoneType }` — A card moved to a new zone. fromZone is null for tokens being created.
- `{ type: "cardLeftZone", cardInstanceId, fromZone: ZoneType, toZone?: ZoneType }` — A card left a zone.
- `{ type: "damageDealt", sourceInstanceId, targetRef, amount, isCombatDamage, isDeathtouch }` — Damage was dealt.
- `{ type: "lifeChanged", playerId, oldLife, newLife, reason }` — A player's life total changed. Reason is "damage", "loseLife", "gainLife", "payLife".
- `{ type: "manaAdded", playerId, mana: ManaPool }` — Mana was added to a player's pool.
- `{ type: "spellCast", cardInstanceId, playerId }` — A spell was cast (put on the stack).
- `{ type: "abilityActivated", abilityId, cardInstanceId, playerId }` — An activated ability was put on the stack.
- `{ type: "abilityTriggered", abilityId, cardInstanceId }` — A triggered ability was put on the stack.
- `{ type: "stackItemResolved", stackItemId }` — A stack item finished resolving.
- `{ type: "stackItemCountered", stackItemId }` — A stack item was countered.
- `{ type: "turnBegan", turnNumber, activePlayerId }` — A new turn started.
- `{ type: "phaseChanged", phase: Phase, step?: Step }` — The game advanced to a new phase/step.
- `{ type: "combatDamageDealt" }` — All combat damage for a combat damage step has been dealt (aggregate event for triggers that care about "when combat damage is dealt").
- `{ type: "attackersDeclared", attackerIds: string[], attackTargets: Map<string, string> }` — Attackers were declared with their targets (defending player or planeswalker).
- `{ type: "blockersDeclared", blockerAssignments: Map<string, string[]> }` — Blockers were declared.
- `{ type: "counterAdded", cardInstanceId, counterType, newCount }` — A counter was placed on a permanent.
- `{ type: "counterRemoved", cardInstanceId, counterType, newCount }` — A counter was removed.
- `{ type: "playerLost", playerId, reason }` — A player lost the game (0 life, 10 poison, empty library draw, commander damage, concession).
- `{ type: "gameOver", winnerIds }` — The game ended.
- `{ type: "cardTapped", cardInstanceId }` — A permanent was tapped.
- `{ type: "cardUntapped", cardInstanceId }` — A permanent was untapped.
- `{ type: "tokenCreated", cardInstanceId }` — A token was created.
- `{ type: "cardDestroyed", cardInstanceId }` — A permanent was destroyed (distinct from dying — destruction causes the zone transfer, dying is the result).

Each event also carries a `timestamp` (monotonically increasing counter within the game) for ordering.

---

## TurnState

**Primary producer:** Engine
**Primary consumers:** Engine, Server, Client

Tracks where we are in the current turn.

**Fields:**
- `turnNumber` — 1-indexed.
- `activePlayerId` — Whose turn it is.
- `phase` — Current Phase.
- `step` — Current Step or null (main phases have no step).
- `hasDeclaredAttackers` — Boolean. Prevents re-declaring attackers.
- `hasDeclaredBlockers` — Boolean. Prevents re-declaring blockers.
- `priorityPassedWithoutAction` — Array of player IDs who have passed priority without acting since the last game action. Used to track when all players have passed.

---

## CombatState

**Primary producer:** Engine
**Primary consumers:** Engine

Present only during the combat phase. Removed when combat ends.

**Fields:**
- `attackers` — Map of attacker instanceId to `AttackerInfo`:
  - `attackTarget` — Player ID or planeswalker/battle instanceId being attacked.
  - `blocked` — Boolean. Whether this attacker has been blocked.
  - `blockers` — Ordered array of blocker instanceIds (in the order the active player chose for damage assignment).
  - `dealtFirstStrikeDamage` — Boolean. For tracking first strike / double strike.
- `blockers` — Map of blocker instanceId to `BlockerInfo`:
  - `blocking` — Array of attacker instanceIds this creature is blocking (typically one, but some effects allow blocking multiple).
- `damageAssignmentOrders` — Map of attacker instanceId to ordered array of blocker instanceIds. Set by the active player after blockers are declared.

---

## StackItem

**Primary producer:** Engine (when spells are cast or abilities trigger/activate)
**Primary consumers:** Engine (resolution), Server (broadcasting), Client (display)

Represents a spell or ability on the stack waiting to resolve.

**Fields:**
- `id` — Unique identifier.
- `sourceCardInstanceId` — The card that produced this stack item.
- `ability` — The SpellAbility being resolved.
- `controller` — Player ID of the player who controls this stack item (the caster/activator).
- `targets` — Array of `ResolvedTarget` objects (chosen targets with their IDs).
- `isSpell` — Boolean. True if this is a spell (card being cast), false if it's an ability.
- `isCopy` — Boolean. True if this is a copy of a spell/ability (e.g., from Storm or Fork).
- `choices` — Any choices made during casting (X value, kicker paid, chosen mode for modal spells, etc.).

### ResolvedTarget

- `requirementId` — References the `TargetRequirement.id` this target fulfills.
- `targetId` — instanceId (for permanent/card targets) or playerId (for player targets).
- `targetType` — `"card"` or `"player"`.

---

## PlayerAction

**Primary producer:** Client (via Server)
**Primary consumers:** Engine (via `executeAction`)

A discriminated union of everything a player can do when they have priority.

### Variants

- `{ type: "passPriority" }` — Pass without doing anything.
- `{ type: "castSpell", cardInstanceId, targets?: ResolvedTarget[], paymentPlan?: ManaPaymentPlan, choices?: CastingChoices }` — Cast a spell from hand (or other legal zone).
- `{ type: "activateAbility", cardInstanceId, abilityId, targets?: ResolvedTarget[], paymentPlan?: ManaPaymentPlan }` — Activate an activated ability.
- `{ type: "playLand", cardInstanceId }` — Play a land from hand.
- `{ type: "declareAttackers", attackerAssignments: Map<string, string> }` — Declare which creatures attack which targets.
- `{ type: "declareBlockers", blockerAssignments: Map<string, string[]> }` — Declare which creatures block which attackers.
- `{ type: "assignDamageOrder", attackerId: string, blockerOrder: string[] }` — Choose damage assignment order for a multi-blocked creature.
- `{ type: "assignCombatDamage", damageAssignments: Map<string, Map<string, number>> }` — Assign specific combat damage amounts (needed when assignment is non-obvious, e.g., trample).
- `{ type: "makeChoice", choiceId: string, selection: any }` — Respond to a game prompt (choose targets for a trigger, choose a mode, choose cards to discard to hand size, etc.).
- `{ type: "concede" }` — Concede the game.

### ManaPaymentPlan

When a player casts a spell or activates an ability, they submit a plan for how to pay the mana cost. This specifies which mana from the pool pays for which symbols, and which mana abilities to activate (mana abilities activate as part of the payment process, not separately).

- `poolPayments` — Map of ManaSymbol index to ManaColor used from pool.
- `manaAbilitiesToActivate` — Array of `{ cardInstanceId, abilityId }` for mana abilities to activate during payment.
- `phyrexianLifePayments` — Array of ManaSymbol indices where the player chose to pay 2 life instead.

---

## ActionResult

**Primary producer:** Engine
**Primary consumers:** Server

The return type from `executeAction`.

- `{ success: true, state: GameState, events: GameEvent[] }` — Action was legal and applied.
- `{ success: false, error: EngineError }` — Action was illegal.

### EngineError

- `code` — Error code string (e.g., `"ILLEGAL_ACTION"`, `"INSUFFICIENT_MANA"`, `"INVALID_TARGET"`, `"NOT_YOUR_PRIORITY"`, `"WRONG_PHASE"`).
- `message` — Human-readable description.

---

## ClientGameState

**Primary producer:** Server (by filtering GameState)
**Primary consumers:** Client

A filtered view of GameState safe to send to a specific player. Hidden information is removed.

**Fields:** Same structure as GameState except:
- **Library zones:** Only `cardCount` is sent, not the actual card list.
- **Opponent hands:** Only `cardCount` is sent, not the actual cards.
- **Face-down exiled cards:** Shown as face-down placeholders unless the viewing player controls the exiling effect.
- All other zones are fully visible with all card data (including image URIs for rendering).

The client renders this directly — it never needs to know more.

---

## ContinuousEffect

**Primary producer:** Engine (from static abilities and resolved spells)
**Primary consumers:** Engine (layer system application)

An ongoing modification to the game state that persists beyond a single resolution.

**Fields:**
- `id` — Unique identifier.
- `sourceCardInstanceId` — The permanent or spell that created this effect.
- `effect` — What the effect does (modify P/T, grant ability, change types, etc.).
- `affectedFilter` — Which cards/players this effect applies to (e.g., "all creatures you control").
- `duration` — When this effect ends: `"whileSourceOnBattlefield"`, `"endOfTurn"`, `"untilYourNextTurn"`, `"permanent"`.
- `layer` — Which layer this applies in (1-7, per CR 613). Used for interaction ordering.
- `timestamp` — When this effect was created. Used for same-layer ordering.
- `dependsOn` — Optional. Other effect IDs this depends on (CR 613.8 dependency system).

### Layer System (CR 613)

Continuous effects are applied in layers:
1. Copy effects
2. Control-changing effects
3. Text-changing effects
4. Type-changing effects
5. Color-changing effects
6. Ability-adding/removing effects
7. Power/toughness modifications
   - 7a: Characteristic-defining abilities (e.g., `*/*` where * is defined)
   - 7b: Setting P/T to a specific value
   - 7c: Modifications from non-counter sources (+1/+1 from enchantments)
   - 7d: Counter modifications (+1/+1 counters, -1/-1 counters)
   - 7e: Switching power and toughness

Within a layer, effects are applied in timestamp order unless dependency applies.

---

## Selectors and Filters

### CardSelector

Used throughout effects to identify which cards are affected.

- `zone` — Which zone(s) to search.
- `controller` — `"you"`, `"opponent"`, `"any"`, or specific player ID.
- `cardTypes` — Filter by card type (creature, enchantment, etc.).
- `subtypes` — Filter by subtype (Human, Elf, etc.).
- `colors` — Filter by color.
- `name` — Filter by name.
- `power`, `toughness`, `cmc` — Numeric comparisons.
- `keywords` — Filter by keyword.
- `custom` — Custom predicate function name (for overrides).

### CardFilter

Similar to CardSelector but used in TargetRequirements, excluding zone (context-dependent).

### Condition

A boolean predicate on game state, used in triggered ability conditions and conditional effects:
- `{ type: "controlsPermanent", filter: CardFilter }` — You control a permanent matching filter.
- `{ type: "lifeAtOrBelow", amount: number, player: PlayerRef }` — A player's life is at or below N.
- `{ type: "cardInZone", filter: CardFilter, zone: ZoneType }` — A card matching filter is in a zone.
- `{ type: "opponentCount", comparison: Comparison, count: number }` — Number of opponents meets a comparison.
- `{ type: "and", conditions: Condition[] }` — All conditions are true.
- `{ type: "or", conditions: Condition[] }` — Any condition is true.
- `{ type: "not", condition: Condition }` — Condition is false.
- `{ type: "custom", predicateFunction: string }` — Custom predicate for overrides.

---

## Decklist and DecklistEntry

**Primary producer:** Client (user input), Cards package (parsing)
**Primary consumers:** Server (game creation, validation), Engine (via `createGame`)

### DecklistEntry

A single line in a decklist — a card and how many copies.

**Fields:**
- `count` — Number of copies (1 for Commander singleton, 1-4 for constructed, any for basic lands).
- `cardName` — Card name as it appears in Scryfall (exact match after normalization). For double-faced cards, the front face name.
- `cardDataId` — Optional Scryfall UUID. Populated after resolving the name against the card database. Null when first parsed from text.
- `setCode` — Optional set code (e.g., `"MH2"`). Determines which printing/art to use. Not rules-relevant.
- `collectorNumber` — Optional collector number within the set. For exact printing selection.

### Decklist

A complete deck ready for play.

**Fields:**
- `name` — Deck name (user-provided).
- `format` — Target format (`"standard"`, `"modern"`, `"commander"`).
- `mainboard` — Array of `DecklistEntry` for the main deck.
- `sideboard` — Array of `DecklistEntry` for the sideboard.
- `commander` — Optional `DecklistEntry` for the commander (Commander format only). If present, also appears in mainboard.
- `companion` — Optional `DecklistEntry` for a companion.

### Deck Text Format (Import/Export)

The decklist parser accepts the plain-text format used by Moxfield, MTGA, Archidekt, and most deckbuilding tools. The format is:

```
[count] [card name]
[count] [card name] ([set code]) [collector number]
...

Sideboard
[count] [card name]
...

Commander
[count] [card name]
```

Rules:
- Each line is `[count] [card name]`, optionally followed by `([set code]) [collector number]`.
- Blank lines are ignored.
- Lines containing only `Sideboard`, `Commander`, `Companion`, or `Deck` (case-insensitive) are section headers that switch which section subsequent entries are added to.
- Lines starting with `//` are comments and are ignored.
- The default section (before any header) is mainboard.
- Card names are matched against the card database case-insensitively with fuzzy tolerance for minor formatting differences (e.g., missing accents, hyphens).

Export produces the same format — deterministic, round-trippable.

### DeckValidationResult

Returned when validating a deck against a format.

**Fields:**
- `valid` — Boolean.
- `errors` — Array of `{ message: string, cardName?: string }`. Includes: wrong deck size, too many copies, banned cards, cards not legal in format, color identity violations (Commander), etc.
- `warnings` — Array of `{ message: string }`. Non-fatal issues like "this card is restricted to 1 copy in Vintage."

---

## TokenDefinition

**Primary producer:** Card System worker
**Primary consumers:** Engine (token creation)

Defines a token to be created.

**Fields:**
- `name` — Token name (e.g., "Soldier", "Treasure").
- `colors` — Array of ManaColor.
- `cardTypes` — Array of card types (usually just `["Creature"]` or `["Artifact"]`).
- `subtypes` — Array of subtypes (e.g., `["Soldier"]`, `["Treasure"]`).
- `power` — Number or null.
- `toughness` — Number or null.
- `abilities` — Array of SpellAbility for the token (e.g., Treasure's sacrifice-for-mana ability).
- `keywords` — Array of keyword strings.
