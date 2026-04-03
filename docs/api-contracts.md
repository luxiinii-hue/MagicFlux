# Magic Flux — API Contracts

This document defines the function signatures and message protocols at every module boundary. Worker sessions must implement these interfaces exactly. If a signature needs to change, escalate to the Project Planner — do not modify unilaterally.

---

## Engine API (`packages/engine/` → consumed by `packages/server/`)

The engine is a pure function library. Every function takes immutable inputs and returns new outputs. No side effects.

### Game Lifecycle

#### `createGame(config: GameConfig): GameState`

Creates a new game from a configuration. Returns the initial GameState with players set up, libraries shuffled, and opening hands drawn.

**GameConfig fields:**
- `format` — `"standard"` | `"modern"` | `"commander"`
- `players` — Array of `{ id: string, name: string, decklist: DecklistEntry[], commanderId?: string }`. Decklist entries are `{ cardDataId: string, count: number }`.
- `seed` — Number for seeded RNG. If omitted, server generates one.

**What it does:**
1. Creates Player objects with format-appropriate starting life (20 or 40).
2. Instantiates CardInstances from decklists (each card in the deck becomes a CardInstance with a unique instanceId).
3. Places all cards in their owner's library zones.
4. Shuffles each library using the seeded RNG.
5. Draws opening hands (7 cards each).
6. Sets turn 1, active player to first player in array (mulligan handling is a separate flow).
7. Returns the initial GameState.

**Does NOT:** Handle mulligans. Mulligan is a sequence of player actions processed via `executeAction`.

#### `getGameStatus(state: GameState): GameStatus`

Returns high-level game status.

**GameStatus fields:**
- `isOver` — Boolean.
- `winners` — Player IDs.
- `losers` — Player IDs.
- `activePlayerId` — Whose turn it is.
- `priorityPlayerId` — Who has priority (null if no one does).
- `currentPhase` — Phase.
- `currentStep` — Step or null.
- `turnNumber` — Number.

---

### Player Actions

#### `getLegalActions(state: GameState, playerId: string): PlayerAction[]`

Returns every legal action the specified player can currently take. This is the authoritative source of what a player is allowed to do.

**Returns:** Array of `PlayerAction` variants. Includes:
- `passPriority` — always legal when you have priority.
- `castSpell` — for each spell the player can legally cast right now (correct timing, can pay costs, valid targets exist). Includes the cardInstanceId but not targets/payment (those are chosen by the player).
- `activateAbility` — for each ability the player can legally activate.
- `playLand` — for each land in hand if the player hasn't exceeded their land-per-turn limit, it's their main phase, and the stack is empty.
- `declareAttackers` — available at the start of the declare attackers step (active player only).
- `declareBlockers` — available at the start of the declare blockers step (defending player only).
- `concede` — always legal.
- `makeChoice` — when the game is waiting for this player to make a choice.

**Performance note:** This function may be called frequently (every priority window). It should be efficient. For early phases, a naive implementation is fine; optimize later if profiling shows issues.

#### `executeAction(state: GameState, action: PlayerAction): ActionResult`

Applies a player action to the game state. Returns a new state and events on success, or an error on failure.

**ActionResult:**
- `{ success: true, state: GameState, events: GameEvent[] }`
- `{ success: false, error: EngineError }`

**What it does per action type:**
- `passPriority` — Increments consecutive pass count. If all players have passed: resolve top of stack (if non-empty) or advance phase/step (if empty). Returns new state + any resolution events.
- `castSpell` — Validates timing and costs. Moves card from current zone to stack. Deducts mana. Processes mana abilities in the payment plan. Creates a StackItem. Returns new state + spellCast event.
- `activateAbility` — Validates the ability can be activated. Pays costs. If mana ability: resolves immediately, adds mana, returns state + manaAdded event. If non-mana: creates a StackItem. Returns new state + abilityActivated event.
- `playLand` — Validates it's a main phase, stack is empty, player hasn't exceeded land limit. Moves card from hand to battlefield. Returns state + cardEnteredZone event.
- `declareAttackers` — Validates combat timing. Marks creatures as attacking. Taps non-vigilance attackers. Returns state + attackersDeclared event.
- `declareBlockers` — Validates combat timing. Marks creatures as blocking. Validates menace requirements. Returns state + blockersDeclared event.
- `assignCombatDamage` — Validates damage amounts. Deals combat damage. Returns state + damageDealt events.
- `makeChoice` — Validates the choice is valid for the pending prompt. Applies the choice. Returns state.
- `concede` — Marks player as lost. Returns state + playerLost event.

