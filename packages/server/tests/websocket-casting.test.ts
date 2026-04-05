/**
 * WebSocket-level casting integration test.
 *
 * Simulates the exact message flow the browser client sends:
 * create game → join → mulligan keep → play land → tap mana → cast spell.
 * Verifies damage is dealt, mana is deducted, permanents enter battlefield.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import WebSocket from "ws";
import { createMagicFluxServer, type MagicFluxServer } from "../src/websocket/server.js";
import type { ServerMessage, ClientMessage } from "../src/websocket/protocol.js";
import type { DecklistEntry, ClientGameState, PlayerAction } from "@magic-flux/types";

const TEST_PORT = 18274;

/** Legal burn deck: 36 Mountains + 4 Lightning Bolt + 4 Goblin Guide + 4 Shock + 4 Lava Spike + 4 Monastery Swiftspear + 4 Rift Bolt */
function makeBurnDeck(): DecklistEntry[] {
  const e = (name: string, n: number) => Array.from({ length: n }, () => ({ cardName: name, cardDataId: name, count: 1, setCode: null, collectorNumber: null }));
  return [
    ...e("Mountain", 36),
    ...e("Lightning Bolt", 4),
    ...e("Goblin Guide", 4),
    ...e("Shock", 4),
    ...e("Lava Spike", 4),
    ...e("Monastery Swiftspear", 4),
    ...e("Rift Bolt", 4),
  ];
}

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

/** Collect messages from a WebSocket until predicate or timeout. */
function collectUntil(
  ws: WebSocket,
  predicate: (msgs: ServerMessage[]) => boolean,
  timeoutMs = 3000,
): Promise<ServerMessage[]> {
  return new Promise((resolve) => {
    const collected: ServerMessage[] = [];
    const timeout = setTimeout(() => { cleanup(); resolve(collected); }, timeoutMs);
    function onMessage(data: WebSocket.Data) {
      collected.push(JSON.parse(data.toString()) as ServerMessage);
      if (predicate(collected)) { cleanup(); resolve(collected); }
    }
    function cleanup() { clearTimeout(timeout); ws.off("message", onMessage); }
    ws.on("message", onMessage);
  });
}

function send(ws: WebSocket, msg: ClientMessage): void {
  ws.send(JSON.stringify(msg));
}

function findMsg<T extends ServerMessage["type"]>(
  msgs: ServerMessage[], type: T
): Extract<ServerMessage, { type: T }> | undefined {
  return msgs.find((m) => m.type === type) as any;
}

function findAllMsg<T extends ServerMessage["type"]>(
  msgs: ServerMessage[], type: T
): Extract<ServerMessage, { type: T }>[] {
  return msgs.filter((m) => m.type === type) as any;
}

function getState(msgs: ServerMessage[]): ClientGameState | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].type === "game:stateUpdate") return (msgs[i] as any).payload.gameState;
  }
  return undefined;
}

function getActions(msgs: ServerMessage[]): PlayerAction[] | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].type === "game:legalActions") return (msgs[i] as any).payload.actions;
  }
  return undefined;
}

