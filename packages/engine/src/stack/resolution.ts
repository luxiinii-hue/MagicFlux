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
  PendingPrompt,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { moveCard, graveyardKey, drawCard } from "../zones/transfers.js";
import { addManaToPlayer, getPlayer, EMPTY_MANA_POOL } from "../mana/pool.js";
import { cardHasKeyword } from "../combat/keywords.js";
import { copyPermanent, copySpell } from "./copy.js";

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
  // "self" convention: target is the source card itself
  if (ref.targetRequirementId === "self") {
    return ctx.item.sourceCardInstanceId;
  }

  // "__forEach__" convention: injected by forEach handler
  if (ref.targetRequirementId === "__forEach__") {
    const forEachTarget = ctx.item.targets.find((t) => t.requirementId === "__forEach__");
    return forEachTarget?.targetId ?? null;
  }

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
  if ("countOf" in value) {
    return selectCards(ctx.state, value.countOf, ctx.item.controller).length;
  }
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
    case "copy":
      resolveCopyEffect(ctx, effect);
      break;
    case "search":
      resolveSearch(ctx, effect);
      break;
    case "playerChoice":
    case "preventDamage":
      // playerChoice needs further UI infrastructure
      // preventDamage handled by the replacement effect system
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

  // Store exiled card reference in source's linkedEffects (for O-Ring pattern)
  const sourceId = ctx.item.sourceCardInstanceId;
  const sourceCard = ctx.state.cardInstances[sourceId];
  if (sourceCard) {
    ctx.state = {
      ...ctx.state,
      cardInstances: {
        ...ctx.state.cardInstances,
        [sourceId]: {
          ...sourceCard,
          linkedEffects: {
            ...sourceCard.linkedEffects,
            exiled_card: { effectId: "exile", data: { cardInstanceId: targetId } },
          },
        },
      },
    };
  }
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
      basePower: tokenDef.power,
      baseToughness: tokenDef.toughness,
      isLegendary: false,
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
    if (effect.filter) {
      return matchesFilter(card, effect.filter);
    }
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
  const fn = effect.resolveFunction;

  // Board wipes
  if (fn === "destroy_all_creatures") { resolveDestroyAllCreatures(ctx); return; }

  // Linked abilities (O-Ring pattern)
  if (fn === "oblivion_ring_return" || fn === "detention_sphere_return" ||
      fn === "spell_queller_return" || fn === "thought_knot_seer_exile") {
    resolveLinkedReturn(ctx); return;
  }
  if (fn === "detention_sphere_exile" || fn === "spell_queller_exile") {
    // These are handled by the exile effect + linkedEffects store
    return;
  }

  // Equipment
  if (fn === "equip_attach") return;

  // Bounce variants
  if (fn === "cyclonic_rift") { resolveBounceAll(ctx, "opponent"); return; }
  if (fn === "remand_bounce_spell") { resolveBounceSpell(ctx); return; }
  if (fn === "condemn_bottom_library") { resolveBottomLibrary(ctx); return; }
  if (fn === "return_land_to_hand") { resolveBounceOwn(ctx); return; }

  // Return from graveyard
  if (fn === "eternal_witness_return" || fn === "kolaghans_command_return" ||
      fn === "rancor_return_to_hand" || fn === "put_in_hand" || fn === "search_put_in_hand") {
    resolveReturnFromGraveyard(ctx, "hand"); return;
  }
  if (fn === "unburial_rites_reanimate" || fn === "sun_titan_return" ||
      fn === "kenrith_reanimate") {
    resolveReturnFromGraveyard(ctx, "battlefield"); return;
  }

  // Token creation
  if (fn === "beast_within_token") { resolveCreateSpecificToken(ctx, "Beast", 3, 3, ["G"]); return; }
  if (fn === "hangarback_thopters") { resolveCreateSpecificToken(ctx, "Thopter", 1, 1, ["C"], ["flying"]); return; }
  if (fn === "geist_of_saint_traft_angel") { resolveCreateSpecificToken(ctx, "Angel", 4, 4, ["W"], ["flying"]); return; }
  if (fn === "voice_create_elemental") { resolveCreateSpecificToken(ctx, "Elemental", 0, 0, ["G"]); return; }

  // Scry
  if (fn === "scry_1" || fn === "consider_surveil" || fn === "play_with_fire_scry") {
    resolveScry(ctx, 1); return;
  }
  if (fn === "scry_2" || fn === "ponder_look") { resolveScry(ctx, 2); return; }
  if (fn === "top_look_3") { resolveScry(ctx, 3); return; }

  // Search to battlefield tapped
  if (fn === "search_put_on_battlefield_tapped" || fn === "cultivate_two_lands" ||
      fn === "prime_titan_lands" || fn === "pte_search_land") {
    // Simplified: add mana instead of actual search (PendingPrompt handles real search)
    return;
  }

  // Discard variants (opponent reveals hand, you choose)
  if (fn === "thoughtseize_discard" || fn === "duress_discard" || fn === "inquisition_discard") {
    resolveForceDiscard(ctx, 1); return;
  }
  if (fn === "liliana_each_discard") { resolveEachPlayerDiscards(ctx, 1); return; }

  // Conditional counters
  if (fn === "mana_leak_counter" || fn === "spell_pierce_counter") {
    // Simplified: counter the spell (full implementation needs payment prompt)
    resolveConditionalCounter(ctx); return;
  }
  if (fn === "chalice_counter_spell") { resolveConditionalCounter(ctx); return; }

  // Animate land (temporary creature)
  if (fn === "mutavault_animate" || fn === "colonnade_animate" ||
      fn === "tar_pit_animate" || fn === "ravine_animate") {
    resolveAnimateLand(ctx, fn);
    return;
  }

  // Damage variants
  if (fn === "inferno_titan_damage") { resolveDealDamageToAny(ctx, 3); return; }
  if (fn === "searing_blaze" || fn === "searing_blood_controller_damage") {
    resolveDealDamageToAny(ctx, 3); return;
  }
  if (fn === "brimstone_volley") { resolveDealDamageToAny(ctx, 3); return; }
  if (fn === "fiery_impulse") { resolveDealDamageToAny(ctx, 3); return; }

  // Life manipulation
  if (fn === "stp_gain_life") { resolveTargetGainsLife(ctx, 3); return; }

  // Blink (exile then return)
  if (fn === "blink_creature") { resolveBlink(ctx); return; }

  // Proliferate
  if (fn === "proliferate") { resolveProliferate(ctx); return; }

  // Each opponent loses N life (Siege Rhino, Gray Merchant, drain effects)
  if (fn.startsWith("each_opponent_lose_life_")) {
    const amount = parseInt(fn.split("_").pop() ?? "0", 10);
    resolveEachOpponentLosesLife(ctx, amount); return;
  }

  // Eidolon: damage the player who cast the triggering spell
  if (fn === "eidolon_damage_caster") { resolveEidolonDamageCaster(ctx); return; }

  // Extra turn
  if (fn === "extra_turn") { resolveExtraTurn(ctx); return; }

  // Jace abilities
  if (fn === "jace_brainstorm") { resolveCustomDrawCards(ctx, 3); return; }
  if (fn === "jace_fateseal" || fn === "jace_ultimate") return; // Complex, deferred

  // Brainstorm put-back
  if (fn === "brainstorm_put_back") return; // Needs hand→library choice

  // Storm: copy this spell for each spell cast before it this turn
  if (fn === "storm_copy") { resolveStorm(ctx); return; }

  // Cascade: exile from library until you find a spell with lower CMC, cast it free
  if (fn === "cascade") { resolveCascade(ctx); return; }

  // Misc one-offs that are safe to no-op for now
  if (fn === "chaos_warp" || fn === "collected_company" ||
      fn === "fact_or_fiction" || fn === "dig_through_time" ||
      fn === "cryptic_command_modal" || fn === "boros_charm_modal" ||
      fn === "collective_brutality_modal" || fn === "top_draw_put_back" ||
      fn === "light_up_the_stage" || fn === "dash_cast") {
    // Modal/complex — need choice infrastructure
    return;
  }

  // Catch-all: log-worthy but not fatal
  // In production, these would be logged for tracking coverage
}