#### `processStateBasedActions(state: GameState): { state: GameState, events: GameEvent[], actionsPerformed: boolean }`

Checks and applies all state-based actions. Must be called in a loop until `actionsPerformed` is false (SBAs can trigger more SBAs).

**State-based actions checked:**
- Player at 0 or less life → loses
- Player attempted to draw from empty library → loses
- Creature with 0 or less toughness → owner's graveyard
- Creature with lethal damage marked → destroy
- Creature with deathtouch damage → destroy
- Aura not attached to legal permanent → owner's graveyard
- Equipment/Fortification attached illegally → unattach
- Planeswalker with 0 loyalty → owner's graveyard
- Legend rule: 2+ legendaries with same name → controller chooses one, rest to graveyard
- Token in non-battlefield zone → cease to exist (removed from game)
- +1/+1 and -1/-1 counter pairs → remove pairs
- Player with 10+ poison counters → loses
- 21+ commander damage from a single commander → loses (Commander format only)

#### `checkTriggeredAbilities(state: GameState, events: GameEvent[]): StackItem[]`

Given a list of events, checks all triggered abilities in the game and returns StackItems for any that trigger. The server adds these to the stack.

**Trigger ordering:**
1. Active player's triggers first, in the order that player chooses (if multiple).
2. Then non-active players in turn order (APNAP), each choosing their own trigger order.

For Phase 1, trigger ordering prompts are deferred — triggers go on the stack in a deterministic default order (by trigger source instanceId). Player-ordered triggers are a Phase 4 feature.

---

### Turn Structure

#### `advancePhase(state: GameState): { state: GameState, events: GameEvent[] }`

Advances the game to the next phase or step. Called by the server when all players have passed priority on an empty stack.

**Phase/step progression:**
1. Beginning Phase: Untap → Upkeep → Draw
2. Pre-combat Main Phase
3. Combat Phase: Beginning of Combat → Declare Attackers → Declare Blockers → [First Strike Damage] → Combat Damage → End of Combat
4. Post-combat Main Phase
5. Ending Phase: End Step → Cleanup

