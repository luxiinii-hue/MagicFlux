/**
 * Phase and step advancement logic.
 *
 * Phase/step progression per MTG rules:
 * 1. Beginning: Untap -> Upkeep -> Draw
 * 2. PreCombatMain (no steps)
 * 3. Combat: BeginningOfCombat -> DeclareAttackers -> DeclareBlockers
 *    -> [FirstStrikeDamage] -> CombatDamage -> EndOfCombat
 * 4. PostCombatMain (no steps)
 * 5. Ending: EndStep -> Cleanup
 *
 * After Cleanup, the turn passes to the next player.
 */

import type {
  GameState,
  GameEvent,
  TurnState,
  ManaPool,
  Player,
} from "@magic-flux/types";
import { Phase, Step, MAX_HAND_SIZE } from "@magic-flux/types";
import { drawCard } from "../zones/transfers.js";
import { calculateCombatDamage, applyCombatDamage, hasFirstStrikeCreatures } from "../combat/damage.js";
import { processStateBasedActionsLoop } from "../state-based/sba.js";

const EMPTY_MANA_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

// ---------------------------------------------------------------------------
// Next phase/step table
// ---------------------------------------------------------------------------

interface PhaseStep {
  phase: Phase;
  step: Step | null;
}

/**
 * The full turn sequence. Main phases have step = null.
 * FirstStrikeDamage is only inserted dynamically when relevant (Phase 3+).
 */
const TURN_SEQUENCE: readonly PhaseStep[] = [
  { phase: Phase.Beginning, step: Step.Untap },
  { phase: Phase.Beginning, step: Step.Upkeep },
  { phase: Phase.Beginning, step: Step.Draw },
  { phase: Phase.PreCombatMain, step: null },
  { phase: Phase.Combat, step: Step.BeginningOfCombat },
  { phase: Phase.Combat, step: Step.DeclareAttackers },
  { phase: Phase.Combat, step: Step.DeclareBlockers },
  // FirstStrikeDamage inserted dynamically when needed
  { phase: Phase.Combat, step: Step.CombatDamage },
  { phase: Phase.Combat, step: Step.EndOfCombat },
  { phase: Phase.PostCombatMain, step: null },
  { phase: Phase.Ending, step: Step.EndStep },
  { phase: Phase.Ending, step: Step.Cleanup },
];

function findCurrentIndex(phase: Phase, step: Step | null): number {
  return TURN_SEQUENCE.findIndex(
    (ps) => ps.phase === phase && ps.step === step,
  );
}

// ---------------------------------------------------------------------------
// Phase-specific actions
// ---------------------------------------------------------------------------

/** Empty all players' mana pools. Returns updated players. */
function emptyAllManaPools(players: readonly Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    manaPool: EMPTY_MANA_POOL,
  }));
}

/** Untap all permanents controlled by the active player. */
function untapStep(state: GameState): { state: GameState; events: GameEvent[] } {
  const activeId = state.activePlayerId;
  const events: GameEvent[] = [];
  let timestamp = Date.now(); // TODO: use a proper event counter

  const updatedCards = { ...state.cardInstances };
  for (const [id, card] of Object.entries(updatedCards)) {
    if (card.controller === activeId && card.tapped && card.zone === ("Battlefield" as any)) {
      updatedCards[id] = { ...card, tapped: false, summoningSickness: false };
      events.push({ type: "cardUntapped", cardInstanceId: id, timestamp: timestamp++ });
    }
    // Clear summoning sickness for creatures controlled since start of turn
    if (card.controller === activeId && card.summoningSickness && card.zone === ("Battlefield" as any)) {
      updatedCards[id] = { ...updatedCards[id], summoningSickness: false };
    }
  }

  return {
    state: { ...state, cardInstances: updatedCards },
    events,
  };
}

/** Active player draws a card during the draw step. Skip on turn 1 in 2-player. */
function drawStep(state: GameState): { state: GameState; events: GameEvent[] } {
  // Skip draw on turn 1 for the first player in a 2-player game
  const activePlayers = state.players.filter((p) => !p.hasLost);
  if (state.turnNumber === 1 && activePlayers.length === 2) {
    return { state, events: [] };
  }

  return drawCard(state, state.activePlayerId, Date.now());
}