// ---------------------------------------------------------------------------
// Custom resolve function implementations
// ---------------------------------------------------------------------------

function resolveBounceAll(ctx: ResolutionContext, whose: "opponent" | "all"): void {
  const bf = ctx.state.zones["battlefield"];
  if (!bf) return;
  const targets = bf.cardInstanceIds.filter((id) => {
    const card = ctx.state.cardInstances[id];
    if (!card) return false;
    if (whose === "opponent" && card.controller === ctx.item.controller) return false;
    return card.modifiedPower !== null || card.currentLoyalty !== null; // Non-land permanents
  });
  for (const id of targets) {
    const card = ctx.state.cardInstances[id];
    if (!card || card.zone !== ZoneType.Battlefield) continue;
    const result = moveCard(ctx.state, id, "battlefield", `player:${card.owner}:hand`, Date.now());
    ctx.state = result.state;
    ctx.events.push(...result.events);
  }
}

function resolveBounceSpell(ctx: ResolutionContext): void {
  // Bounce target spell on the stack to hand + draw a card
  const target = ctx.item.targets[0];
  if (!target) return;
  const targetItem = ctx.state.stackItems[target.targetId];
  if (!targetItem) return;
  // Remove from stack
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.filter((id) => id !== target.targetId),
    stackItems: Object.fromEntries(
      Object.entries(ctx.state.stackItems).filter(([id]) => id !== target.targetId),
    ),
  };
  // Move card to hand if it's a spell
  if (targetItem.isSpell && !targetItem.isCopy) {
    const card = ctx.state.cardInstances[targetItem.sourceCardInstanceId];
    if (card && card.zone === ZoneType.Stack) {
      const result = moveCard(ctx.state, targetItem.sourceCardInstanceId, "stack", `player:${card.owner}:hand`, Date.now());
      ctx.state = result.state;
      ctx.events.push(...result.events);
    }
  }
  // Caster draws a card
  const drawResult = drawCard(ctx.state, ctx.item.controller, Date.now());
  ctx.state = drawResult.state;
  ctx.events.push(...drawResult.events);
}