**What it does at each transition:**
- **Untap step:** Untap all permanents controlled by active player. No priority.
- **Upkeep:** Generate "at beginning of upkeep" triggers. Grant priority to active player.
- **Draw:** Active player draws a card (skip on turn 1 in 2-player). Generate triggers. Grant priority.
- **Main phases:** Grant priority to active player.
- **Beginning of combat:** Generate triggers. Grant priority.
- **Declare attackers:** Active player must declare attackers (or declare no attackers). Generate triggers.
- **Declare blockers:** Defending player(s) declare blockers. Generate triggers.
- **First strike damage:** Only exists if a creature in combat has first strike or double strike. Deal first strike damage.
- **Combat damage:** Deal regular combat damage (excluding creatures that already dealt first strike and don't have double strike).
- **End of combat:** Remove creatures from combat. Generate triggers.
- **End step:** Generate "at beginning of end step" triggers. Grant priority.
- **Cleanup:** Discard to hand size. Remove "until end of turn" effects. Remove damage from permanents. Normally no priority (unless a trigger fires, in which case grant priority and then do another cleanup).

---

### Combat

#### `calculateCombatDamage(state: GameState): DamageAssignment[]`

Given the current combat state (attackers, blockers, damage orders), calculates the default damage assignment. For unblocked attackers: damage to defending player/planeswalker. For blocked attackers: damage distributed to blockers in order. For blockers: damage to the attacking creature.

Returns an array of `DamageAssignment` objects that the server can apply, or that the active player can modify (for trample, excess damage choices, etc.).

**DamageAssignment:**
- `sourceInstanceId` — Creature dealing damage.
- `targetId` — instanceId or playerId.
- `amount` — Damage amount.
- `isFirstStrike` — Boolean.

---

### Mana

#### `canPayCost(state: GameState, playerId: string, cost: ManaCost): boolean`

Checks whether a player can pay a mana cost from their current pool (including floating mana and potential mana abilities). Used by `getLegalActions` to determine castability.

For Phase 1: only checks current pool. Later phases can add mana ability lookahead.

#### `payManaCost(state: GameState, playerId: string, payment: ManaPaymentPlan): { state: GameState, events: GameEvent[] }`

Executes a mana payment. Activates any mana abilities in the plan, deducts mana from pool, pays Phyrexian life costs.

---

## Cards API (`packages/cards/` → consumed by `packages/server/` and indirectly by `packages/engine/`)

### Data Pipeline

#### `loadCardDatabase(): Promise<void>`

Downloads Scryfall bulk data (Oracle Cards JSON) if not cached or if cache is stale. Parses all cards into `CardData` objects. Stores in an in-memory registry.

Called once at server startup. Must respect Scryfall rate limits.

#### `getCardData(cardDataId: string): CardData | undefined`

Retrieves a CardData by Scryfall ID. Returns undefined if not found.

#### `getCardDataByName(name: string): CardData | undefined`

Retrieves a CardData by exact name match (case-insensitive).

#### `searchCards(query: CardQuery): CardData[]`

Searches the card database. `CardQuery` supports:
- `name` — Partial name match.
- `types` — Filter by card types.
- `colors` — Filter by colors.
- `format` — Filter by format legality.
- `keywords` — Filter by keywords.
- `cmc` — Filter by CMC (exact, range, comparison).
- `set` — Filter by set code.
- `limit` — Maximum results to return.

#### `isLegalInFormat(cardDataId: string, format: string): boolean`

Checks whether a card is legal in a specific format (uses Scryfall legality data).

### Card Instantiation

#### `instantiateCard(cardData: CardData, owner: string, instanceId: string): CardInstance`

Creates a CardInstance from CardData for use in a game. Populates the `abilities` array by:
1. Converting keywords from `cardData.keywords` into engine-compatible SpellAbility objects via the keyword registry.
2. Parsing `cardData.oracleText` into structured SpellAbility objects via the oracle parser.
3. Looking up manual overrides by card name/ID and applying them (override replaces parsed abilities for that card).
4. Adding the implicit "cast this spell" ability.

The resulting CardInstance has all abilities fully resolved and ready for the engine to execute.

### Keyword Registry

#### `getKeywordBehavior(keyword: string): KeywordDefinition | undefined`

Returns the behavior definition for a keyword. `KeywordDefinition` contains:
- `name` — Keyword name.
- `type` — `"static"`, `"triggered"`, `"activated"`, `"replacement"`, `"evasion"`, `"combat"`.
- `generateAbilities(cardInstance: CardInstance): SpellAbility[]` — Produces the SpellAbility objects for this keyword on this card.

#### `getImplementedKeywords(): string[]`

Returns the list of currently implemented keywords.

### Oracle Parser

#### `parseOracleText(oracleText: string, cardData: CardData): SpellAbility[]`

Parses oracle text into structured SpellAbility objects. Returns empty array for text it cannot parse (those cards need manual overrides).

The parser handles templates like:
- `"Destroy target [type]"` → destroy effect with target requirement
- `"[Card name] deals N damage to [target]"` → damage effect
- `"Draw N cards"` → draw effect
- `"Target [type] gets +N/+N until end of turn"` → modify P/T effect
- `"When [this] enters the battlefield, [effect]"` → triggered ability
- `"[Cost]: [Effect]"` → activated ability
- `"[Tap]: Add {M}"` → mana ability

Unparseable text is logged as a warning with the card name.

### Deck Import and Validation

#### `parseDecklistText(text: string): { decklist: Decklist, unresolvedCards: string[] }`

Parses a plain-text decklist (Moxfield/MTGA/Archidekt export format) into a `Decklist` object. Resolves card names against the card database. Returns `unresolvedCards` for any card names that couldn't be matched (typos, cards not in the database).

**Input format:** See `types-design.md` → Deck Text Format for the grammar.

**Behavior:**
- Lines before any section header go into `mainboard`.
- `Sideboard`, `Commander`, `Companion` headers switch the active section.
- Card names are matched case-insensitively. If no exact match, attempts fuzzy match (Levenshtein distance ≤ 2). If still no match, the card name goes into `unresolvedCards`.
- Set code and collector number are optional — they select a specific printing for art but don't affect gameplay.

#### `exportDecklistText(decklist: Decklist): string`

Converts a `Decklist` back to the plain-text format. Deterministic output: mainboard sorted alphabetically, then sideboard section, then commander section if present.

#### `validateDecklist(decklist: Decklist, format: string): DeckValidationResult`

Validates a decklist against format rules:
- **Standard/Modern:** 60+ mainboard, 0-15 sideboard, max 4 copies of non-basic-land cards, all cards legal in format.
- **Commander:** Exactly 100 cards (including commander), singleton (max 1 copy except basic lands), all cards within commander's color identity, commander must be a legendary creature (or legal commander).

Returns `DeckValidationResult` with specific error messages per violation.

---

## Server → Client WebSocket Protocol (`packages/server/` → `packages/client/`)

All messages are JSON. The top-level structure is `{ type: string, payload: object }`.

### Server-Sent Messages

#### `game:stateUpdate`

Sent whenever the game state changes. Contains the full `ClientGameState` for the receiving player.

```
{
  type: "game:stateUpdate",
  payload: {
    gameState: ClientGameState
  }
}
```

#### `game:legalActions`

Sent when it's the player's turn to act (they have priority or must make a choice). Contains the list of actions they can take.

```
{
  type: "game:legalActions",
  payload: {
    actions: PlayerAction[],
    prompt?: string  // Human-readable description of what's expected
  }
}
```

#### `game:prompt`

Sent when the game needs a specific decision from the player (choose targets, assign damage, choose mode, discard to hand size, etc.).

```
{
  type: "game:prompt",
  payload: {
    promptId: string,
    promptType: "chooseTargets" | "assignDamage" | "chooseMode" | "discardToHandSize" | "orderTriggers" | "choosePermanent" | "choosePlayer",
    description: string,
    options: any,       // Depends on promptType
    minSelections: number,
    maxSelections: number
  }
}
```

#### `game:event`

Sent for each game event. Used for game log display and triggering animations.

```
{
  type: "game:event",
  payload: {
    event: GameEvent,
    logMessage: string  // Human-readable log text
  }
}
```

#### `game:error`

Sent when a player's action is rejected.

```
{
  type: "game:error",
  payload: {
    code: string,
    message: string
  }
}
```

#### `game:over`

Sent when the game ends.

```
{
  type: "game:over",
  payload: {
    winners: string[],
    losers: string[],
    reason: string
  }
}
```

#### `lobby:gameCreated`

Sent to players in the lobby when a game is available.

```
{
  type: "lobby:gameCreated",
  payload: {
    gameId: string,
    format: string,
    creatorName: string,
    playerCount: number,
    maxPlayers: number
  }
}
```

#### `lobby:gameStarting`

Sent to all players in a game when it's about to begin.

```
{
  type: "lobby:gameStarting",
  payload: {
    gameId: string,
    players: { id: string, name: string }[]
  }
}
```

### Client-Sent Messages

#### `game:action`

Player performs a game action.

```
{
  type: "game:action",
  payload: {
    gameId: string,
    action: PlayerAction
  }
}
```

#### `game:promptResponse`

Player responds to a prompt.

```
{
  type: "game:promptResponse",
  payload: {
    gameId: string,
    promptId: string,
    selection: any  // Depends on prompt type
  }
}
```

#### `lobby:createGame`

Player creates a new game.

```
{
  type: "lobby:createGame",
  payload: {
    format: string,
    maxPlayers: number,
    decklist: DecklistEntry[]
  }
}
```

#### `lobby:joinGame`

Player joins an existing game.

```
{
  type: "lobby:joinGame",
  payload: {
    gameId: string,
    decklist: DecklistEntry[]
  }
}
```

#### `lobby:leaveGame`

Player leaves a game (before it starts).

```
{
  type: "lobby:leaveGame",
  payload: {
    gameId: string
  }
}
```

---

## Server Internal: Game Loop

The server drives the game loop by orchestrating engine calls. This is not an exported API — it's the internal flow that the Game Coordinator worker must implement.

```
function gameLoop(state: GameState): void {
  // This is conceptual — actual implementation is event-driven via WebSocket

  while (!state.gameOver) {
    // 1. State-based actions (loop until stable)
    let sbaResult;
    do {
      sbaResult = processStateBasedActions(state);
      state = sbaResult.state;
      broadcastEvents(sbaResult.events);
    } while (sbaResult.actionsPerformed);

    // 2. Check triggers
    const triggers = checkTriggeredAbilities(state, sbaResult.events);
    if (triggers.length > 0) {
      state = addToStack(state, triggers);
      // If multiple triggers, may need player ordering prompt
      continue; // Re-check SBAs after adding triggers
    }

    // 3. Determine who has priority
    const priorityPlayer = state.priorityPlayerId;
    if (priorityPlayer === null) {
      // No priority (e.g., untap step) — advance
      const advance = advancePhase(state);
      state = advance.state;
      broadcastEvents(advance.events);
      continue;
    }

    // 4. Send state + legal actions to priority player
    broadcastState(state);
    sendLegalActions(priorityPlayer, getLegalActions(state, priorityPlayer));

    // 5. Wait for player action (async — WebSocket)
    const action = await waitForPlayerAction(priorityPlayer);

    // 6. Execute action
    const result = executeAction(state, action);
    if (result.success) {
      state = result.state;
      broadcastEvents(result.events);
    } else {
      sendError(priorityPlayer, result.error);
    }
  }
}
```

This is a simplified view. The actual implementation handles:
- Multiple concurrent games
- Reconnection
- Timeouts
- AI players
- Asynchronous WebSocket communication (the loop is event-driven, not a blocking loop)

---

## Data Flow Summary

```
Client                    Server                     Engine              Cards
  |                         |                          |                   |
  |  lobby:createGame       |                          |                   |
  |------------------------>|                          |                   |
  |                         |  loadCardDatabase()      |                   |
  |                         |------------------------->|                   |
  |                         |                          |  (card data ready)|
  |  lobby:joinGame         |                          |                   |
  |------------------------>|                          |                   |
  |                         |  instantiateCard() x N   |                   |
  |                         |<-------------------------|                   |
  |                         |  createGame(config)      |                   |
  |                         |------------------------->|                   |
  |                         |  state + events          |                   |
  |                         |<-------------------------|                   |
  |  game:stateUpdate       |                          |                   |
  |<------------------------|                          |                   |
  |  game:legalActions      |                          |                   |
  |<------------------------|                          |                   |
  |                         |                          |                   |
  |  game:action            |                          |                   |
  |------------------------>|                          |                   |
  |                         |  executeAction(state, a) |                   |
  |                         |------------------------->|                   |
  |                         |  { state, events }       |                   |
  |                         |<-------------------------|                   |
  |                         |  processStateBasedActions|                   |
  |                         |------------------------->|                   |
  |                         |  checkTriggeredAbilities |                   |
  |                         |------------------------->|                   |
  |                         |  (loop until stable)     |                   |
  |  game:stateUpdate       |                          |                   |
  |<------------------------|                          |                   |
  |  game:event(s)          |                          |                   |
  |<------------------------|                          |                   |
```
