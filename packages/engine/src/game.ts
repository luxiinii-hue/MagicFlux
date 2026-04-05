/**
 * Game lifecycle — createGame and getGameStatus.
 *
 * createGame builds an initial GameState from a GameConfig: creates players,
 * instantiates cards into libraries, shuffles, and draws opening hands.
 *
 * For Phase 1 we work with basic lands only (no card abilities, no Scryfall).
 * CardInstances are created directly from DecklistEntries.
 */

import type {
  GameConfig,
  GameState,
  GameStatus,
  Player,
  CardInstance,
  GameEvent,
  Zone,
  TurnState,
  TurnFlags,
  ManaPool,
  DecklistEntry,
  SpellAbility,
} from "@magic-flux/types";
import {
  Phase,
  Step,
  ZoneType,
  STARTING_LIFE_STANDARD,
  STARTING_LIFE_COMMANDER,
  STARTING_HAND_SIZE,
  DEFAULT_LANDS_PER_TURN,
} from "@magic-flux/types";
import { shuffle } from "./rng.js";
import { createZones, libraryKey, handKey, drawCard } from "./zones/transfers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_MANA_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

function createPlayer(id: string, name: string, format: string): Player {
  const life = format === "commander" ? STARTING_LIFE_COMMANDER : STARTING_LIFE_STANDARD;
  return {
    id,
    name,
    life,
    poisonCounters: 0,
    manaPool: EMPTY_MANA_POOL,
    hasLost: false,
    hasConceded: false,
    commanderDamageReceived: {},
    commanderId: null,
    commanderTax: 0,
    energyCounters: 0,
    experienceCounters: 0,
    landsPlayedThisTurn: 0,
    maxLandsPerTurn: DEFAULT_LANDS_PER_TURN,
    drewFromEmptyLibrary: false,
  };
}

let instanceCounter = 0;

function createCardInstance(
  cardDataId: string,
  owner: string,
): CardInstance {
  const instanceId = `card_${++instanceCounter}`;
  return {
    instanceId,
    cardDataId,
    owner,
    controller: owner,
    zone: ZoneType.Library,
    zoneOwnerId: owner,
    tapped: false,
    flipped: false,
    faceDown: false,
    transformedOrBack: false,
    phasedOut: false,
    summoningSickness: false,
    damage: 0,
    counters: {},
    attachedTo: null,
    attachments: [],
    abilities: [],
    modifiedPower: null,
    modifiedToughness: null,
    basePower: null,
    baseToughness: null,
    isLegendary: false,
    currentLoyalty: null,
    castingChoices: null,
    linkedEffects: {},
  };
}

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

/**
 * Create a new game from configuration. Returns the initial GameState with
 * players set up, libraries shuffled, and opening hands drawn.
 */
export function createGame(config: GameConfig): GameState {
  // Reset instance counter for deterministic IDs when seeded
  instanceCounter = 0;

  const seed = config.seed ?? Date.now();
  let rngState = seed;

  const playerIds = config.players.map((p) => p.id);

  // 1. Create players
  const players = config.players.map((pc) =>
    createPlayer(pc.id, pc.name, config.format),
  );

  // 2. Create zones
  const zones = createZones(playerIds);

  // 3. Instantiate cards and populate libraries
  const cardInstances: Record<string, CardInstance> = {};

  for (const pc of config.players) {
    const libraryCards: string[] = [];
    let commanderInstanceId: string | null = null;

    for (const entry of pc.decklist) {
      for (let i = 0; i < entry.count; i++) {
        const card = createCardInstance(
          entry.cardDataId ?? entry.cardName,
          pc.id,
        );
        cardInstances[card.instanceId] = card;

        // In Commander, the designated commander goes to the command zone
        if (config.format === "commander" && pc.commanderId &&
            (entry.cardDataId === pc.commanderId || entry.cardName === pc.commanderId) &&
            !commanderInstanceId) {
          commanderInstanceId = card.instanceId;
          // Update card zone to CommandZone
          cardInstances[card.instanceId] = {
            ...card,
            zone: "CommandZone" as any,
            zoneOwnerId: null,
          };
          zones["commandZone"] = {
            ...zones["commandZone"],
            cardInstanceIds: [...zones["commandZone"].cardInstanceIds, card.instanceId],
          };
        } else {
          libraryCards.push(card.instanceId);
        }
      }
    }

    // Set commander ID on player
    if (commanderInstanceId) {
      const playerIdx = players.findIndex((p) => p.id === pc.id);
      if (playerIdx >= 0) {
        players[playerIdx] = { ...players[playerIdx], commanderId: commanderInstanceId };
      }
    }

    // 4. Shuffle library
    const shuffled = shuffle(libraryCards, rngState);
    rngState = shuffled.nextState;

    zones[libraryKey(pc.id)] = {
      ...zones[libraryKey(pc.id)],
      cardInstanceIds: shuffled.result,
    };
  }

  // 5. Build initial state (before drawing hands)
  const turnState: TurnState = {
    turnNumber: 1,
    activePlayerId: playerIds[0],
    phase: Phase.Beginning,
    step: Step.Untap,
    hasDeclaredAttackers: false,
    hasDeclaredBlockers: false,
    priorityPassedWithoutAction: [],
  };

  const turnFlags: TurnFlags = {
    landsPlayedThisTurn: Object.fromEntries(playerIds.map((id) => [id, 0])),
    spellsCastThisTurn: Object.fromEntries(playerIds.map((id) => [id, 0])),
  };

  let state: GameState = {
    gameId: `game_${seed}`,
    players,
    cardInstances,
    zones,
    turnState,
    activePlayerId: playerIds[0],
    priorityPlayerId: null,
    consecutivePasses: 0,
    stack: [],
    stackItems: {},
    turnNumber: 1,
    gameOver: false,
    winners: [],
    losers: [],
    pendingEvents: [],
    rngState,
    continuousEffects: [],
    replacementEffects: [],
    pendingPrompt: null,
    combatState: null,
    format: config.format,
    extraTurns: [],
    turnFlags,
  };

  // 6. Draw opening hands
  let timestamp = 0;
  for (const player of players) {
    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
      const result = drawCard(state, player.id, timestamp);
      state = result.state;
      timestamp += 2; // each drawCard emits 2 events
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// getGameStatus
// ---------------------------------------------------------------------------

/** Returns high-level game status. */
export function getGameStatus(state: GameState): GameStatus {
  return {
    isOver: state.gameOver,
    winners: state.winners,
    losers: state.losers,
    activePlayerId: state.activePlayerId,
    priorityPlayerId: state.priorityPlayerId,
    currentPhase: state.turnState.phase,
    currentStep: state.turnState.step,
    turnNumber: state.turnNumber,
  };
}