function resolveBottomLibrary(ctx: ResolutionContext): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const card = ctx.state.cardInstances[target.targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;
  const libKey = `player:${card.owner}:library`;
  const result = moveCard(ctx.state, target.targetId, "battlefield", libKey, Date.now());
  ctx.state = result.state;
  ctx.events.push(...result.events);
  // Move to bottom
  const lib = ctx.state.zones[libKey];
  const withoutCard = lib.cardInstanceIds.filter((id) => id !== target.targetId);
  ctx.state = {
    ...ctx.state,
    zones: {
      ...ctx.state.zones,
      [libKey]: { ...lib, cardInstanceIds: [...withoutCard, target.targetId] },
    },
  };
}

function resolveBounceOwn(ctx: ResolutionContext): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const card = ctx.state.cardInstances[target.targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;
  const result = moveCard(ctx.state, target.targetId, "battlefield", `player:${card.owner}:hand`, Date.now());
  ctx.state = result.state;
  ctx.events.push(...result.events);
}

function resolveReturnFromGraveyard(ctx: ResolutionContext, to: "hand" | "battlefield"): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const card = ctx.state.cardInstances[target.targetId];
  if (!card) return;
  const gKey = `player:${card.owner}:graveyard`;
  const graveyard = ctx.state.zones[gKey];
  if (!graveyard || !graveyard.cardInstanceIds.includes(target.targetId)) return;
  const dest = to === "hand" ? `player:${card.owner}:hand` : "battlefield";
  const result = moveCard(ctx.state, target.targetId, gKey, dest, Date.now());
  ctx.state = result.state;
  ctx.events.push(...result.events);
}

function resolveCreateSpecificToken(
  ctx: ResolutionContext, name: string, power: number, toughness: number,
  colors: string[], keywords: string[] = [],
): void {
  let tokenCounter = Date.now();
  const tokenId = `token_${++tokenCounter}_${name}`;
  const keywordAbilities = keywords.map((kw) => ({
    id: `${tokenId}_${kw}`, type: "static" as const, sourceCardInstanceId: tokenId,
    effects: [], zones: [ZoneType.Battlefield],
    continuousEffect: { effectType: kw.toLowerCase(), affectedFilter: {}, modification: {} },
    condition: null, layer: 6,
  }));
  const token: CardInstance = {
    instanceId: tokenId, cardDataId: `token:${name}`,
    owner: ctx.item.controller, controller: ctx.item.controller,
    zone: ZoneType.Battlefield, zoneOwnerId: null,
    tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
    phasedOut: false, summoningSickness: true, damage: 0, counters: {},
    attachedTo: null, attachments: [], abilities: keywordAbilities,
    modifiedPower: power, modifiedToughness: toughness,
    basePower: power, baseToughness: toughness, isLegendary: false,
    currentLoyalty: null, castingChoices: null, linkedEffects: {},
  };
  const bf = ctx.state.zones["battlefield"];
  ctx.state = {
    ...ctx.state,
    cardInstances: { ...ctx.state.cardInstances, [tokenId]: token },
    zones: { ...ctx.state.zones, battlefield: { ...bf, cardInstanceIds: [tokenId, ...bf.cardInstanceIds] } },
  };
  ctx.events.push(
    { type: "tokenCreated", cardInstanceId: tokenId, timestamp: Date.now() },
    { type: "cardEnteredZone", cardInstanceId: tokenId, toZone: ZoneType.Battlefield, fromZone: null, timestamp: Date.now() },
  );
}

