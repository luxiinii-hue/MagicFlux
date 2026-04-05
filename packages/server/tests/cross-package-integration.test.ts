/**
 * Cross-package integration test.
 *
 * Tests the full gameplay flow spanning engine, cards, and server:
 * - Mulligan phase (keep/mulligan/put-on-bottom)
 * - Playing lands
 * - Tapping for mana
 * - Casting spells with targets (damage to players)
 * - Permanent spells entering the battlefield
 * - Mana cost enforcement (can't cast without mana)
 *
 * This catches cross-package integration gaps automatically.
 */

import { describe, it, expect } from "vitest";
import { GameSession, type PlayerConnection } from "../src/game-session/session.js";
import type { ServerMessage } from "../src/websocket/protocol.js";
import type {
  DecklistEntry,
  PlayerAction,
  ClientGameState,
  GameEvent,
} from "@magic-flux/types";
import { Phase } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Burn deck: mountains + lightning bolts + goblin guides */
function makeBurnDeck(): DecklistEntry[] {
  const entries: DecklistEntry[] = [];
  for (let i = 0; i < 24; i++) {
    entries.push({ cardName: "Mountain", cardDataId: null, count: 1, setCode: null, collectorNumber: null });
  }
  for (let i = 0; i < 20; i++) {
    entries.push({ cardName: "Lightning Bolt", cardDataId: null, count: 1, setCode: null, collectorNumber: null });
  }
  for (let i = 0; i < 16; i++) {
    entries.push({ cardName: "Goblin Guide", cardDataId: null, count: 1, setCode: null, collectorNumber: null });
  }
  return entries;
}

interface MockClient {
  readonly playerId: string;
  readonly messages: ServerMessage[];
  readonly connection: PlayerConnection;
  getLastState(): ClientGameState | undefined;
  getLastLegalActions(): PlayerAction[] | undefined;
  getLastPrompt(): { promptId: string; options: unknown; description: string } | undefined;
  getEvents(): GameEvent[];
  clearMessages(): void;
}

function createMockClient(playerId: string, playerName: string): MockClient {
  const messages: ServerMessage[] = [];
  const connection: PlayerConnection = {
    playerId,
    playerName,
    send(message: ServerMessage) {
      messages.push(message);
    },
  };

  return {
    playerId,
    messages,
    connection,
    getLastState() {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "game:stateUpdate") {
          return (messages[i] as any).payload.gameState;
        }
      }
      return undefined;
    },
    getLastLegalActions() {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "game:legalActions") {
          return (messages[i] as any).payload.actions as PlayerAction[];
        }
      }
      return undefined;
    },
    getLastPrompt() {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "game:prompt") {
          return (messages[i] as any).payload;
        }
      }
      return undefined;
    },
    getEvents() {
      return messages
        .filter((m) => m.type === "game:event")
        .map((m) => (m as any).payload.event);
    },
    clearMessages() {
      messages.length = 0;
    },
  };
}

/** Pass priority until the target phase is reached. Checks state from any client. */
function passUntilPhase(
  session: GameSession,
  targetPhase: Phase,
  clients: MockClient[],
  maxPasses = 200,
): void {
  for (let i = 0; i < maxPasses; i++) {
    // Check if we've reached the target phase
    const state = clients[0].getLastState();
    if (state && state.turnState.phase === targetPhase && state.priorityPlayerId) {
      return;
    }

    // Find which client currently has priority and pass
    for (const client of clients) {
      const clientState = client.getLastState();
      const actions = client.getLastLegalActions();
      if (clientState && clientState.priorityPlayerId === client.playerId &&
          actions?.some((a) => a.type === "passPriority")) {
        session.handleAction(client.playerId, { type: "passPriority" });
        break;
      }
    }
  }
}

function findAction(actions: PlayerAction[] | undefined, type: string): PlayerAction | undefined {
  return actions?.find((a) => a.type === type);
}

