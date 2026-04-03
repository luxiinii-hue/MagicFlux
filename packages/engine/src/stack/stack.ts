/**
 * Stack operations — push, resolve top (LIFO), remove.
 *
 * The stack is where spells and abilities wait to resolve. Items resolve
 * top-first (LIFO). When the top item resolves, its effects are applied
 * to the game state.
 */

import type {
  GameState,
  GameEvent,
  StackItem,
  CardInstance,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { resolveStackItem } from "./resolution.js";
import { validateTargetsOnResolution } from "./targeting.js";
import { moveCard, graveyardKey } from "../zones/transfers.js";
import { grantPriority } from "../turn/priority.js";

// ---------------------------------------------------------------------------
// Push to stack
// ---------------------------------------------------------------------------

/**
 * Add a StackItem to the top of the stack. Returns the updated state.
 * After pushing, the active player receives priority.
 */
export function pushToStack(
  state: GameState,
  item: StackItem,
): { state: GameState; events: GameEvent[] } {
  const updatedStackItems = {
    ...state.stackItems,
    [item.id]: item,
  };

  const updatedStack = [item.id, ...state.stack];

  let newState: GameState = {
    ...state,
    stack: updatedStack,
    stackItems: updatedStackItems,
    consecutivePasses: 0,
  };

  // Grant priority to active player after something goes on the stack
  newState = grantPriority(newState, newState.activePlayerId);

  const events: GameEvent[] = [];

  if (item.isSpell) {
    events.push({
      type: "spellCast",
      cardInstanceId: item.sourceCardInstanceId,
      playerId: item.controller,
      timestamp: Date.now(),
    });
  } else {
    events.push({
      type: "abilityActivated",
      abilityId: item.ability.id,
      cardInstanceId: item.sourceCardInstanceId,
      playerId: item.controller,
      timestamp: Date.now(),
    });
  }

  return { state: newState, events };
}

// ---------------------------------------------------------------------------
// Resolve top of stack
// ---------------------------------------------------------------------------

/**
 * Resolve the top item on the stack. Checks target legality, applies
 * effects (or fizzles), moves spell cards to graveyard, and removes
 * the item from the stack.
 */
export function resolveTopOfStack(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  if (state.stack.length === 0) {
    throw new Error("Cannot resolve: stack is empty");
  }

  const topItemId = state.stack[0];
  const item = state.stackItems[topItemId];
  if (!item) {
    throw new Error(`Stack item ${topItemId} not found`);
  }

  const allEvents: GameEvent[] = [];

  // Check target legality on resolution
  const targetCheck = validateTargetsOnResolution(state, item);

  let newState = state;

  if (targetCheck.allTargetsIllegal) {
    // Fizzle — all targets illegal
    allEvents.push({
      type: "stackItemCountered",
      stackItemId: topItemId,
      timestamp: Date.now(),
    });
  } else {
    // Resolve effects with the legal targets
    const resolution = resolveStackItem(newState, item, targetCheck.legalTargetIds);
    newState = resolution.state;
    allEvents.push(...resolution.events);

    allEvents.push({
      type: "stackItemResolved",
      stackItemId: topItemId,
      timestamp: Date.now(),
    });
  }

  // Remove from stack
  newState = removeFromStack(newState, topItemId);

  // If this was a spell, move the card to graveyard (or exile for flashback)
  if (item.isSpell && !item.isCopy) {
    const card = newState.cardInstances[item.sourceCardInstanceId];
    if (card && card.zone === ZoneType.Stack) {
      const isFlashback = item.choices?.alternativeCostUsed === "flashback";
      const destination = isFlashback ? "exile" : graveyardKey(card.owner);
      const moveResult = moveCard(
        newState,
        item.sourceCardInstanceId,
        "stack",
        destination,
        Date.now(),
      );
      newState = moveResult.state;
      allEvents.push(...moveResult.events);
    }
  }

  // Grant priority to active player after resolution
  newState = grantPriority(newState, newState.activePlayerId);

  return { state: newState, events: allEvents };
}

// ---------------------------------------------------------------------------
// Remove from stack
// ---------------------------------------------------------------------------

/** Remove a stack item by ID (after resolution or countering). */
function removeFromStack(state: GameState, itemId: string): GameState {
  const updatedStack = state.stack.filter((id) => id !== itemId);
  const { [itemId]: _removed, ...remainingItems } = state.stackItems;

  return {
    ...state,
    stack: updatedStack,
    stackItems: remainingItems,
  };
}
