import { describe, it, expect } from "vitest";
import { STARTING_HAND_SIZE } from "@magic-flux/types";
import { performMulligan, putCardsOnBottom } from "../src/mulligan.js";
import { twoPlayerGame } from "./helpers.js";
import { handKey, libraryKey } from "../src/zones/transfers.js";

describe("London mulligan", () => {
  it("should shuffle hand into library and draw 7 new cards", () => {
    const state = twoPlayerGame();
    const handBefore = state.zones[handKey("p1")].cardInstanceIds;
    expect(handBefore).toHaveLength(STARTING_HAND_SIZE);

    const { state: afterMulligan } = performMulligan(state, "p1", 1);
    const handAfter = afterMulligan.zones[handKey("p1")].cardInstanceIds;

    // Still 7 cards in hand
    expect(handAfter).toHaveLength(STARTING_HAND_SIZE);
    // Library should still have 53 cards (60 - 7)
    expect(afterMulligan.zones[libraryKey("p1")].cardInstanceIds).toHaveLength(53);
  });

  it("should produce different hands after mulligan (reshuffled)", () => {
    const state = twoPlayerGame(42);
    const handBefore = [...state.zones[handKey("p1")].cardInstanceIds];

    const { state: after } = performMulligan(state, "p1", 1);
    const handAfter = [...after.zones[handKey("p1")].cardInstanceIds];

    // Very unlikely to be identical after shuffle
    expect(handAfter).not.toEqual(handBefore);
  });

  it("should put cards on bottom of library after mulligan decision", () => {
    const state = twoPlayerGame();
    const { state: afterMulligan } = performMulligan(state, "p1", 1);

    // Put 1 card on bottom (mulliganed once = put 1 back)
    const hand = afterMulligan.zones[handKey("p1")].cardInstanceIds;
    const cardToBottom = hand[0];

    const { state: afterPutBack } = putCardsOnBottom(afterMulligan, "p1", [cardToBottom]);

    // Hand should have 6 cards now
    expect(afterPutBack.zones[handKey("p1")].cardInstanceIds).toHaveLength(6);
    // Library should have 54 cards
    expect(afterPutBack.zones[libraryKey("p1")].cardInstanceIds).toHaveLength(54);
    // The card should be at the bottom of the library
    const lib = afterPutBack.zones[libraryKey("p1")].cardInstanceIds;
    expect(lib[lib.length - 1]).toBe(cardToBottom);
  });
});