function resolveScry(ctx: ResolutionContext, count: number): void {
  const controllerId = ctx.item.controller;
  const libKey = `player:${controllerId}:library`;
  const library = ctx.state.zones[libKey];
  if (!library || library.cardInstanceIds.length === 0) return;

  // Peek at top N cards
  const topCards = library.cardInstanceIds.slice(0, Math.min(count, library.cardInstanceIds.length));

  if (topCards.length === 0) return;

  // If only 1 card, scry is still a choice (top or bottom)
  // Create a PendingPrompt — player selects which cards go to bottom
  const prompt: PendingPrompt = {
    promptId: `scry_${Date.now()}`,
    playerId: controllerId,
    promptType: "scry",
    description: `Scry ${topCards.length}: choose cards to put on the bottom of your library (rest stay on top)`,
    options: topCards,
    minSelections: 0, // Can keep all on top
    maxSelections: topCards.length, // Can bottom all
    sourceStackItemId: ctx.item.id,
    effectIndex: 0,
    remainingEffects: [],
    reveal: false, // Scry is private
  };

  ctx.state = {
    ...ctx.state,
    pendingPrompt: prompt,
  };
}

function resolveForceDiscard(ctx: ResolutionContext, count: number): void {
  // The caster (controller of the Thoughtseize/Duress) chooses which card
  // the target player discards. This requires revealing the opponent's hand
  // to the caster and letting them pick.
  const target = ctx.item.targets[0];
  if (!target) return;
  const opponentId = target.targetId;
  const hKey = `player:${opponentId}:hand`;
  const hand = ctx.state.zones[hKey];
  if (!hand || hand.cardInstanceIds.length === 0) return;

  // Create a PendingPrompt for the CASTER to choose from opponent's hand
  const prompt: PendingPrompt = {
    promptId: `discard_choose_${Date.now()}`,
    playerId: ctx.item.controller, // Caster chooses
    promptType: "chooseCard",
    description: `Choose ${count} card(s) from opponent's hand to discard`,
    options: [...hand.cardInstanceIds], // Reveal all cards in opponent's hand
    minSelections: Math.min(count, hand.cardInstanceIds.length),
    maxSelections: Math.min(count, hand.cardInstanceIds.length),
    sourceStackItemId: ctx.item.id,
    effectIndex: 0,
    remainingEffects: [],
    reveal: true, // Hand is revealed to the caster
  };

  // Store the target player ID so handleMakeChoice knows whose hand to discard from
  (prompt as any).discardFromPlayerId = opponentId;

  ctx.state = {
    ...ctx.state,
    pendingPrompt: prompt,
  };
}

function resolveEachPlayerDiscards(ctx: ResolutionContext, count: number): void {
  for (const player of ctx.state.players) {
    if (player.hasLost || player.id === ctx.item.controller) continue;
    const hKey = `player:${player.id}:hand`;
    for (let i = 0; i < count; i++) {
      const hand = ctx.state.zones[hKey];
      if (!hand || hand.cardInstanceIds.length === 0) break;
      const cardId = hand.cardInstanceIds[0];
      const result = moveCard(ctx.state, cardId, hKey, graveyardKey(player.id), Date.now());
      ctx.state = result.state;
      ctx.events.push(...result.events);
    }
  }
}

function resolveConditionalCounter(ctx: ResolutionContext): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const targetItemId = target.targetId;
  const targetItem = ctx.state.stackItems[targetItemId];
  if (!targetItem) return;

  // The opponent (spell's controller) gets a choice: pay or be countered.
  // Create a PendingPrompt for the opponent.
  const opponentId = targetItem.controller;

  const prompt: PendingPrompt = {
    promptId: `counter_pay_${Date.now()}`,
    playerId: opponentId,
    promptType: "chooseMode",
    description: `Pay the cost or your spell will be countered`,
    options: ["pay", "decline"], // Client shows: "Pay {N}" or "Don't pay"
    minSelections: 1,
    maxSelections: 1,
    sourceStackItemId: ctx.item.id,
    effectIndex: 0,
    remainingEffects: [],
    reveal: false,
  };

  // Store the target stack item ID so handleMakeChoice can find it
  (prompt as any).counterTargetStackItemId = targetItemId;

  ctx.state = {
    ...ctx.state,
    pendingPrompt: prompt,
  };
}