/** Cleanup: discard to hand size, remove damage, remove "until end of turn" effects. */
function cleanupStep(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Remove damage from all permanents
  const updatedCards = { ...state.cardInstances };
  for (const [id, card] of Object.entries(updatedCards)) {
    if (card.damage > 0 && card.zone === ("Battlefield" as any)) {
      updatedCards[id] = { ...card, damage: 0 };
    }
  }

  // Remove "endOfTurn" continuous effects
  const updatedEffects = state.continuousEffects.filter(
    (e) => e.duration !== "endOfTurn",
  );

  // TODO: Discard to hand size (requires player choice prompt — Phase 2+)
  // For Phase 1, we don't have spells so hand size shouldn't exceed 7

  return {
    state: {
      ...state,
      cardInstances: updatedCards,
      continuousEffects: updatedEffects,
    },
    events,
  };
}

// ---------------------------------------------------------------------------
// advancePhase
// ---------------------------------------------------------------------------

/**
 * Advance the game to the next phase or step. Called when all players have
 * passed priority on an empty stack (or during no-priority steps).
 *
 * Handles untap, draw, cleanup, and turn transitions. Empties mana pools
 * at each transition.
 */
export function advancePhase(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  const currentIdx = findCurrentIndex(
    state.turnState.phase,
    state.turnState.step,
  );

  const allEvents: GameEvent[] = [];
  let nextIdx = currentIdx + 1;

  // If we've reached the end of the turn sequence, start a new turn
  if (nextIdx >= TURN_SEQUENCE.length) {
    return startNextTurn(state);
  }

  const next = TURN_SEQUENCE[nextIdx];

  // Empty mana pools on phase/step transition
  const updatedPlayers = emptyAllManaPools(state.players);

  const updatedTurnState: TurnState = {
    ...state.turnState,
    phase: next.phase,
    step: next.step,
    priorityPassedWithoutAction: [],
    // Reset combat flags when leaving combat
    ...(state.turnState.phase === Phase.Combat && next.phase !== Phase.Combat
      ? { hasDeclaredAttackers: false, hasDeclaredBlockers: false }
      : {}),
  };

  let updatedState: GameState = {
    ...state,
    players: updatedPlayers,
    turnState: updatedTurnState,
    consecutivePasses: 0,
    // Clear combat state when leaving combat phase
    combatState: next.phase === Phase.Combat ? state.combatState : null,
  };

  // Phase change event
  allEvents.push({
    type: "phaseChanged",
    phase: next.phase,
    step: next.step,
    timestamp: Date.now(),
  });

  // Step-specific actions
  if (next.step === Step.Untap) {
    const untapResult = untapStep(updatedState);
    updatedState = untapResult.state;
    allEvents.push(...untapResult.events);
    // Untap step: no priority — immediately advance
    updatedState = { ...updatedState, priorityPlayerId: null };
  } else if (next.step === Step.Draw) {
    const drawResult = drawStep(updatedState);
    updatedState = drawResult.state;
    allEvents.push(...drawResult.events);
    // Grant priority to active player after draw
    updatedState = { ...updatedState, priorityPlayerId: updatedState.activePlayerId };
  } else if (next.step === Step.DeclareBlockers) {
    // Defending player gets priority to declare blockers
    const activePlayers = updatedState.players.filter((p) => !p.hasLost);
    const defendingPlayer = activePlayers.find((p) => p.id !== updatedState.activePlayerId);
    updatedState = {
      ...updatedState,
      priorityPlayerId: defendingPlayer?.id ?? updatedState.activePlayerId,
    };
  } else if (next.step === Step.CombatDamage) {
    // Combat damage step: calculate and apply damage.
    // If first/double strike creatures exist, do first strike damage first,
    // then run SBAs (killing creatures), then regular damage.
    if (updatedState.combatState) {
      const hasFS = hasFirstStrikeCreatures(updatedState);

      if (hasFS) {
        // First strike damage sub-step
        const fsAssignments = calculateCombatDamage(updatedState, true);
        if (fsAssignments.length > 0) {
          const fsResult = applyCombatDamage(updatedState, fsAssignments);
          updatedState = fsResult.state;
          allEvents.push(...fsResult.events);

          // Run SBAs between first strike and regular damage
          // (creatures killed by first strike won't deal regular damage)
          const sbaResult = processStateBasedActionsLoop(updatedState);
          updatedState = sbaResult.state;
          allEvents.push(...sbaResult.events);
        }
      }

      // Regular combat damage
      const assignments = calculateCombatDamage(updatedState, false);
      if (assignments.length > 0) {
        const damageResult = applyCombatDamage(updatedState, assignments);
        updatedState = damageResult.state;
        allEvents.push(...damageResult.events);
      }
    }
    updatedState = { ...updatedState, priorityPlayerId: updatedState.activePlayerId };
  } else if (next.step === Step.EndOfCombat) {
    // End of combat: clear combat state
    updatedState = { ...updatedState, combatState: null, priorityPlayerId: updatedState.activePlayerId };
  } else if (next.step === Step.Cleanup) {
    const cleanupResult = cleanupStep(updatedState);
    updatedState = cleanupResult.state;
    allEvents.push(...cleanupResult.events);
    // Cleanup: normally no priority
    updatedState = { ...updatedState, priorityPlayerId: null };
  } else {
    // All other steps/phases: grant priority to active player
    updatedState = { ...updatedState, priorityPlayerId: updatedState.activePlayerId };
  }

  return { state: updatedState, events: allEvents };
}