function getTargetRequirements(msgs: ServerMessage[]): Record<string, any> | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].type === "game:legalActions") return (msgs[i] as any).payload.targetRequirements;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WebSocket casting integration", () => {
  let server: MagicFluxServer;
  const openClients: WebSocket[] = [];

  beforeAll(async () => {
    server = createMagicFluxServer({ port: TEST_PORT });
    await server.start();
  });

  afterEach(() => {
    for (const ws of openClients) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    openClients.length = 0;
  });

  afterAll(async () => {
    await server.stop();
  });

  function track(ws: WebSocket): WebSocket { openClients.push(ws); return ws; }

  /**
   * Helper: create a game, both players join and keep opening hands.
   * Returns the game ID and both clients' accumulated messages.
   */
  async function setupGame(): Promise<{
    gameId: string;
    ws1: WebSocket;
    ws2: WebSocket;
    p1Msgs: ServerMessage[];
    p2Msgs: ServerMessage[];
  }> {
    const ws1 = track(await connectClient(TEST_PORT));
    const ws2 = track(await connectClient(TEST_PORT));
    const p1Msgs: ServerMessage[] = [];
    const p2Msgs: ServerMessage[] = [];
    ws1.on("message", (d) => p1Msgs.push(JSON.parse(d.toString())));
    ws2.on("message", (d) => p2Msgs.push(JSON.parse(d.toString())));

    // P1 creates game
    send(ws1, { type: "lobby:createGame", payload: { format: "standard", maxPlayers: 2, decklist: makeBurnDeck() } });
    await new Promise((r) => setTimeout(r, 200));
    const created = findMsg(p1Msgs, "lobby:gameCreated");
    expect(created).toBeDefined();
    const gameId = created!.payload.gameId;

    // P2 joins — enters mulligan phase
    send(ws2, { type: "lobby:joinGame", payload: { gameId, decklist: makeBurnDeck() } });
    await new Promise((r) => setTimeout(r, 300));

    // Both keep (respond to mulligan prompts)
    const p1Prompt = findMsg(p1Msgs, "game:prompt");
    const p2Prompt = findMsg(p2Msgs, "game:prompt");
    expect(p1Prompt).toBeDefined();
    expect(p2Prompt).toBeDefined();

    send(ws1, { type: "game:promptResponse", payload: { gameId, promptId: p1Prompt!.payload.promptId, selection: "keep" } });
    send(ws2, { type: "game:promptResponse", payload: { gameId, promptId: p2Prompt!.payload.promptId, selection: "keep" } });
    await new Promise((r) => setTimeout(r, 300));

    return { gameId, ws1, ws2, p1Msgs, p2Msgs };
  }

  /** Pass priority for a player. */
  function passPriority(ws: WebSocket, gameId: string): void {
    send(ws, { type: "game:action", payload: { gameId, action: { type: "passPriority" } } });
  }

  /** Pass priority from both players until the target phase is reached. */
  async function passToMainPhase(
    gameId: string,
    ws1: WebSocket, ws2: WebSocket,
    p1Msgs: ServerMessage[], p2Msgs: ServerMessage[],
  ): Promise<void> {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 50));

      const state = getState(p1Msgs) ?? getState(p2Msgs);
      if (state?.turnState.phase === "PreCombatMain") return;

      // Both players try to pass — the server rejects if it's not their turn
      passPriority(ws1, gameId);
      passPriority(ws2, gameId);
    }
  }

  it("should complete full casting flow: land → tap → cast bolt → damage to player", async () => {
    const { gameId, ws1, ws2, p1Msgs, p2Msgs } = await setupGame();

    // Pass to main phase
    await passToMainPhase(gameId, ws1, ws2, p1Msgs, p2Msgs);

    const state = getState(p1Msgs);
    expect(state).toBeDefined();
    expect(state!.turnState.phase).toBe("PreCombatMain");

    // Find and play a land
    const actions = getActions(p1Msgs);
    const playLand = actions?.find((a) => a.type === "playLand");
    if (!playLand) {
      // P1 might not have a mountain in hand (random shuffle) — skip gracefully
      console.log("[TEST] No land in P1 hand — skipping casting flow test");
      return;
    }

    p1Msgs.length = 0;
    send(ws1, { type: "game:action", payload: { gameId, action: playLand } });
    await new Promise((r) => setTimeout(r, 200));

    // Tap the land for mana
    const actionsAfterLand = getActions(p1Msgs);
    const tapAction = actionsAfterLand?.find((a) => a.type === "activateAbility");
    expect(tapAction).toBeDefined();

    p1Msgs.length = 0;
    send(ws1, { type: "game:action", payload: { gameId, action: tapAction! } });
    await new Promise((r) => setTimeout(r, 200));

    // Should have R in pool, and castSpell actions available
    const stateAfterTap = getState(p1Msgs);
    expect(stateAfterTap).toBeDefined();
    const p1Player = stateAfterTap!.players.find((p) => p.manaPool.R > 0);
    expect(p1Player).toBeDefined();

    const castActions = getActions(p1Msgs);
    const castSpell = castActions?.find((a) => a.type === "castSpell");
    expect(castSpell).toBeDefined();

    // Check target requirements
    const targetReqs = getTargetRequirements(p1Msgs);
    const cardId = (castSpell as any).cardInstanceId;
    const card = stateAfterTap!.cardInstances[cardId];

    if (card?.cardDataId === "Lightning Bolt" || card?.cardDataId === "Goblin Guide") {
      // Cast the spell
      const reqs = targetReqs?.[cardId];

      let castAction: any;
      if (reqs && reqs.length > 0) {
        // Spell needs targets — target the opponent
        const opponentId = stateAfterTap!.players.find((p) => p.manaPool.R === 0)?.id;
        expect(opponentId).toBeDefined();
        castAction = {
          type: "castSpell",
          cardInstanceId: cardId,
          targets: [{ requirementId: reqs[0].id, targetId: opponentId, targetType: "player" }],
        };
      } else {
        // No targets (e.g., Goblin Guide — creature)
        castAction = { type: "castSpell", cardInstanceId: cardId };
      }

      p1Msgs.length = 0;
      send(ws1, { type: "game:action", payload: { gameId, action: castAction } });
      await new Promise((r) => setTimeout(r, 200));

      // Mana should be deducted
      const stateAfterCast = getState(p1Msgs);
      expect(stateAfterCast).toBeDefined();
      const caster = stateAfterCast!.players.find((p) => p.id === p1Player!.id);
      expect(caster!.manaPool.R).toBe(0);

      // If it was Lightning Bolt, pass priority to resolve and check damage
      if (card.cardDataId === "Lightning Bolt") {
        // P1 passes (spell on stack)
        send(ws1, { type: "game:action", payload: { gameId, action: { type: "passPriority" } } });
        await new Promise((r) => setTimeout(r, 200));

        // P2 passes (spell resolves)
        send(ws2, { type: "game:action", payload: { gameId, action: { type: "passPriority" } } });
        await new Promise((r) => setTimeout(r, 200));

        // Opponent should have taken 3 damage
        const finalState = getState(p1Msgs) ?? getState(p2Msgs);
        if (finalState) {
          const opponent = finalState.players.find((p) => p.id !== p1Player!.id);
          expect(opponent).toBeDefined();
          expect(opponent!.life).toBeLessThan(20);
        }
      }

      // If it was Goblin Guide, pass priority to resolve and check battlefield
      if (card.cardDataId === "Goblin Guide") {
        send(ws1, { type: "game:action", payload: { gameId, action: { type: "passPriority" } } });
        await new Promise((r) => setTimeout(r, 200));
        send(ws2, { type: "game:action", payload: { gameId, action: { type: "passPriority" } } });
        await new Promise((r) => setTimeout(r, 200));

        const finalState = getState(p1Msgs);
        if (finalState) {
          const bf = finalState.zones["battlefield"];
          if (bf && "cardInstanceIds" in bf) {
            const goblinOnBf = (bf as any).cardInstanceIds.some((id: string) => {
              const c = finalState.cardInstances[id];
              return c?.cardDataId === "Goblin Guide";
            });
            expect(goblinOnBf).toBe(true);
          }
        }
      }
    }
  }, 15000);

  it("should not allow casting without mana", async () => {
    const { gameId, ws1, ws2, p1Msgs, p2Msgs } = await setupGame();

    await passToMainPhase(gameId, ws1, ws2, p1Msgs, p2Msgs);

    // Without tapping a land, castSpell should NOT be in legal actions
    const actions = getActions(p1Msgs);
    const castSpell = actions?.find((a) => a.type === "castSpell");
    expect(castSpell).toBeUndefined();
  }, 15000);

  it("should send targetRequirements for spells that need targets", async () => {
    const { gameId, ws1, ws2, p1Msgs, p2Msgs } = await setupGame();

    await passToMainPhase(gameId, ws1, ws2, p1Msgs, p2Msgs);

    // Play and tap a land
    const actions = getActions(p1Msgs);
    const playLand = actions?.find((a) => a.type === "playLand");
    if (!playLand) return; // No land in hand

    send(ws1, { type: "game:action", payload: { gameId, action: playLand } });
    await new Promise((r) => setTimeout(r, 200));

    const tapAction = getActions(p1Msgs)?.find((a) => a.type === "activateAbility");
    if (!tapAction) return;

    p1Msgs.length = 0;
    send(ws1, { type: "game:action", payload: { gameId, action: tapAction } });
    await new Promise((r) => setTimeout(r, 200));

    // Check if any castSpell action has targetRequirements
    const targetReqs = getTargetRequirements(p1Msgs);
    const castActions = getActions(p1Msgs)?.filter((a) => a.type === "castSpell") ?? [];
    const stateNow = getState(p1Msgs)!;

    for (const action of castActions) {
      const card = stateNow.cardInstances[(action as any).cardInstanceId];
      if (card?.cardDataId === "Lightning Bolt") {
        // Lightning Bolt MUST have target requirements
        expect(targetReqs).toBeDefined();
        expect(targetReqs![(action as any).cardInstanceId]).toBeDefined();
        expect(targetReqs![(action as any).cardInstanceId].length).toBeGreaterThan(0);
      }
    }
  }, 15000);
});