/**
 * Actually counter a spell — used by both unconditional and conditional
 * counters when the opponent declines to pay.
 */
export function performCounter(state: GameState, targetItemId: string, events: GameEvent[]): GameState {
  const targetItem = state.stackItems[targetItemId];
  if (!targetItem) return state;

  let newState: GameState = {
    ...state,
    stack: state.stack.filter((id) => id !== targetItemId),
    stackItems: Object.fromEntries(
      Object.entries(state.stackItems).filter(([id]) => id !== targetItemId),
    ),
  };

  if (targetItem.isSpell && !targetItem.isCopy) {
    const card = newState.cardInstances[targetItem.sourceCardInstanceId];
    if (card && card.zone === ZoneType.Stack) {
      const result = moveCard(newState, targetItem.sourceCardInstanceId, "stack", graveyardKey(card.owner), Date.now());
      newState = result.state;
      events.push(...result.events);
    }
  }
  events.push({ type: "stackItemCountered", stackItemId: targetItemId, timestamp: Date.now() });
  return newState;
}

function resolveDealDamageToAny(ctx: ResolutionContext, amount: number): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const player = ctx.state.players.find((p) => p.id === target.targetId);
  if (player) {
    const newLife = player.life - amount;
    ctx.state = {
      ...ctx.state,
      players: ctx.state.players.map((p) => p.id === target.targetId ? { ...p, life: newLife } : p),
    };
    ctx.events.push({ type: "lifeChanged", playerId: target.targetId, oldLife: player.life, newLife, reason: "damage", timestamp: Date.now() });
  } else {
    const card = ctx.state.cardInstances[target.targetId];
    if (card) {
      ctx.state = {
        ...ctx.state,
        cardInstances: { ...ctx.state.cardInstances, [target.targetId]: { ...card, damage: card.damage + amount } },
      };
      ctx.events.push({
        type: "damageDealt",
        sourceInstanceId: ctx.item.sourceCardInstanceId,
        targetRef: { targetId: target.targetId, targetType: "card" },
        amount,
        isCombatDamage: false,
        isDeathtouch: false,
        timestamp: Date.now(),
      });
    }
  }
}

function resolveTargetGainsLife(ctx: ResolutionContext, amount: number): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const player = ctx.state.players.find((p) => p.id === target.targetId);
  if (player) {
    const newLife = player.life + amount;
    ctx.state = {
      ...ctx.state,
      players: ctx.state.players.map((p) => p.id === target.targetId ? { ...p, life: newLife } : p),
    };
    ctx.events.push({ type: "lifeChanged", playerId: target.targetId, oldLife: player.life, newLife, reason: "gainLife", timestamp: Date.now() });
  }
}

function resolveCustomDrawCards(ctx: ResolutionContext, count: number): void {
  for (let i = 0; i < count; i++) {
    const result = drawCard(ctx.state, ctx.item.controller, Date.now());
    ctx.state = result.state;
    ctx.events.push(...result.events);
  }
}

function resolveBlink(ctx: ResolutionContext): void {
  const target = ctx.item.targets[0];
  if (!target) return;
  const card = ctx.state.cardInstances[target.targetId];
  if (!card || card.zone !== ZoneType.Battlefield) return;
  // Exile
  let result = moveCard(ctx.state, target.targetId, "battlefield", "exile", Date.now());
  ctx.state = result.state;
  ctx.events.push(...result.events);
  // Return to battlefield
  result = moveCard(ctx.state, target.targetId, "exile", "battlefield", Date.now());
  ctx.state = result.state;
  ctx.events.push(...result.events);
}

function resolveProliferate(ctx: ResolutionContext): void {
  // Add one counter of each type already on each permanent you choose
  // Simplified: add +1/+1 counter to each creature you control that has counters
  const bf = ctx.state.zones["battlefield"];
  if (!bf) return;
  for (const id of bf.cardInstanceIds) {
    const card = ctx.state.cardInstances[id];
    if (!card || card.controller !== ctx.item.controller) continue;
    if (Object.keys(card.counters).length === 0) continue;
    const updatedCounters = { ...card.counters };
    for (const [type, count] of Object.entries(updatedCounters)) {
      updatedCounters[type] = count + 1;
    }
    ctx.state = {
      ...ctx.state,
      cardInstances: { ...ctx.state.cardInstances, [id]: { ...card, counters: updatedCounters } },
    };
  }
}