// ---------------------------------------------------------------------------
// Turn transition
// ---------------------------------------------------------------------------

/** Start the next player's turn. */
function startNextTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const activePlayers = state.players.filter((p) => !p.hasLost);
  const currentIndex = activePlayers.findIndex((p) => p.id === state.activePlayerId);
  const nextPlayer = activePlayers[(currentIndex + 1) % activePlayers.length];

  const newTurnNumber = state.turnNumber + 1;

  // Reset per-turn player state
  const updatedPlayers = emptyAllManaPools(state.players).map((p) => ({
    ...p,
    landsPlayedThisTurn: 0,
  }));

  const turnState: TurnState = {
    turnNumber: newTurnNumber,
    activePlayerId: nextPlayer.id,
    phase: Phase.Beginning,
    step: Step.Untap,
    hasDeclaredAttackers: false,
    hasDeclaredBlockers: false,
    priorityPassedWithoutAction: [],
  };

  const turnFlags = {
    landsPlayedThisTurn: Object.fromEntries(state.players.map((p) => [p.id, 0])),
    spellsCastThisTurn: Object.fromEntries(state.players.map((p) => [p.id, 0])),
  };

  const events: GameEvent[] = [
    {
      type: "turnBegan",
      turnNumber: newTurnNumber,
      activePlayerId: nextPlayer.id,
      timestamp: Date.now(),
    },
    {
      type: "phaseChanged",
      phase: Phase.Beginning,
      step: Step.Untap,
      timestamp: Date.now(),
    },
  ];

  let updatedState: GameState = {
    ...state,
    players: updatedPlayers,
    turnState,
    turnNumber: newTurnNumber,
    activePlayerId: nextPlayer.id,
    priorityPlayerId: null, // Untap step: no priority
    consecutivePasses: 0,
    combatState: null,
    turnFlags,
  };

  // Perform untap for the new active player
  const untapResult = untapStep(updatedState);
  updatedState = untapResult.state;
  events.push(...untapResult.events);

  return { state: updatedState, events };
}

/**
 * Advance past no-priority steps (untap, cleanup) until we reach a step
 * where a player gets priority. Used by the game loop after advancePhase.
 */
export function advanceToNextPriorityPoint(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  let currentState = state;
  const allEvents: GameEvent[] = [];

  while (currentState.priorityPlayerId === null && !currentState.gameOver) {
    const result = advancePhase(currentState);
    currentState = result.state;
    allEvents.push(...result.events);
  }

  return { state: currentState, events: allEvents };
}