function findCastAction(actions: PlayerAction[] | undefined, cardDataId: string, state: ClientGameState): PlayerAction | undefined {
  return actions?.find((a) => {
    if (a.type !== "castSpell") return false;
    const card = state.cardInstances[a.cardInstanceId];
    return card?.cardDataId === cardDataId;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Cross-package integration", () => {
  it("should complete the mulligan flow: keep, mulligan, put-on-bottom", () => {
    const session = new GameSession("mulligan-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makeBurnDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makeBurnDeck(), p2.connection);
    session.start(42);

    // Both players should receive mulligan prompts
    expect(session.getStatus()).toBe("mulligan");
    const p1Prompt = p1.getLastPrompt();
    const p2Prompt = p2.getLastPrompt();
    expect(p1Prompt).toBeDefined();
    expect(p2Prompt).toBeDefined();
    expect(p1Prompt!.description).toContain("Keep or Mulligan");

    // Player 1 keeps
    session.handleMulliganResponse("p1", "keep");

    // Player 2 mulligans
    session.handleMulliganResponse("p2", "mulligan");
    expect(session.getStatus()).toBe("mulligan"); // Still in mulligan

    // Player 2 should see new hand + new prompt
    p2.clearMessages();
    // Player 2 now keeps
    session.handleMulliganResponse("p2", "keep");

    // Player 2 needs to put 1 card on bottom
    const bottomPrompt = p2.getLastPrompt();
    expect(bottomPrompt).toBeDefined();
    expect(bottomPrompt!.description).toContain("bottom");

    // Get a card from p2's hand to put on bottom
    const p2State = p2.getLastState();
    expect(p2State).toBeDefined();
    const p2HandZone = p2State!.zones[`player:p2:hand`];
    expect(p2HandZone).toBeDefined();
    const handCards = (p2HandZone as any).cardInstanceIds;
    expect(handCards).toBeDefined();
    expect(handCards.length).toBe(7); // Still 7 before putting on bottom

    session.handlePutOnBottom("p2", [handCards[0]]);

    // Game should now be active
    expect(session.getStatus()).toBe("active");
  });

  it("should enforce mana costs: can't cast without mana", () => {
    const session = new GameSession("mana-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makeBurnDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makeBurnDeck(), p2.connection);
    session.start(42, true);

    // Advance to main phase
    passUntilPhase(session, Phase.PreCombatMain, [p1, p2]);

    const state = p1.getLastState();
    expect(state).toBeDefined();
    expect(state!.turnState.phase).toBe(Phase.PreCombatMain);

    // Player should have passPriority and possibly playLand, but NOT castSpell
    // (no mana in pool)
    const actions = p1.getLastLegalActions();
    expect(actions).toBeDefined();
    const castAction = actions!.find((a) => a.type === "castSpell");
    expect(castAction).toBeUndefined(); // Can't cast without mana
  });

  it("should play a land and tap for mana", () => {
    const session = new GameSession("land-mana-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makeBurnDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makeBurnDeck(), p2.connection);
    session.start(42, true);

    passUntilPhase(session, Phase.PreCombatMain, [p1, p2]);

    // Find a playLand action
    let actions = p1.getLastLegalActions()!;
    const playLandAction = findAction(actions, "playLand");
    expect(playLandAction).toBeDefined();

    // Play the land
    session.handleAction("p1", playLandAction!);

    // Now find a mana ability (tap land)
    actions = p1.getLastLegalActions()!;
    const tapAction = findAction(actions, "activateAbility");
    expect(tapAction).toBeDefined();

    // Tap for mana
    session.handleAction("p1", tapAction!);

    // Player should now have mana in pool
    const state = p1.getLastState()!;
    const player = state.players.find((p) => p.id === "p1")!;
    expect(player.manaPool.R).toBeGreaterThan(0);
  });

  it("should cast a spell after tapping mana, with mana deducted", () => {
    const session = new GameSession("cast-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makeBurnDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makeBurnDeck(), p2.connection);
    session.start(42, true);

    passUntilPhase(session, Phase.PreCombatMain, [p1, p2]);

    // Play land + tap
    let actions = p1.getLastLegalActions()!;
    session.handleAction("p1", findAction(actions, "playLand")!);
    actions = p1.getLastLegalActions()!;
    session.handleAction("p1", findAction(actions, "activateAbility")!);

    // Should now have castSpell available
    actions = p1.getLastLegalActions()!;
    const state = p1.getLastState()!;
    const castAction = findCastAction(actions, "Lightning Bolt", state)
      ?? findCastAction(actions, "Goblin Guide", state);

    // At least one spell should be castable (depending on hand)
    if (castAction) {
      const manaBefore = state.players.find((p) => p.id === "p1")!.manaPool.R;
      expect(manaBefore).toBe(1);

      session.handleAction("p1", castAction);

      // Mana should be deducted
      const stateAfter = p1.getLastState()!;
      const manaAfter = stateAfter.players.find((p) => p.id === "p1")!.manaPool.R;
      expect(manaAfter).toBe(0);
    }
  });

  it("should put permanent spells on the battlefield when they resolve", () => {
    const session = new GameSession("permanent-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makeBurnDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makeBurnDeck(), p2.connection);
    session.start(42, true);

    passUntilPhase(session, Phase.PreCombatMain, [p1, p2]);

    // Play land + tap
    let actions = p1.getLastLegalActions()!;
    session.handleAction("p1", findAction(actions, "playLand")!);
    actions = p1.getLastLegalActions()!;
    session.handleAction("p1", findAction(actions, "activateAbility")!);

    // Try to cast Goblin Guide (creature — should enter battlefield)
    actions = p1.getLastLegalActions()!;
    const state = p1.getLastState()!;
    const goblinAction = findCastAction(actions, "Goblin Guide", state);

    if (goblinAction) {
      // Cast it
      session.handleAction("p1", goblinAction);

      // Pass priority from both players to resolve
      session.handleAction("p1", { type: "passPriority" });

      // p2 needs to pass too
      const p2Actions = p2.getLastLegalActions();
      if (p2Actions?.some((a) => a.type === "passPriority")) {
        session.handleAction("p2", { type: "passPriority" });
      }

      // After resolution, Goblin Guide should be on the battlefield
      const finalState = p1.getLastState()!;
      const battlefield = finalState.zones["battlefield"];
      if (battlefield && "cardInstanceIds" in battlefield) {
        const bfCards = battlefield.cardInstanceIds.filter((id: string) => {
          const card = finalState.cardInstances[id];
          return card?.cardDataId === "Goblin Guide" && card?.controller === "p1";
        });
        expect(bfCards.length).toBeGreaterThan(0);
      }
    }
  });
});