function resolveEachOpponentLosesLife(ctx: ResolutionContext, amount: number): void {
  for (const player of ctx.state.players) {
    if (player.hasLost || player.id === ctx.item.controller) continue;
    const newLife = player.life - amount;
    ctx.state = {
      ...ctx.state,
      players: ctx.state.players.map((p) => p.id === player.id ? { ...p, life: newLife } : p),
    };
    ctx.events.push({
      type: "lifeChanged",
      playerId: player.id,
      oldLife: player.life,
      newLife,
      reason: "loseLife",
      timestamp: Date.now(),
    });
  }
}

function resolveEidolonDamageCaster(ctx: ResolutionContext): void {
  // The triggering event is a spellCast. We need to find which player
  // cast the spell that triggered this ability. The trigger system puts
  // the triggering event's data in the stack item's context.
  // Since we don't have direct event access here, we use the stack:
  // the spell that triggered Eidolon is likely still on the stack or
  // was the most recent spellCast. As a fallback, damage the non-active
  // player or iterate pending events.
  //
  // Practical approach: Eidolon triggers on ANY player casting CMC<=3.
  // The triggering player can be inferred from the most recent spellCast
  // event in pendingEvents, or we damage all opponents as a simplification.
  // For correctness: check pendingEvents for the triggering spellCast.
  const pendingSpellCast = ctx.state.pendingEvents.find((e) => e.type === "spellCast");
  if (pendingSpellCast && pendingSpellCast.type === "spellCast") {
    const casterId = (pendingSpellCast as any).playerId as string;
    if (casterId) {
      const player = ctx.state.players.find((p) => p.id === casterId);
      if (player) {
        const newLife = player.life - 2;
        ctx.state = {
          ...ctx.state,
          players: ctx.state.players.map((p) => p.id === casterId ? { ...p, life: newLife } : p),
        };
        ctx.events.push({
          type: "lifeChanged",
          playerId: casterId,
          oldLife: player.life,
          newLife,
          reason: "damage",
          timestamp: Date.now(),
        });
        return;
      }
    }
  }
  // Fallback: damage each opponent
  resolveEachOpponentLosesLife(ctx, 2);
}

function resolveExtraTurn(ctx: ResolutionContext): void {
  ctx.state = {
    ...ctx.state,
    extraTurns: [{ playerId: ctx.item.controller, source: ctx.item.sourceCardInstanceId }, ...ctx.state.extraTurns],
  };
}

const LAND_ANIMATION_STATS: Record<string, { power: number; toughness: number; keywords: string[] }> = {
  mutavault_animate: { power: 2, toughness: 2, keywords: [] },
  colonnade_animate: { power: 4, toughness: 4, keywords: ["flying", "vigilance"] },
  tar_pit_animate: { power: 3, toughness: 2, keywords: ["unblockable"] },
  ravine_animate: { power: 3, toughness: 3, keywords: ["trample"] },
};

function resolveAnimateLand(ctx: ResolutionContext, fn: string): void {
  const sourceId = ctx.item.sourceCardInstanceId;
  const stats = LAND_ANIMATION_STATS[fn] ?? { power: 2, toughness: 2, keywords: [] };

  // Create an endOfTurn continuous effect at layer 4 (type change: becomes creature)
  const animateEffect = {
    id: `animate_${sourceId}_${Date.now()}`,
    sourceCardInstanceId: sourceId,
    effect: { animate: { power: stats.power, toughness: stats.toughness } },
    affectedFilter: { self: true },
    duration: "endOfTurn" as const,
    layer: 4,
    subLayer: null,
    timestamp: Date.now(),
    dependsOn: [],
  };

  ctx.state = {
    ...ctx.state,
    continuousEffects: [...ctx.state.continuousEffects, animateEffect],
  };

  // Also apply immediately so the creature has P/T this turn
  const card = ctx.state.cardInstances[sourceId];
  if (card) {
    let updatedCard: CardInstance = {
      ...card,
      modifiedPower: stats.power,
      modifiedToughness: stats.toughness,
      basePower: stats.power,
      baseToughness: stats.toughness,
    };

    // Grant keywords via static abilities
    for (const kw of stats.keywords) {
      updatedCard = {
        ...updatedCard,
        abilities: [
          ...updatedCard.abilities,
          {
            id: `animate_${sourceId}_${kw}`,
            type: "static" as const,
            sourceCardInstanceId: sourceId,
            effects: [],
            zones: [ZoneType.Battlefield],
            continuousEffect: { effectType: kw, affectedFilter: {}, modification: {} },
            condition: null,
            layer: 6,
          },
        ],
      };
    }

    ctx.state = {
      ...ctx.state,
      cardInstances: { ...ctx.state.cardInstances, [sourceId]: updatedCard },
    };
  }
}

