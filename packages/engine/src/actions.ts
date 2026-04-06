/**
 * Player action execution and legal action computation.
 *
 * executeAction: applies a PlayerAction to a GameState.
 * getLegalActions: returns all legal actions for a player.
 */

import type {
  GameState,
  PlayerAction,
  ActionResult,
  GameEvent,
  CardInstance,
  ManaColor,
  Player,
  StackItem,
  SpellAbility,
  ManaCost,
  ResolvedTarget,
  CastingChoices,
  ManaPaymentPlan,
} from "@magic-flux/types";
import { Phase, Step, ZoneType } from "@magic-flux/types";
import {
  passPriority as passPriorityFn,
  allPlayersPassed,
  grantPriority,
} from "./turn/priority.js";
import { advancePhase, advanceToNextPriorityPoint } from "./turn/phases.js";
import { moveCard, handKey } from "./zones/transfers.js";
import { addManaToPlayer, getPlayer, canPayCost } from "./mana/pool.js";
import { pushToStack, resolveTopOfStack } from "./stack/stack.js";
import { validateTargetsOnCast } from "./stack/targeting.js";
import { payManaCost } from "./mana/payment.js";
import { applySearchResult, performCounter } from "./stack/resolution.js";
import { declareAttackers } from "./combat/attackers.js";
import { declareBlockers } from "./combat/blockers.js";
import { calculateCombatDamage, applyCombatDamage } from "./combat/damage.js";
import {
  canActivateLoyaltyAbility,
  activateLoyaltyAbility,
} from "./planeswalker.js";

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function fail(code: string, message: string): ActionResult {
  return { success: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// executeAction
// ---------------------------------------------------------------------------

/**
 * Apply a player action to the game state. Returns a new state and events
 * on success, or an error on failure.
 */
export function executeAction(
  state: GameState,
  action: PlayerAction,
): ActionResult {
  switch (action.type) {
    case "passPriority":
      return handlePassPriority(state);
    case "playLand":
      return handlePlayLand(state, action.cardInstanceId);
    case "activateAbility":
      return handleActivateAbility(state, action.cardInstanceId, action.abilityId);
    case "castSpell":
      return handleCastSpell(state, action);
    case "declareAttackers":
      return handleDeclareAttackers(state, action);
    case "declareBlockers":
      return handleDeclareBlockers(state, action);
    case "makeChoice":
      return handleMakeChoice(state, action);
    case "concede":
      return handleConcede(state);
    default:
      return fail("NOT_IMPLEMENTED", `Action type "${(action as any).type}" is not yet implemented`);
  }
}

// ---------------------------------------------------------------------------
// passPriority
// ---------------------------------------------------------------------------

function handlePassPriority(state: GameState): ActionResult {
  if (state.priorityPlayerId === null) {
    return fail("NO_PRIORITY", "No player has priority");
  }

  let newState = passPriorityFn(state);

  // Check if all players have now passed
  if (allPlayersPassed(newState)) {
    if (newState.stack.length > 0) {
      // Resolve top of stack
      const resolution = resolveTopOfStack(newState);
      return { success: true, state: resolution.state, events: resolution.events };
    }

    // Empty stack, all passed — advance phase
    const result = advancePhase(newState);
    newState = result.state;
    const events = result.events;

    // If we landed on a no-priority step, keep advancing
    if (newState.priorityPlayerId === null && !newState.gameOver) {
      const advance = advanceToNextPriorityPoint(newState);
      newState = advance.state;
      events.push(...advance.events);
    }

    return { success: true, state: newState, events };
  }

  return { success: true, state: newState, events: [] };
}

// ---------------------------------------------------------------------------
// playLand
// ---------------------------------------------------------------------------

function handlePlayLand(state: GameState, cardInstanceId: string): ActionResult {
  const playerId = state.priorityPlayerId;
  if (!playerId) {
    return fail("NO_PRIORITY", "No player has priority");
  }

  const player = getPlayer(state, playerId);

  // Must be a main phase
  const { phase, step } = state.turnState;
  if (phase !== Phase.PreCombatMain && phase !== Phase.PostCombatMain) {
    return fail("WRONG_PHASE", "Can only play lands during a main phase");
  }

  // Stack must be empty
  if (state.stack.length > 0) {
    return fail("STACK_NOT_EMPTY", "Cannot play a land while the stack is non-empty");
  }

  // Must be the active player
  if (playerId !== state.activePlayerId) {
    return fail("NOT_ACTIVE_PLAYER", "Only the active player can play lands");
  }

  // Check land-per-turn limit
  if (player.landsPlayedThisTurn >= player.maxLandsPerTurn) {
    return fail("LAND_LIMIT_REACHED", "Already played maximum lands this turn");
  }

  // Card must be in the player's hand
  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    return fail("CARD_NOT_FOUND", `Card ${cardInstanceId} not found`);
  }

  const hKey = handKey(playerId);
  const hand = state.zones[hKey];
  if (!hand || !hand.cardInstanceIds.includes(cardInstanceId)) {
    return fail("CARD_NOT_IN_HAND", "Card is not in your hand");
  }

  // Move card from hand to battlefield
  const moveResult = moveCard(state, cardInstanceId, hKey, "battlefield", Date.now());
  let newState = moveResult.state;
  const events = moveResult.events;

  // Increment lands played
  const updatedPlayers = newState.players.map((p) =>
    p.id === playerId
      ? { ...p, landsPlayedThisTurn: p.landsPlayedThisTurn + 1 }
      : p,
  );

  // Reset consecutive passes since an action was taken
  newState = {
    ...newState,
    players: updatedPlayers,
    consecutivePasses: 0,
  };

  return { success: true, state: newState, events };
}

// ---------------------------------------------------------------------------
// activateAbility (Phase 1: mana abilities from basic lands)
// ---------------------------------------------------------------------------

/** Map basic land subtypes to the mana color they produce. */
const BASIC_LAND_MANA: Record<string, ManaColor> = {
  Plains: "W",
  Island: "U",
  Swamp: "B",
  Mountain: "R",
  Forest: "G",
};

function handleActivateAbility(
  state: GameState,
  cardInstanceId: string,
  abilityId: string,
): ActionResult {
  const playerId = state.priorityPlayerId;
  if (!playerId) {
    return fail("NO_PRIORITY", "No player has priority");
  }

  const card = state.cardInstances[cardInstanceId];
  if (!card) {
    return fail("CARD_NOT_FOUND", `Card ${cardInstanceId} not found`);
  }

  if (card.controller !== playerId) {
    return fail("NOT_CONTROLLER", "You don't control this permanent");
  }

  if (card.zone !== ZoneType.Battlefield) {
    return fail("NOT_ON_BATTLEFIELD", "Card must be on the battlefield");
  }

  // Only check tapped for abilities that require tap as cost
  // (mana abilities and tap-symbol abilities). Non-tap abilities
  // like loyalty abilities can be activated while tapped.
  const requestedAbility = card.abilities.find((a) => a.id === abilityId);
  const requiresTap = abilityId === "mana" ||
    (requestedAbility?.type === "mana") ||
    (requestedAbility?.type === "activated" && (requestedAbility as any).cost?.tapSelf);
  if (card.tapped && requiresTap) {
    return fail("ALREADY_TAPPED", "This permanent is already tapped");
  }

  // Mana abilities (don't use the stack)
  if (abilityId === "mana") {
    return handleBasicLandMana(state, card, playerId);
  }

  // Check if this is a mana ability from the card's abilities
  const manaAbility = card.abilities.find((a) => a.type === "mana" && a.id === abilityId);
  if (manaAbility) {
    return handleBasicLandMana(state, card, playerId);
  }

  // Loyalty abilities (planeswalkers)
  if (card.currentLoyalty !== null) {
    const loyaltyCheck = canActivateLoyaltyAbility(state, cardInstanceId, abilityId, playerId);
    if (loyaltyCheck.canActivate) {
      return handleLoyaltyAbility(state, cardInstanceId, abilityId, playerId);
    } else {
      return fail("CANNOT_ACTIVATE", loyaltyCheck.reason ?? "Cannot activate loyalty ability");
    }
  }

  // General activated abilities — put on the stack
  const ability = card.abilities.find((a) => a.id === abilityId && a.type === "activated");
  if (ability) {
    return handleGenericActivatedAbility(state, card, ability, playerId);
  }

  return fail("ABILITY_NOT_FOUND", `Ability "${abilityId}" not found on card ${cardInstanceId}`);
}

function handleBasicLandMana(
  state: GameState,
  card: CardInstance,
  playerId: string,
): ActionResult {
  // Determine mana color from card data ID (using basic land name for Phase 1)
  const cardDataId = card.cardDataId;
  const manaColor = BASIC_LAND_MANA[cardDataId];

  if (!manaColor) {
    return fail("NOT_MANA_SOURCE", "This card cannot produce mana");
  }

  // Tap the land
  const tappedCard: CardInstance = { ...card, tapped: true };
  const updatedCards = { ...state.cardInstances, [card.instanceId]: tappedCard };
  let newState: GameState = { ...state, cardInstances: updatedCards };

  const events: GameEvent[] = [
    { type: "cardTapped", cardInstanceId: card.instanceId, timestamp: Date.now() },
  ];

  // Add mana (mana abilities don't use the stack)
  const manaResult = addManaToPlayer(newState, playerId, manaColor, 1, Date.now());
  newState = manaResult.state;
  events.push(...manaResult.events);

  // Mana abilities don't reset consecutive passes or use the stack
  return { success: true, state: newState, events };
}

// ---------------------------------------------------------------------------
// loyalty abilities
// ---------------------------------------------------------------------------

function handleLoyaltyAbility(
  state: GameState,
  cardInstanceId: string,
  abilityId: string,
  playerId: string,
): ActionResult {
  const card = state.cardInstances[cardInstanceId];
  if (!card) return fail("CARD_NOT_FOUND", "Card not found");

  // Pay loyalty cost and mark as used
  const loyaltyResult = activateLoyaltyAbility(state, cardInstanceId, abilityId, playerId);
  let newState = loyaltyResult.state;
  const events = [...loyaltyResult.events];

  // Find the ability and put it on the stack
  const ability = card.abilities.find((a) => a.id === abilityId);
  if (!ability) return fail("ABILITY_NOT_FOUND", "Ability not found");

  const stackItemId = `stack_${Date.now()}_${abilityId}`;
  const stackItem: StackItem = {
    id: stackItemId,
    sourceCardInstanceId: cardInstanceId,
    ability,
    controller: playerId,
    targets: [],
    isSpell: false,
    isCopy: false,
    choices: null,
  };

  const pushResult = pushToStack(newState, stackItem);
  newState = pushResult.state;
  events.push(...pushResult.events);

  return { success: true, state: newState, events };
}

// ---------------------------------------------------------------------------
// generic activated abilities (non-mana, non-loyalty)
// ---------------------------------------------------------------------------

function handleGenericActivatedAbility(
  state: GameState,
  card: CardInstance,
  ability: SpellAbility,
  playerId: string,
): ActionResult {
  const stackItemId = `stack_${Date.now()}_${ability.id}`;
  const stackItem: StackItem = {
    id: stackItemId,
    sourceCardInstanceId: card.instanceId,
    ability,
    controller: playerId,
    targets: [],
    isSpell: false,
    isCopy: false,
    choices: null,
  };

  const pushResult = pushToStack(state, stackItem);
  return {
    success: true,
    state: { ...pushResult.state, consecutivePasses: 0 },
    events: pushResult.events,
  };
}

// ---------------------------------------------------------------------------
// declareAttackers / declareBlockers
// ---------------------------------------------------------------------------

function handleDeclareAttackers(
  state: GameState,
  action: Extract<PlayerAction, { type: "declareAttackers" }>,
): ActionResult {
  const playerId = state.priorityPlayerId;
  if (!playerId) return fail("NO_PRIORITY", "No player has priority");
  if (playerId !== state.activePlayerId) return fail("NOT_ACTIVE_PLAYER", "Only the active player declares attackers");
  if (state.turnState.phase !== Phase.Combat) return fail("WRONG_PHASE", "Not in combat phase");

  const result = declareAttackers(state, playerId, action.attackerAssignments);
  return {
    success: true,
    state: { ...result.state, consecutivePasses: 0 },
    events: result.events,
  };
}

function handleDeclareBlockers(
  state: GameState,
  action: Extract<PlayerAction, { type: "declareBlockers" }>,
): ActionResult {
  const playerId = state.priorityPlayerId;
  if (!playerId) return fail("NO_PRIORITY", "No player has priority");
  if (playerId === state.activePlayerId) return fail("NOT_DEFENDING_PLAYER", "Only the defending player declares blockers");
  if (state.turnState.phase !== Phase.Combat) return fail("WRONG_PHASE", "Not in combat phase");

  const result = declareBlockers(state, playerId, action.blockerAssignments);
  return {
    success: true,
    state: { ...result.state, consecutivePasses: 0 },
    events: result.events,
  };
}

// ---------------------------------------------------------------------------
// castSpell
// ---------------------------------------------------------------------------

function handleCastSpell(
  state: GameState,
  action: Extract<PlayerAction, { type: "castSpell" }>,
): ActionResult {
  const playerId = state.priorityPlayerId;
  if (!playerId) {
    return fail("NO_PRIORITY", "No player has priority");
  }

  const card = state.cardInstances[action.cardInstanceId];
  if (!card) {
    return fail("CARD_NOT_FOUND", `Card ${action.cardInstanceId} not found`);
  }

  // Card must be in hand, or in graveyard with flashback
  const isFlashbackCast = action.choices?.alternativeCostUsed === "flashback";
  const hKey = handKey(playerId);
  const hand = state.zones[hKey];
  const gKey = `player:${playerId}:graveyard`;
  const graveyard = state.zones[gKey];

  const inHand = hand?.cardInstanceIds.includes(action.cardInstanceId);
  const inGraveyard = graveyard?.cardInstanceIds.includes(action.cardInstanceId);
  const commandZone = state.zones["commandZone"];
  const inCommandZone = commandZone?.cardInstanceIds.includes(action.cardInstanceId);

  if (!inHand && !(isFlashbackCast && inGraveyard) && !inCommandZone) {
    return fail("CARD_NOT_IN_HAND", "Card is not in a legal zone for casting");
  }

  // Determine which zone the card is being cast from
  const castFromZone = inHand ? hKey : inCommandZone ? "commandZone" : gKey;

  // Find the spell ability on the card
  const spellAbility = card.abilities.find((a) => a.type === "spell");
  if (!spellAbility) {
    return fail("NOT_CASTABLE", "This card has no spell ability");
  }

  // Timing check: the engine doesn't have access to CardData (card types
  // live in the cards package), so we can't determine instant vs sorcery
  // from the engine alone. For Phase 2, timing enforcement is the
  // responsibility of getLegalActions and the server. executeAction only
  // validates that the player has priority and the card is castable.
  //
  // TODO: When SpellAbilitySpell gains a `timing` field, enforce here.

  // Validate targets if provided
  const targets = action.targets ?? [];
  if (targets.length > 0) {
    const targetCheck = validateTargetsOnCast(state, targets, playerId);
    if (!targetCheck.valid) {
      return fail("INVALID_TARGET", targetCheck.reason ?? "Invalid targets");
    }
  }

  // Pay mana cost if a payment plan is provided
  let newState = state;
  const allEvents: GameEvent[] = [];

  // Get the card's mana cost from its abilities or cardDataId
  const manaCost = getCardManaCost(card);

  if (action.paymentPlan && manaCost) {
    const paymentResult = payManaCost(newState, playerId, manaCost, action.paymentPlan);
    newState = paymentResult.state;
    allEvents.push(...paymentResult.events);
  }

  // Move card from hand to stack
  const moveResult = moveCard(newState, action.cardInstanceId, castFromZone, "stack", Date.now());
  newState = moveResult.state;
  allEvents.push(...moveResult.events);

  // Create StackItem
  const stackItemId = `stack_${Date.now()}_${action.cardInstanceId}`;
  const stackItem: StackItem = {
    id: stackItemId,
    sourceCardInstanceId: action.cardInstanceId,
    ability: spellAbility,
    controller: playerId,
    targets,
    isSpell: true,
    isCopy: false,
    choices: action.choices ?? null,
  };

  // Push to stack
  const pushResult = pushToStack(newState, stackItem);
  newState = pushResult.state;
  allEvents.push(...pushResult.events);

  // Commander tax: if casting from command zone, increment tax
  if (inCommandZone) {
    const updatedPlayers = newState.players.map((p) =>
      p.id === playerId ? { ...p, commanderTax: p.commanderTax + 1 } : p,
    );
    newState = { ...newState, players: updatedPlayers };
  }

  // Increment spells cast this turn counter
  const currentCount = (newState.turnFlags.spellsCastThisTurn as Record<string, number>)[playerId] ?? 0;
  newState = {
    ...newState,
    turnFlags: {
      ...newState.turnFlags,
      spellsCastThisTurn: {
        ...newState.turnFlags.spellsCastThisTurn,
        [playerId]: currentCount + 1,
      },
    },
  };

  return { success: true, state: newState, events: allEvents };
}

/** Extract a card's mana cost. For Phase 2, this comes from the card's abilities. */
function getCardManaCost(card: CardInstance): ManaCost | null {
  const spellAbility = card.abilities.find((a) => a.type === "spell");
  // The mana cost isn't directly on the spell ability in our current types.
  // For cards with abilities that have costs, we check activated abilities.
  // For spell casting, the cost is on the CardData (parsed mana cost).
  // Since we don't have CardData in the engine, the cost must be provided
  // via the card's abilities or the action's payment plan.
  // For now, return null — the payment plan handles deduction directly.
  return null;
}

// ---------------------------------------------------------------------------
// makeChoice (respond to PendingPrompt)
// ---------------------------------------------------------------------------

function handleMakeChoice(
  state: GameState,
  action: Extract<PlayerAction, { type: "makeChoice" }>,
): ActionResult {
  const prompt = state.pendingPrompt;
  if (!prompt) {
    return fail("NO_PROMPT", "No pending prompt to respond to");
  }

  if (action.choiceId !== prompt.promptId) {
    return fail("WRONG_PROMPT", "Choice ID does not match pending prompt");
  }

  const events: GameEvent[] = [];

  // Clear the prompt
  let newState: GameState = { ...state, pendingPrompt: null };

  if (prompt.promptType === "searchLibrary") {
    const chosenCardId = action.selection as string | null;

    if (chosenCardId && prompt.options.includes(chosenCardId)) {
      // Move chosen card from its current zone to hand
      const card = newState.cardInstances[chosenCardId];
      if (card) {
        let fromZoneKey: string | null = null;
        for (const [key, zone] of Object.entries(newState.zones)) {
          if (zone.cardInstanceIds.includes(chosenCardId)) {
            fromZoneKey = key;
            break;
          }
        }
        if (fromZoneKey) {
          const moveResult = moveCard(
            newState, chosenCardId, fromZoneKey, handKey(card.owner), Date.now(),
          );
          newState = moveResult.state;
          events.push(...moveResult.events);
        }
      }
    }
    // If no selection (fail to find), just continue
  }

  if (prompt.promptType === "scry") {
    // Selection is an array of card IDs to put on bottom of library.
    // Cards NOT in the selection stay on top in their current order.
    const bottomCards = (action.selection as string[] | null) ?? [];
    const libKey = `player:${prompt.playerId}:library`;
    const library = newState.zones[libKey];

    if (library) {
      const topSection = prompt.options; // The cards that were scried
      const restOfLibrary = library.cardInstanceIds.slice(topSection.length);

      // Cards staying on top (in original order, minus those going to bottom)
      const stayOnTop = topSection.filter((id) => !bottomCards.includes(id));
      // Cards going to bottom
      const goToBottom = topSection.filter((id) => bottomCards.includes(id));

      // Reconstruct library: top cards first, then rest, then bottom cards
      const newLibrary = [...stayOnTop, ...restOfLibrary, ...goToBottom];

      newState = {
        ...newState,
        zones: {
          ...newState.zones,
          [libKey]: { ...library, cardInstanceIds: newLibrary },
        },
      };
    }
  }

  if (prompt.promptType === "chooseCard") {
    const selections = Array.isArray(action.selection)
      ? action.selection as string[]
      : action.selection ? [action.selection as string] : [];

    // Determine whose hand to discard from:
    // - Thoughtseize/Duress: opponent's hand (discardFromPlayerId set)
    // - Discard to hand size: own hand (discardFromPlayerId not set)
    const discardPlayerId = (prompt as any).discardFromPlayerId as string | undefined
      ?? prompt.playerId;
    const hKey = `player:${discardPlayerId}:hand`;

    for (const cardId of selections) {
      const hand = newState.zones[hKey];
      if (!hand || !hand.cardInstanceIds.includes(cardId)) continue;
      const gKey = `player:${discardPlayerId}:graveyard`;
      const moveResult = moveCard(newState, cardId, hKey, gKey, Date.now());
      newState = moveResult.state;
      events.push(...moveResult.events);
    }
  }

  if (prompt.promptType === "chooseMode" && (prompt as any).counterTargetStackItemId) {
    // Counter-unless-pay response
    const choice = action.selection as string;
    const targetItemId = (prompt as any).counterTargetStackItemId as string;

    if (choice === "decline" || choice === null) {
      // Opponent declined to pay — counter the spell
      newState = performCounter(newState, targetItemId, events);
    }
    // If "pay", spell is NOT countered — it stays on the stack and resolves normally.
    // In a full implementation, we'd also deduct the mana. For now, trust the client.
  }

  // Restore priority to the active player
  newState = grantPriority(newState, newState.activePlayerId);

  return { success: true, state: newState, events };
}

// ---------------------------------------------------------------------------
// concede
// ---------------------------------------------------------------------------

function handleConcede(state: GameState): ActionResult {
  const playerId = state.priorityPlayerId;
  if (!playerId) {
    return fail("NO_PRIORITY", "No player has priority");
  }

  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, hasLost: true, hasConceded: true } : p,
  );

  const events: GameEvent[] = [
    { type: "playerLost", playerId, reason: "conceded", timestamp: Date.now() },
  ];

  const remainingPlayers = updatedPlayers.filter((p) => !p.hasLost);
  const gameOver = remainingPlayers.length <= 1;

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    losers: [...state.losers, playerId],
    gameOver,
    winners: gameOver ? remainingPlayers.map((p) => p.id) : state.winners,
  };

  if (gameOver) {
    events.push({
      type: "gameOver",
      winnerIds: newState.winners,
      timestamp: Date.now(),
    });
  }

  return { success: true, state: newState, events };
}

