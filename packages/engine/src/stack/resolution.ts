/**
 * Effect resolution — dispatch effects to type-specific handlers.
 *
 * When a stack item resolves, each of its effects is applied in order.
 * Effects reference targets via TargetRef, which are resolved against
 * the stack item's chosen targets.
 */

import type {
  GameState,
  GameEvent,
  StackItem,
  Effect,
  TargetRef,
  PlayerRef,
  ManaPool,
  CardInstance,
  Player,
  SpellAbility,
  TokenDefinition,
  Condition,
  CardSelector,
  CardFilter,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { moveCard, graveyardKey, drawCard } from "../zones/transfers.js";
import { addManaToPlayer, getPlayer, EMPTY_MANA_POOL } from "../mana/pool.js";
import { cardHasKeyword } from "../combat/keywords.js";

interface ResolutionContext {
  state: GameState;
  events: GameEvent[];
  item: StackItem;
  legalTargetIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Target/Player resolution helpers
// ---------------------------------------------------------------------------

function resolveTargetId(ctx: ResolutionContext, ref: TargetRef): string | null {
  const matching = ctx.item.targets.filter(
    (t) => t.requirementId === ref.targetRequirementId,
  );
  const target = matching[ref.index ?? 0];
  if (!target) return null;
  if (!ctx.legalTargetIds.has(target.targetId) && ctx.item.targets.length > 0) {
    return null; // Target became illegal
  }
  return target.targetId;
}

function resolvePlayerId(ctx: ResolutionContext, ref: PlayerRef): string | null {
  switch (ref.type) {
    case "controller":
      return ctx.item.controller;
    case "owner": {
      const card = ctx.state.cardInstances[ctx.item.sourceCardInstanceId];
      return card?.owner ?? null;
    }
    case "activePlayer":
      return ctx.state.activePlayerId;
    case "specific":
      return ref.playerId;
    case "targetPlayer": {
      const targetId = resolveTargetId(ctx, ref.targetRef);
      return targetId; // For player targets, the targetId IS the playerId
    }
  }
}

function resolveNumber(value: number | { countOf: any } | { variable: string }, ctx: ResolutionContext): number {
  if (typeof value === "number") return value;
  if ("variable" in value && value.variable === "X") {
    return ctx.item.choices?.xValue ?? 0;
  }
  // countOf — not implemented for Phase 2
  return 0;
}

// ---------------------------------------------------------------------------
// resolveStackItem
// ---------------------------------------------------------------------------

/**
 * Resolve a stack item: apply each effect in order to the game state.
 */
export function resolveStackItem(
  state: GameState,
  item: StackItem,
  legalTargetIds: Set<string>,
): { state: GameState; events: GameEvent[] } {
  const ctx: ResolutionContext = {
    state,
    events: [],
    item,
    legalTargetIds,
  };

  for (const effect of item.ability.effects) {
    resolveEffect(ctx, effect);
  }

  return { state: ctx.state, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Effect dispatcher
// ---------------------------------------------------------------------------

function resolveEffect(ctx: ResolutionContext, effect: Effect): void {
  switch (effect.type) {
    case "dealDamage":
      resolveDealDamage(ctx, effect);
      break;
    case "destroy":
      resolveDestroy(ctx, effect);
      break;
    case "drawCards":
      resolveDrawCards(ctx, effect);
      break;
    case "gainLife":
      resolveGainLife(ctx, effect);
      break;
    case "loseLife":
      resolveLoseLife(ctx, effect);
      break;
    case "addMana":
      resolveAddMana(ctx, effect);
      break;
    case "bounce":
      resolveBounce(ctx, effect);
      break;
    case "counter":
      resolveCounter(ctx, effect);
      break;
    case "modifyPT":
      resolveModifyPT(ctx, effect);
      break;
    case "composite":
      for (const sub of effect.effects) {
        resolveEffect(ctx, sub);
      }
      break;
    case "exile":
      resolveExile(ctx, effect);
      break;
    case "discardCards":
      resolveDiscardCards(ctx, effect);
      break;
    case "createToken":
      resolveCreateToken(ctx, effect);
      break;
    case "sacrifice":
      resolveSacrifice(ctx, effect);
      break;
    case "tap":
      resolveTap(ctx, effect);
      break;
    case "untap":
      resolveUntap(ctx, effect);
      break;
    case "addCounters":
      resolveAddCounters(ctx, effect);
      break;
    case "removeCounters":
      resolveRemoveCounters(ctx, effect);
      break;
    case "grantAbility":
      resolveGrantAbility(ctx, effect);
      break;
    case "conditional":
      resolveConditional(ctx, effect);
      break;
    case "forEach":
      resolveForEach(ctx, effect);
      break;
    case "playerChoice":
    case "search":
    case "preventDamage":
    case "copy":
      // These complex effects need player-choice infrastructure or replacement effects
      break;
    case "custom":
      resolveCustom(ctx, effect);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Individual effect handlers
// ---------------------------------------------------------------------------

function resolveDealDamage(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "dealDamage" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.to);
  if (!targetId) return;

  const amount = resolveNumber(effect.amount, ctx);
  if (amount <= 0) return;

  // Check if target is a player or a card
  const player = ctx.state.players.find((p) => p.id === targetId);
  if (player) {
    // Damage to player = life loss
    const newLife = player.life - amount;
    const updatedPlayers = ctx.state.players.map((p) =>
      p.id === targetId ? { ...p, life: newLife } : p,
    );
    ctx.state = { ...ctx.state, players: updatedPlayers };
    ctx.events.push({
      type: "lifeChanged",
      playerId: targetId,
      oldLife: player.life,
      newLife,
      reason: "damage",
      timestamp: Date.now(),
    });
    ctx.events.push({
      type: "damageDealt",
      sourceInstanceId: ctx.item.sourceCardInstanceId,
      targetRef: { targetId, targetType: "player" },
      amount,
      isCombatDamage: false,
      isDeathtouch: false,
      timestamp: Date.now(),
    });
  } else {
    // Damage to a creature — mark damage on the card
    const card = ctx.state.cardInstances[targetId];
    if (!card) return;
    const updatedCard: CardInstance = { ...card, damage: card.damage + amount };
    ctx.state = {
      ...ctx.state,
      cardInstances: { ...ctx.state.cardInstances, [targetId]: updatedCard },
    };
    ctx.events.push({
      type: "damageDealt",
      sourceInstanceId: ctx.item.sourceCardInstanceId,
      targetRef: { targetId, targetType: "card" },
      amount,
      isCombatDamage: false,
      isDeathtouch: false,
      timestamp: Date.now(),
    });
  }
}

function resolveDestroy(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "destroy" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;

  const owner = card.owner;
  const moveResult = moveCard(
    ctx.state,
    targetId,
    "battlefield",
    graveyardKey(owner),
    Date.now(),
  );
  ctx.state = moveResult.state;
  ctx.events.push(...moveResult.events);
  ctx.events.push({
    type: "cardDestroyed",
    cardInstanceId: targetId,
    timestamp: Date.now(),
  });
}

function resolveDrawCards(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "drawCards" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  const count = resolveNumber(effect.count, ctx);
  for (let i = 0; i < count; i++) {
    const result = drawCard(ctx.state, playerId, Date.now());
    ctx.state = result.state;
    ctx.events.push(...result.events);
  }
}

function resolveGainLife(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "gainLife" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  const amount = resolveNumber(effect.amount, ctx);
  const player = ctx.state.players.find((p) => p.id === playerId);
  if (!player) return;

  const newLife = player.life + amount;
  const updatedPlayers = ctx.state.players.map((p) =>
    p.id === playerId ? { ...p, life: newLife } : p,
  );
  ctx.state = { ...ctx.state, players: updatedPlayers };
  ctx.events.push({
    type: "lifeChanged",
    playerId,
    oldLife: player.life,
    newLife,
    reason: "gainLife",
    timestamp: Date.now(),
  });
}

function resolveLoseLife(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "loseLife" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  const amount = resolveNumber(effect.amount, ctx);
  const player = ctx.state.players.find((p) => p.id === playerId);
  if (!player) return;

  const newLife = player.life - amount;
  const updatedPlayers = ctx.state.players.map((p) =>
    p.id === playerId ? { ...p, life: newLife } : p,
  );
  ctx.state = { ...ctx.state, players: updatedPlayers };
  ctx.events.push({
    type: "lifeChanged",
    playerId,
    oldLife: player.life,
    newLife,
    reason: "loseLife",
    timestamp: Date.now(),
  });
}

function resolveAddMana(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "addMana" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  const mana = effect.mana;
  const colors = ["W", "U", "B", "R", "G", "C"] as const;
  for (const color of colors) {
    if (mana[color] > 0) {
      const result = addManaToPlayer(ctx.state, playerId, color, mana[color], Date.now());
      ctx.state = result.state;
      ctx.events.push(...result.events);
    }
  }
}

function resolveBounce(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "bounce" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;

  const owner = card.owner;
  // "bounce" typically means return to hand
  const toZoneKey = effect.to === ZoneType.Hand
    ? `player:${owner}:hand`
    : effect.to === ZoneType.Library
      ? `player:${owner}:library`
      : "exile";

  const moveResult = moveCard(ctx.state, targetId, "battlefield", toZoneKey, Date.now());
  ctx.state = moveResult.state;
  ctx.events.push(...moveResult.events);
}

function resolveCounter(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "counter" }>,
): void {
  // Find the targeted spell on the stack
  const matching = ctx.item.targets.filter(
    (t) => t.requirementId === effect.target.targetRequirementId,
  );
  const target = matching[0];
  if (!target) return;

  const targetItemId = target.targetId;
  const targetItem = ctx.state.stackItems[targetItemId];
  if (!targetItem) return;

  // Remove the countered item from the stack
  const updatedStack = ctx.state.stack.filter((id) => id !== targetItemId);
  const { [targetItemId]: _removed, ...remainingItems } = ctx.state.stackItems;

  ctx.state = {
    ...ctx.state,
    stack: updatedStack,
    stackItems: remainingItems,
  };

  // Move the countered spell's card to graveyard
  if (targetItem.isSpell && !targetItem.isCopy) {
    const card = ctx.state.cardInstances[targetItem.sourceCardInstanceId];
    if (card && card.zone === ZoneType.Stack) {
      const moveResult = moveCard(
        ctx.state,
        targetItem.sourceCardInstanceId,
        "stack",
        graveyardKey(card.owner),
        Date.now(),
      );
      ctx.state = moveResult.state;
      ctx.events.push(...moveResult.events);
    }
  }

  ctx.events.push({
    type: "stackItemCountered",
    stackItemId: targetItemId,
    timestamp: Date.now(),
  });
}

function resolveModifyPT(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "modifyPT" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;

  // For "until end of turn" effects, add a continuous effect
  if (effect.duration === "endOfTurn" || effect.duration === "permanent") {
    const continuousEffect = {
      id: `eff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceCardInstanceId: ctx.item.sourceCardInstanceId,
      effect: { power: effect.power, toughness: effect.toughness, targetId },
      affectedFilter: {},
      duration: effect.duration === "endOfTurn"
        ? "endOfTurn" as const
        : "permanent" as const,
      layer: 7,
      subLayer: "c" as const,
      timestamp: Date.now(),
      dependsOn: [],
    };

    ctx.state = {
      ...ctx.state,
      continuousEffects: [...ctx.state.continuousEffects, continuousEffect],
    };
  }

  // Also apply immediately to modifiedPower/modifiedToughness
  const newPower = (card.modifiedPower ?? 0) + effect.power;
  const newToughness = (card.modifiedToughness ?? 0) + effect.toughness;
  const updatedCard: CardInstance = {
    ...card,
    modifiedPower: newPower,
    modifiedToughness: newToughness,
  };
  ctx.state = {
    ...ctx.state,
    cardInstances: { ...ctx.state.cardInstances, [targetId]: updatedCard },
  };
}

function resolveExile(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "exile" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card) return;

  // Find current zone key
  let fromZoneKey: string | null = null;
  for (const [key, zone] of Object.entries(ctx.state.zones)) {
    if (zone.cardInstanceIds.includes(targetId)) {
      fromZoneKey = key;
      break;
    }
  }
  if (!fromZoneKey) return;

  const moveResult = moveCard(ctx.state, targetId, fromZoneKey, "exile", Date.now());
  ctx.state = moveResult.state;
  ctx.events.push(...moveResult.events);
}

function resolveDiscardCards(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "discardCards" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  const count = resolveNumber(effect.count, ctx);
  const handZoneKey = `player:${playerId}:hand`;
  const hand = ctx.state.zones[handZoneKey];
  if (!hand) return;

  const toDiscard = Math.min(count, hand.cardInstanceIds.length);
  for (let i = 0; i < toDiscard; i++) {
    const cardId = ctx.state.zones[handZoneKey].cardInstanceIds[0];
    if (!cardId) break;
    const moveResult = moveCard(ctx.state, cardId, handZoneKey, graveyardKey(playerId), Date.now());
    ctx.state = moveResult.state;
    ctx.events.push(...moveResult.events);
  }
}

// ---------------------------------------------------------------------------
// Tier 1 effect handlers: createToken, sacrifice, tap/untap, counters
// ---------------------------------------------------------------------------

let tokenCounter = 0;

function resolveCreateToken(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "createToken" }>,
): void {
  const controllerId = resolvePlayerId(ctx, effect.controller);
  if (!controllerId) return;

  const count = resolveNumber(effect.count, ctx);
  const tokenDef = effect.token;

  for (let i = 0; i < count; i++) {
    const tokenId = `token_${++tokenCounter}_${Date.now()}`;

    const tokenInstance: CardInstance = {
      instanceId: tokenId,
      cardDataId: `token:${tokenDef.name}`,
      owner: controllerId,
      controller: controllerId,
      zone: ZoneType.Battlefield,
      zoneOwnerId: null,
      tapped: false,
      flipped: false,
      faceDown: false,
      transformedOrBack: false,
      phasedOut: false,
      summoningSickness: true,
      damage: 0,
      counters: {},
      attachedTo: null,
      attachments: [],
      abilities: [...tokenDef.abilities],
      modifiedPower: tokenDef.power,
      modifiedToughness: tokenDef.toughness,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };

    // Add to card instances and battlefield
    const bf = ctx.state.zones["battlefield"];
    ctx.state = {
      ...ctx.state,
      cardInstances: { ...ctx.state.cardInstances, [tokenId]: tokenInstance },
      zones: {
        ...ctx.state.zones,
        battlefield: {
          ...bf,
          cardInstanceIds: [tokenId, ...bf.cardInstanceIds],
        },
      },
    };

    ctx.events.push({
      type: "tokenCreated",
      cardInstanceId: tokenId,
      timestamp: Date.now(),
    });
    ctx.events.push({
      type: "cardEnteredZone",
      cardInstanceId: tokenId,
      toZone: ZoneType.Battlefield,
      fromZone: null,
      timestamp: Date.now(),
    });
  }
}

function resolveSacrifice(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "sacrifice" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  const count = resolveNumber(effect.count, ctx);
  const bf = ctx.state.zones["battlefield"];
  if (!bf) return;

  // Find permanents controlled by the player matching the filter
  const candidates = bf.cardInstanceIds.filter((id) => {
    const card = ctx.state.cardInstances[id];
    if (!card || card.controller !== playerId) return false;
    // TODO: apply effect.filter for type-specific sacrifice
    return true;
  });

  const toSacrifice = Math.min(count, candidates.length);
  for (let i = 0; i < toSacrifice; i++) {
    const cardId = candidates[i];
    const card = ctx.state.cardInstances[cardId];
    if (!card || card.zone !== ZoneType.Battlefield) continue;

    const moveResult = moveCard(
      ctx.state, cardId, "battlefield", graveyardKey(card.owner), Date.now(),
    );
    ctx.state = moveResult.state;
    ctx.events.push(...moveResult.events);
    ctx.events.push({
      type: "cardDestroyed",
      cardInstanceId: cardId,
      timestamp: Date.now(),
    });
  }
}

function resolveTap(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "tap" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card || card.zone !== ZoneType.Battlefield || card.tapped) return;

  ctx.state = {
    ...ctx.state,
    cardInstances: {
      ...ctx.state.cardInstances,
      [targetId]: { ...card, tapped: true },
    },
  };
  ctx.events.push({
    type: "cardTapped",
    cardInstanceId: targetId,
    timestamp: Date.now(),
  });
}

function resolveUntap(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "untap" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card || card.zone !== ZoneType.Battlefield || !card.tapped) return;

  ctx.state = {
    ...ctx.state,
    cardInstances: {
      ...ctx.state.cardInstances,
      [targetId]: { ...card, tapped: false },
    },
  };
  ctx.events.push({
    type: "cardUntapped",
    cardInstanceId: targetId,
    timestamp: Date.now(),
  });
}

function resolveAddCounters(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "addCounters" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card) return;

  const count = resolveNumber(effect.count, ctx);
  const currentCount = card.counters[effect.counterType] ?? 0;
  const newCount = currentCount + count;

  const updatedCard: CardInstance = {
    ...card,
    counters: { ...card.counters, [effect.counterType]: newCount },
  };

  // +1/+1 counters modify P/T
  let finalCard = updatedCard;
  if (effect.counterType === "+1/+1" && card.modifiedPower !== null) {
    finalCard = {
      ...updatedCard,
      modifiedPower: (card.modifiedPower ?? 0) + count,
      modifiedToughness: (card.modifiedToughness ?? 0) + count,
    };
  }

  ctx.state = {
    ...ctx.state,
    cardInstances: { ...ctx.state.cardInstances, [targetId]: finalCard },
  };
  ctx.events.push({
    type: "counterAdded",
    cardInstanceId: targetId,
    counterType: effect.counterType,
    newCount,
    timestamp: Date.now(),
  });
}

function resolveRemoveCounters(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "removeCounters" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card) return;

  const count = resolveNumber(effect.count, ctx);
  const currentCount = card.counters[effect.counterType] ?? 0;
  const newCount = Math.max(0, currentCount - count);

  const updatedCard: CardInstance = {
    ...card,
    counters: { ...card.counters, [effect.counterType]: newCount },
  };

  // Removing +1/+1 counters modifies P/T
  let finalRemoveCard = updatedCard;
  if (effect.counterType === "+1/+1" && card.modifiedPower !== null) {
    const removed = Math.min(count, currentCount);
    finalRemoveCard = {
      ...updatedCard,
      modifiedPower: (card.modifiedPower ?? 0) - removed,
      modifiedToughness: (card.modifiedToughness ?? 0) - removed,
    };
  }

  ctx.state = {
    ...ctx.state,
    cardInstances: { ...ctx.state.cardInstances, [targetId]: finalRemoveCard },
  };
  ctx.events.push({
    type: "counterRemoved",
    cardInstanceId: targetId,
    counterType: effect.counterType,
    newCount,
    timestamp: Date.now(),
  });
}

function resolveGrantAbility(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "grantAbility" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  const card = ctx.state.cardInstances[targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;

  // Add the ability to the creature's abilities
  const grantedAbility: SpellAbility = {
    ...effect.ability,
    sourceCardInstanceId: targetId,
  };

  const updatedCard: CardInstance = {
    ...card,
    abilities: [...card.abilities, grantedAbility],
  };

  ctx.state = {
    ...ctx.state,
    cardInstances: { ...ctx.state.cardInstances, [targetId]: updatedCard },
  };

  // For "until end of turn", track via continuous effect for cleanup
  if (effect.duration === "endOfTurn") {
    ctx.state = {
      ...ctx.state,
      continuousEffects: [
        ...ctx.state.continuousEffects,
        {
          id: `grant_${Date.now()}`,
          sourceCardInstanceId: ctx.item.sourceCardInstanceId,
          effect: { grantedAbilityId: grantedAbility.id, targetId },
          affectedFilter: {},
          duration: "endOfTurn",
          layer: 6,
          subLayer: null,
          timestamp: Date.now(),
          dependsOn: [],
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// forEach effect — iterate matching cards, apply effect to each
// ---------------------------------------------------------------------------

function resolveForEach(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "forEach" }>,
): void {
  const selector = effect.selector;
  const matchingIds = selectCards(ctx.state, selector, ctx.item.controller);

  for (const cardId of matchingIds) {
    // Create a temporary target ref so the sub-effect can reference this card
    const tempRef: TargetRef = { targetRequirementId: "__forEach__" };

    // Inject the card as a temporary target in the context
    const originalTargets = ctx.item.targets;
    const tempItem = {
      ...ctx.item,
      targets: [
        ...ctx.item.targets,
        { requirementId: "__forEach__", targetId: cardId, targetType: "card" as const },
      ],
    };
    const savedItem = ctx.item;
    (ctx as any).item = tempItem;
    ctx.legalTargetIds.add(cardId);

    resolveEffect(ctx, effect.effect);

    // Restore original context
    (ctx as any).item = savedItem;
  }
}

/**
 * Select card instance IDs matching a CardSelector from the game state.
 */
function selectCards(
  state: GameState,
  selector: CardSelector,
  controllerId: string,
): string[] {
  const results: string[] = [];

  // Determine which zones to search
  let zoneKeys: string[];
  if (selector.zone) {
    const zones = Array.isArray(selector.zone) ? selector.zone : [selector.zone];
    zoneKeys = Object.keys(state.zones).filter((key) => {
      const zone = state.zones[key];
      return zones.includes(zone.type);
    });
  } else {
    zoneKeys = Object.keys(state.zones);
  }

  for (const key of zoneKeys) {
    const zone = state.zones[key];
    for (const cardId of zone.cardInstanceIds) {
      const card = state.cardInstances[cardId];
      if (!card) continue;

      if (matchesSelector(card, selector, controllerId)) {
        results.push(cardId);
      }
    }
  }

  return results;
}

function matchesSelector(
  card: CardInstance,
  selector: CardSelector,
  controllerId: string,
): boolean {
  if (selector.controller) {
    if (selector.controller === "you" && card.controller !== controllerId) return false;
    if (selector.controller === "opponent" && card.controller === controllerId) return false;
    if (selector.controller !== "any" && selector.controller !== "you" && selector.controller !== "opponent") {
      if (card.controller !== selector.controller) return false;
    }
  }

  if (selector.cardTypes && selector.cardTypes.length > 0) {
    // Check if card is a creature (has P/T), artifact, etc.
    // Since CardInstance doesn't store card types directly, we infer:
    // - creature = modifiedPower !== null
    // For full type checking, would need CardData lookup
    const isCreature = card.modifiedPower !== null;
    const wantsCreature = selector.cardTypes.includes("Creature");
    if (wantsCreature && !isCreature) return false;
    if (!wantsCreature && selector.cardTypes.length === 1 && isCreature) return false;
  }

  if (selector.power && card.modifiedPower !== null) {
    if (!matchComparison(card.modifiedPower, selector.power)) return false;
  }
  if (selector.toughness && card.modifiedToughness !== null) {
    if (!matchComparison(card.modifiedToughness, selector.toughness)) return false;
  }

  if (selector.name && !card.cardDataId.toLowerCase().includes(selector.name.toLowerCase())) {
    return false;
  }

  if (selector.keywords && selector.keywords.length > 0) {
    for (const kw of selector.keywords) {
      if (!cardHasKeyword(card, kw)) return false;
    }
  }

  return true;
}

function matchComparison(
  value: number,
  comparison: { readonly op: string; readonly value: number },
): boolean {
  switch (comparison.op) {
    case "eq": return value === comparison.value;
    case "lt": return value < comparison.value;
    case "lte": return value <= comparison.value;
    case "gt": return value > comparison.value;
    case "gte": return value >= comparison.value;
    case "neq": return value !== comparison.value;
    default: return true;
  }
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

interface ConditionContext {
  kickerPaid?: boolean;
}

function evaluateCondition(
  state: GameState,
  condition: Condition,
  controllerId: string,
  context?: ConditionContext,
): boolean {
  switch (condition.type) {
    case "controlsPermanent": {
      const bf = state.zones["battlefield"];
      if (!bf) return false;
      return bf.cardInstanceIds.some((id) => {
        const card = state.cardInstances[id];
        return card && card.controller === controllerId && matchesFilter(card, condition.filter);
      });
    }
    case "lifeAtOrBelow": {
      const pid = resolvePlayerIdFromRef(state, condition.player, controllerId);
      if (!pid) return false;
      const player = state.players.find((p) => p.id === pid);
      return !!player && player.life <= condition.amount;
    }
    case "cardInZone": {
      const zones = Object.values(state.zones).filter((z) => z.type === condition.zone);
      return zones.some((z) =>
        z.cardInstanceIds.some((id) => {
          const card = state.cardInstances[id];
          return card && matchesFilter(card, condition.filter);
        }),
      );
    }
    case "and":
      return condition.conditions.every((c) => evaluateCondition(state, c, controllerId, context));
    case "or":
      return condition.conditions.some((c) => evaluateCondition(state, c, controllerId, context));
    case "not":
      return !evaluateCondition(state, condition.condition, controllerId, context);
    case "opponentCount":
      return true;
    case "custom": {
      // Handle known custom predicates
      if (condition.predicateFunction === "kickerPaid") {
        return context?.kickerPaid ?? false;
      }
      return true;
    }
    default:
      return true;
  }
}

function matchesFilter(card: CardInstance, filter: CardFilter): boolean {
  if (filter.cardTypes && filter.cardTypes.length > 0) {
    const isCreature = card.modifiedPower !== null;
    const wantsCreature = filter.cardTypes.includes("Creature");
    // Simple type check — creature detection via P/T
    if (wantsCreature && !isCreature) return false;
  }

  if (filter.colors && filter.colors.length > 0) {
    // Would need CardData for color check — skip for now
  }

  if (filter.colorsNot && filter.colorsNot.length > 0) {
    // Would need CardData for color check — skip for now
  }

  if (filter.name && !card.cardDataId.toLowerCase().includes(filter.name.toLowerCase())) {
    return false;
  }

  if (filter.power && card.modifiedPower !== null) {
    if (!matchComparison(card.modifiedPower, filter.power)) return false;
  }

  if (filter.toughness && card.modifiedToughness !== null) {
    if (!matchComparison(card.modifiedToughness, filter.toughness)) return false;
  }

  if (filter.keywords && filter.keywords.length > 0) {
    for (const kw of filter.keywords) {
      if (!cardHasKeyword(card, kw)) return false;
    }
  }

  return true;
}

function resolvePlayerIdFromRef(
  state: GameState,
  ref: { readonly type: string; [key: string]: any },
  controllerId: string,
): string | null {
  switch (ref.type) {
    case "controller": return controllerId;
    case "activePlayer": return state.activePlayerId;
    case "specific": return ref.playerId;
    default: return controllerId;
  }
}

function resolveConditional(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "conditional" }>,
): void {
  const conditionContext: ConditionContext = {
    kickerPaid: ctx.item.choices?.kickerPaid ?? false,
  };
  const conditionMet = evaluateCondition(ctx.state, effect.condition, ctx.item.controller, conditionContext);

  if (conditionMet) {
    for (const sub of effect.thenEffects) {
      resolveEffect(ctx, sub);
    }
  } else if (effect.elseEffects) {
    for (const sub of effect.elseEffects) {
      resolveEffect(ctx, sub);
    }
  }
}

// ---------------------------------------------------------------------------
// Custom effect handler — dispatch to named resolve functions
// ---------------------------------------------------------------------------

function resolveCustom(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "custom" }>,
): void {
  switch (effect.resolveFunction) {
    case "destroy_all_creatures":
      resolveDestroyAllCreatures(ctx);
      break;
    case "oblivion_ring_return":
      // TODO: track exiled card and return it
      break;
    case "equip_attach":
      // Handled by the equipment system via executeAction
      break;
    default:
      break;
  }
}

function resolveDestroyAllCreatures(ctx: ResolutionContext): void {
  const bf = ctx.state.zones["battlefield"];
  if (!bf) return;

  // Collect all creature instance IDs first (snapshot before mutation)
  const creatureIds = bf.cardInstanceIds.filter((id) => {
    const card = ctx.state.cardInstances[id];
    return card && card.modifiedPower !== null; // Has P/T = creature
  });

  for (const creatureId of creatureIds) {
    const card = ctx.state.cardInstances[creatureId];
    if (!card || card.zone !== ZoneType.Battlefield) continue;

    const moveResult = moveCard(
      ctx.state, creatureId, "battlefield", graveyardKey(card.owner), Date.now(),
    );
    ctx.state = moveResult.state;
    ctx.events.push(...moveResult.events);
    ctx.events.push({
      type: "cardDestroyed",
      cardInstanceId: creatureId,
      timestamp: Date.now(),
    });
  }
}