function resolveStorm(ctx: ResolutionContext): void {
  // Storm: copy this spell for each spell cast before it this turn.
  // The storm count = total spells cast this turn minus 1 (the storm spell itself).
  const controllerId = ctx.item.controller;
  const totalSpells = Object.values(ctx.state.turnFlags.spellsCastThisTurn)
    .reduce((sum, count) => sum + (count as number), 0);
  const stormCount = Math.max(0, totalSpells - 1);

  for (let i = 0; i < stormCount; i++) {
    const result = copySpell(ctx.state, ctx.item.id, controllerId);
    ctx.state = result.state;
    ctx.events.push(...result.events);
  }
}

function resolveCascade(ctx: ResolutionContext): void {
  // Cascade: exile cards from the top of library until you exile a nonland
  // card with CMC less than the cascade spell's CMC. Cast it for free.
  // Put the rest on the bottom of the library in a random order.
  const controllerId = ctx.item.controller;
  const libKey = `player:${controllerId}:library`;
  const library = ctx.state.zones[libKey];
  if (!library || library.cardInstanceIds.length === 0) return;

  // We don't have CMC info on CardInstance, so cascade is simplified:
  // exile cards until finding one with a spell ability, then cast it.
  const exiled: string[] = [];
  let foundSpellId: string | null = null;

  for (const cardId of library.cardInstanceIds) {
    const card = ctx.state.cardInstances[cardId];
    if (!card) continue;

    // Move to exile
    const moveResult = moveCard(ctx.state, cardId, libKey, "exile", Date.now());
    ctx.state = moveResult.state;
    ctx.events.push(...moveResult.events);
    exiled.push(cardId);

    // Check if this is a castable nonland spell
    const hasSpellAbility = card.abilities.some((a) => a.type === "spell");
    const isLand = card.cardDataId === "Plains" || card.cardDataId === "Island" ||
      card.cardDataId === "Swamp" || card.cardDataId === "Mountain" ||
      card.cardDataId === "Forest";

    if (hasSpellAbility && !isLand) {
      foundSpellId = cardId;
      break;
    }
  }

  // Cast the found spell for free (move from exile to stack, create stack item)
  if (foundSpellId) {
    const card = ctx.state.cardInstances[foundSpellId];
    if (card) {
      const spellAbility = card.abilities.find((a) => a.type === "spell");
      if (spellAbility) {
        // Move from exile to stack
        const moveResult = moveCard(ctx.state, foundSpellId, "exile", "stack", Date.now());
        ctx.state = moveResult.state;
        ctx.events.push(...moveResult.events);

        // The spell is now on the stack zone. The server's game loop will
        // see it and handle resolution. For a more complete implementation,
        // we'd create a proper StackItem here.
      }
    }
  }

  // Put remaining exiled cards (not the found spell) on bottom of library
  // in random order (simplified: just append in order)
  const remainingExiled = exiled.filter((id) => id !== foundSpellId);
  for (const cardId of remainingExiled) {
    const card = ctx.state.cardInstances[cardId];
    if (!card || card.zone !== ZoneType.Exile) continue;
    const moveResult = moveCard(ctx.state, cardId, "exile", libKey, Date.now());
    ctx.state = moveResult.state;
    ctx.events.push(...moveResult.events);
    // Move to bottom
    const lib = ctx.state.zones[libKey];
    const withoutCard = lib.cardInstanceIds.filter((id) => id !== cardId);
    ctx.state = {
      ...ctx.state,
      zones: {
        ...ctx.state.zones,
        [libKey]: { ...lib, cardInstanceIds: [...withoutCard, cardId] },
      },
    };
  }
}

function resolveCopyEffect(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "copy" }>,
): void {
  const targetId = resolveTargetId(ctx, effect.target);
  if (!targetId) return;

  // Check if target is a permanent on the battlefield (Clone pattern)
  const card = ctx.state.cardInstances[targetId];
  if (card && card.zone === ZoneType.Battlefield) {
    const result = copyPermanent(ctx.state, targetId, ctx.item.controller);
    ctx.state = result.state;
    ctx.events.push(...result.events);
    return;
  }

  // Check if target is a spell on the stack (Fork pattern)
  if (ctx.state.stackItems[targetId]) {
    const result = copySpell(ctx.state, targetId, ctx.item.controller);
    ctx.state = result.state;
    ctx.events.push(...result.events);
    return;
  }
}