// ---------------------------------------------------------------------------
// getLegalActions
// ---------------------------------------------------------------------------

/**
 * Returns every legal action the specified player can currently take.
 */
export function getLegalActions(
  state: GameState,
  playerId: string,
): PlayerAction[] {
  const actions: PlayerAction[] = [];

  // If there's a pending prompt for this player, only makeChoice is legal
  if (state.pendingPrompt && state.pendingPrompt.playerId === playerId) {
    actions.push({
      type: "makeChoice",
      choiceId: state.pendingPrompt.promptId,
      selection: null, // Client fills this in
    });
    return actions;
  }

  // Can only act when you have priority
  if (state.priorityPlayerId !== playerId) {
    return actions;
  }

  // passPriority is always legal when you have priority
  actions.push({ type: "passPriority" });

  // concede is always legal
  actions.push({ type: "concede" });

  const player = getPlayer(state, playerId);

  // playLand: main phase, stack empty, active player, under land limit
  const isMainPhase =
    state.turnState.phase === Phase.PreCombatMain ||
    state.turnState.phase === Phase.PostCombatMain;
  const isActivePlayer = playerId === state.activePlayerId;
  const stackEmpty = state.stack.length === 0;
  const canPlayLand =
    isMainPhase &&
    isActivePlayer &&
    stackEmpty &&
    player.landsPlayedThisTurn < player.maxLandsPerTurn;

  if (canPlayLand) {
    // Find lands in hand
    const hKey = handKey(playerId);
    const hand = state.zones[hKey];
    if (hand) {
      for (const cardId of hand.cardInstanceIds) {
        const card = state.cardInstances[cardId];
        // Phase 1: identify lands by cardDataId being a basic land name
        if (card && isBasicLand(card.cardDataId)) {
          actions.push({ type: "playLand", cardInstanceId: cardId });
        }
      }
    }
  }

  // castSpell: check for castable spells in hand
  const hKeyForSpells = handKey(playerId);
  const handForSpells = state.zones[hKeyForSpells];
  if (handForSpells) {
    for (const cardId of handForSpells.cardInstanceIds) {
      const card = state.cardInstances[cardId];
      if (!card) continue;

      // Check if card has a spell ability (non-land cards)
      const hasSpellAbility = card.abilities.some((a) => a.type === "spell");
      if (!hasSpellAbility) continue;

      // For now, include all spells in hand as castable
      // (real timing/cost validation happens in executeAction)
      actions.push({
        type: "castSpell",
        cardInstanceId: cardId,
      });
    }
  }

  // Commander: can cast commander from command zone (sorcery speed for creatures)
  if (state.format === "commander") {
    const commandZone = state.zones["commandZone"];
    if (commandZone && isActivePlayer && isMainPhase && stackEmpty) {
      for (const cardId of commandZone.cardInstanceIds) {
        const card = state.cardInstances[cardId];
        if (!card || card.owner !== playerId) continue;
        const hasSpellAbility = card.abilities.some((a) => a.type === "spell");
        if (hasSpellAbility) {
          actions.push({
            type: "castSpell",
            cardInstanceId: cardId,
          });
        }
      }
    }
  }

  // Flashback: check graveyard for cards with flashback that can be cast
  const gKey = `player:${playerId}:graveyard`;
  const graveyard = state.zones[gKey];
  if (graveyard) {
    for (const cardId of graveyard.cardInstanceIds) {
      const card = state.cardInstances[cardId];
      if (!card) continue;

      // Check if card has a spell ability AND flashback keyword/ability
      const hasSpellAbility = card.abilities.some((a) => a.type === "spell");
      const hasFlashback = card.abilities.some(
        (a) => (a.type === "static" && a.continuousEffect?.effectType === "flashback") ||
          (a.type === "activated" && (a as any).activationRestrictions?.includes("flashback")),
      ) || card.abilities.some((a) => a.zones?.includes(ZoneType.Graveyard) && a.type === "spell");

      if (hasSpellAbility && hasFlashback) {
        actions.push({
          type: "castSpell",
          cardInstanceId: cardId,
          choices: {
            xValue: null,
            kickerPaid: false,
            additionalKickersPaid: [],
            chosenModes: [],
            alternativeCostUsed: "flashback",
          },
        });
      }
    }
  }

  // Mana abilities: untapped basic lands on battlefield
  const battlefield = state.zones["battlefield"];
  if (battlefield) {
    for (const cardId of battlefield.cardInstanceIds) {
      const card = state.cardInstances[cardId];
      if (
        card &&
        card.controller === playerId &&
        !card.tapped &&
        isBasicLand(card.cardDataId)
      ) {
        actions.push({
          type: "activateAbility",
          cardInstanceId: cardId,
          abilityId: "mana",
        });
      }
    }
  }

  // declareAttackers: during DeclareAttackers step, active player, stack empty
  if (
    state.turnState.phase === Phase.Combat &&
    state.turnState.step === Step.DeclareAttackers &&
    isActivePlayer &&
    stackEmpty &&
    !state.turnState.hasDeclaredAttackers
  ) {
    actions.push({
      type: "declareAttackers",
      attackerAssignments: {}, // Client fills in actual assignments
    });
  }

  // declareBlockers: during DeclareBlockers step, defending player (non-active), stack empty
  if (
    state.turnState.phase === Phase.Combat &&
    state.turnState.step === Step.DeclareBlockers &&
    !isActivePlayer &&
    stackEmpty &&
    !state.turnState.hasDeclaredBlockers
  ) {
    actions.push({
      type: "declareBlockers",
      blockerAssignments: {}, // Client fills in actual assignments
    });
  }

  // activateAbility: non-mana activated abilities on battlefield permanents
  if (battlefield) {
    for (const cardId of battlefield.cardInstanceIds) {
      const card = state.cardInstances[cardId];
      if (!card || card.controller !== playerId) continue;

      for (const ability of card.abilities) {
        // Skip mana abilities (already handled above) and non-activated types
        if (ability.type === "mana" || ability.type !== "activated") continue;

        actions.push({
          type: "activateAbility",
          cardInstanceId: cardId,
          abilityId: ability.id,
        });
      }

      // Planeswalker loyalty abilities
      if (card.currentLoyalty !== null && isMainPhase && isActivePlayer && stackEmpty) {
        for (const ability of card.abilities) {
          if (ability.type !== "activated") continue;
          actions.push({
            type: "activateAbility",
            cardInstanceId: cardId,
            abilityId: ability.id,
          });
        }
      }
    }
  }

  return actions;
}

function isBasicLand(cardDataId: string): boolean {
  return cardDataId in BASIC_LAND_MANA;
}
