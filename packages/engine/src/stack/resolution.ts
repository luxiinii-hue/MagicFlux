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
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { moveCard, graveyardKey, drawCard } from "../zones/transfers.js";
import { addManaToPlayer, getPlayer, EMPTY_MANA_POOL } from "../mana/pool.js";

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
    default:
      // Unimplemented effect types are silently skipped for now
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

  // For Phase 2, random discard (no player choice)
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