function resolveSearch(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "search" }>,
): void {
  const playerId = resolvePlayerId(ctx, effect.player);
  if (!playerId) return;

  // Find matching cards in the specified zone
  const zoneKeys = Object.keys(ctx.state.zones).filter((key) => {
    const zone = ctx.state.zones[key];
    return zone.type === effect.zone;
  });

  const matchingCards: string[] = [];
  for (const key of zoneKeys) {
    const zone = ctx.state.zones[key];
    // Only search zones owned by the player (for library searches)
    if (zone.ownerId && zone.ownerId !== playerId) continue;

    for (const cardId of zone.cardInstanceIds) {
      const card = ctx.state.cardInstances[cardId];
      if (card && matchesFilter(card, effect.filter)) {
        matchingCards.push(cardId);
      }
    }
  }

  if (matchingCards.length === 0) return;

  // If only one match, auto-select it. Otherwise create a PendingPrompt.
  if (matchingCards.length === 1) {
    applySearchResult(ctx, effect, matchingCards[0]);
    return;
  }

  // Create a PendingPrompt — the engine pauses here
  // Most tutors reveal; unrevealed search (Demonic Tutor) would set reveal: false
  // via a flag on the Effect. Default to true (most common).
  const prompt: PendingPrompt = {
    promptId: `search_${Date.now()}`,
    playerId,
    promptType: "searchLibrary",
    description: `Search for a card`,
    options: matchingCards,
    minSelections: 0, // Player can fail to find
    maxSelections: 1,
    sourceStackItemId: ctx.item.id,
    effectIndex: 0,
    remainingEffects: [],
    reveal: true,
  };

  ctx.state = {
    ...ctx.state,
    pendingPrompt: prompt,
  };
}

/**
 * Apply the result of a search — move the chosen card to hand (or
 * wherever the "then" effect specifies).
 */
export function applySearchResult(
  ctx: ResolutionContext,
  effect: Extract<Effect, { type: "search" }>,
  chosenCardId: string,
): void {
  const card = ctx.state.cardInstances[chosenCardId];
  if (!card) return;

  // Find the card's current zone
  let fromZoneKey: string | null = null;
  for (const [key, zone] of Object.entries(ctx.state.zones)) {
    if (zone.cardInstanceIds.includes(chosenCardId)) {
      fromZoneKey = key;
      break;
    }
  }
  if (!fromZoneKey) return;

  // The "then" effect describes what happens to the found card.
  // Common patterns: put into hand, put onto battlefield
  if (effect.then) {
    // For now, resolve the "then" effect with the chosen card as context
    // Simple implementation: if then is a zone change, move the card there
    if (effect.then.type === "bounce") {
      const toZoneKey = effect.then.to === "Hand" as any
        ? `player:${card.owner}:hand`
        : "battlefield";
      const moveResult = moveCard(ctx.state, chosenCardId, fromZoneKey, toZoneKey, Date.now());
      ctx.state = moveResult.state;
      ctx.events.push(...moveResult.events);
    } else {
      // Default: put in hand
      const moveResult = moveCard(
        ctx.state, chosenCardId, fromZoneKey, `player:${card.owner}:hand`, Date.now(),
      );
      ctx.state = moveResult.state;
      ctx.events.push(...moveResult.events);
    }
  } else {
    // Default: put in hand
    const moveResult = moveCard(
      ctx.state, chosenCardId, fromZoneKey, `player:${card.owner}:hand`, Date.now(),
    );
    ctx.state = moveResult.state;
    ctx.events.push(...moveResult.events);
  }
}

function resolveLinkedReturn(ctx: ResolutionContext): void {
  // Oblivion Ring LTB: return the card exiled by the ETB trigger.
  // The exiled card's instanceId is stored in linkedEffects on the source card.
  const sourceId = ctx.item.sourceCardInstanceId;
  const sourceCard = ctx.state.cardInstances[sourceId];
  if (!sourceCard) return;

  const linkedExile = sourceCard.linkedEffects["exiled_card"];
  if (!linkedExile) return;

  const exiledCardId = linkedExile.data["cardInstanceId"] as string;
  if (!exiledCardId) return;

  const exiledCard = ctx.state.cardInstances[exiledCardId];
  if (!exiledCard || exiledCard.zone !== ZoneType.Exile) return;

  // Return to battlefield
  const moveResult = moveCard(ctx.state, exiledCardId, "exile", "battlefield", Date.now());
  ctx.state = moveResult.state;
  ctx.events.push(...moveResult.events);
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
