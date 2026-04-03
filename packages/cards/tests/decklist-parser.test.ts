import { describe, it, expect, beforeAll } from "vitest";
import type { CardData } from "@magic-flux/types";
import { buildIndexes } from "../src/registry/card-registry.js";
import {
  parseDecklistText,
  exportDecklistText,
  validateDecklist,
} from "../src/parser/decklist-parser.js";

// ---------------------------------------------------------------------------
// Test card data
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CardData> & { id: string; name: string }): CardData {
  return {
    oracleId: `oracle-${overrides.id}`,
    manaCost: null,
    parsedManaCost: null,
    cmc: 0,
    typeLine: "Instant",
    supertypes: [],
    cardTypes: ["Instant"],
    subtypes: [],
    oracleText: "",
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [],
    colorIdentity: [],
    keywords: [],
    layout: "normal",
    faces: null,
    imageUris: null,
    legalities: {},
    isToken: false,
    producedMana: null,
    ...overrides,
  };
}

const testCards = [
  makeCard({ id: "bolt-id", name: "Lightning Bolt", colors: ["R"], colorIdentity: ["R"], cmc: 1, legalities: { standard: "not_legal", modern: "legal", commander: "legal" } }),
  makeCard({ id: "serra-id", name: "Serra Angel", colors: ["W"], colorIdentity: ["W"], cmc: 5, cardTypes: ["Creature"], legalities: { modern: "legal", commander: "legal" } }),
  makeCard({ id: "counterspell-id", name: "Counterspell", colors: ["U"], colorIdentity: ["U"], cmc: 2, legalities: { modern: "legal", commander: "legal" } }),
  makeCard({ id: "plains-id", name: "Plains", supertypes: ["Basic"], cardTypes: ["Land"], legalities: { standard: "legal", modern: "legal", commander: "legal" } }),
  makeCard({ id: "island-id", name: "Island", supertypes: ["Basic"], cardTypes: ["Land"], legalities: { standard: "legal", modern: "legal", commander: "legal" } }),
  makeCard({ id: "mountain-id", name: "Mountain", supertypes: ["Basic"], cardTypes: ["Land"], legalities: { standard: "legal", modern: "legal", commander: "legal" } }),
  makeCard({ id: "grizzly-id", name: "Grizzly Bears", colors: ["G"], colorIdentity: ["G"], cmc: 2, cardTypes: ["Creature"], legalities: { modern: "legal", commander: "legal" } }),
  makeCard({ id: "doom-id", name: "Doom Blade", colors: ["B"], colorIdentity: ["B"], cmc: 2, legalities: { modern: "legal", commander: "legal" } }),
  makeCard({ id: "banned-id", name: "Banned Card", legalities: { modern: "banned", commander: "banned" } }),
  makeCard({
    id: "commander-id",
    name: "Atraxa, Praetors' Voice",
    supertypes: ["Legendary"],
    cardTypes: ["Creature"],
    colors: ["W", "U", "B", "G"],
    colorIdentity: ["W", "U", "B", "G"],
    legalities: { commander: "legal" },
  }),
];

beforeAll(() => {
  buildIndexes(testCards);
});

// ---------------------------------------------------------------------------
// Parsing tests
// ---------------------------------------------------------------------------

describe("parseDecklistText", () => {
  it("should parse basic entries", () => {
    const text = "4 Lightning Bolt\n20 Mountain";
    const { decklist, unresolvedCards } = parseDecklistText(text);
    expect(unresolvedCards).toHaveLength(0);
    expect(decklist.mainboard).toHaveLength(2);
    expect(decklist.mainboard[0].count).toBe(4);
    expect(decklist.mainboard[0].cardName).toBe("Lightning Bolt");
    expect(decklist.mainboard[0].cardDataId).toBe("bolt-id");
    expect(decklist.mainboard[1].count).toBe(20);
    expect(decklist.mainboard[1].cardName).toBe("Mountain");
  });

  it("should parse entries with set code and collector number", () => {
    const text = "4 Lightning Bolt (CLU) 141";
    const { decklist } = parseDecklistText(text);
    expect(decklist.mainboard[0].setCode).toBe("CLU");
    expect(decklist.mainboard[0].collectorNumber).toBe("141");
  });

  it("should handle section headers", () => {
    const text = `4 Lightning Bolt\n20 Mountain\n\nSideboard\n2 Doom Blade`;
    const { decklist } = parseDecklistText(text);
    expect(decklist.mainboard).toHaveLength(2);
    expect(decklist.sideboard).toHaveLength(1);
    expect(decklist.sideboard[0].cardName).toBe("Doom Blade");
    expect(decklist.sideboard[0].count).toBe(2);
  });

  it("should handle Commander section", () => {
    const text = `Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n99 Plains`;
    const { decklist } = parseDecklistText(text, "Test", "commander");
    expect(decklist.commander).not.toBeNull();
    expect(decklist.commander!.cardName).toBe("Atraxa, Praetors' Voice");
    // Commander also appears in mainboard
    expect(decklist.mainboard.some(e => e.cardName === "Atraxa, Praetors' Voice")).toBe(true);
  });

  it("should skip comments and blank lines", () => {
    const text = "// My cool deck\n\n4 Lightning Bolt\n// sideboard stuff\n\nSideboard\n2 Counterspell";
    const { decklist } = parseDecklistText(text);
    expect(decklist.mainboard).toHaveLength(1);
    expect(decklist.sideboard).toHaveLength(1);
  });

  it("should track unresolved card names", () => {
    const text = "4 Totally Fake Card\n4 Lightning Bolt";
    const { decklist, unresolvedCards } = parseDecklistText(text);
    expect(unresolvedCards).toEqual(["Totally Fake Card"]);
    expect(decklist.mainboard).toHaveLength(2);
    expect(decklist.mainboard[0].cardDataId).toBeNull();
    expect(decklist.mainboard[1].cardDataId).toBe("bolt-id");
  });

  it("should handle section headers with colons", () => {
    const text = "4 Lightning Bolt\n\nSideboard:\n2 Counterspell";
    const { decklist } = parseDecklistText(text);
    expect(decklist.sideboard).toHaveLength(1);
  });

  it("should use provided deck name and format", () => {
    const { decklist } = parseDecklistText("4 Lightning Bolt", "My Deck", "modern");
    expect(decklist.name).toBe("My Deck");
    expect(decklist.format).toBe("modern");
  });

  it("should handle case-insensitive card name resolution", () => {
    const text = "4 lightning bolt";
    const { decklist, unresolvedCards } = parseDecklistText(text);
    expect(unresolvedCards).toHaveLength(0);
    expect(decklist.mainboard[0].cardDataId).toBe("bolt-id");
    expect(decklist.mainboard[0].cardName).toBe("Lightning Bolt"); // resolved name
  });

  it("should parse MTGA-style format", () => {
    const text = `Deck
4 Lightning Bolt
4 Serra Angel
24 Mountain

Sideboard
4 Counterspell`;
    const { decklist } = parseDecklistText(text);
    expect(decklist.mainboard).toHaveLength(3);
    expect(decklist.sideboard).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Export tests
// ---------------------------------------------------------------------------

describe("exportDecklistText", () => {
  it("should export mainboard sorted alphabetically", () => {
    const text = exportDecklistText({
      name: "Test",
      format: "modern",
      mainboard: [
        { count: 4, cardName: "Serra Angel", cardDataId: null, setCode: null, collectorNumber: null },
        { count: 4, cardName: "Lightning Bolt", cardDataId: null, setCode: null, collectorNumber: null },
        { count: 20, cardName: "Mountain", cardDataId: null, setCode: null, collectorNumber: null },
      ],
      sideboard: [],
      commander: null,
      companion: null,
    });

    const lines = text.split("\n");
    expect(lines[0]).toBe("4 Lightning Bolt");
    expect(lines[1]).toBe("20 Mountain");
    expect(lines[2]).toBe("4 Serra Angel");
  });

  it("should include sideboard section", () => {
    const text = exportDecklistText({
      name: "Test",
      format: "modern",
      mainboard: [
        { count: 4, cardName: "Lightning Bolt", cardDataId: null, setCode: null, collectorNumber: null },
      ],
      sideboard: [
        { count: 2, cardName: "Counterspell", cardDataId: null, setCode: null, collectorNumber: null },
      ],
      commander: null,
      companion: null,
    });

    expect(text).toContain("Sideboard");
    expect(text).toContain("2 Counterspell");
  });

  it("should include set code when present", () => {
    const text = exportDecklistText({
      name: "Test",
      format: "modern",
      mainboard: [
        { count: 4, cardName: "Lightning Bolt", cardDataId: null, setCode: "CLU", collectorNumber: "141" },
      ],
      sideboard: [],
      commander: null,
      companion: null,
    });

    expect(text).toContain("4 Lightning Bolt (CLU) 141");
  });

  it("should be round-trippable with parseDecklistText", () => {
    const original = `4 Counterspell\n4 Lightning Bolt\n20 Mountain\n4 Serra Angel\n\nSideboard\n2 Doom Blade`;
    const { decklist } = parseDecklistText(original, "Test", "modern");
    const exported = exportDecklistText(decklist);
    const { decklist: reparsed } = parseDecklistText(exported, "Test", "modern");

    expect(reparsed.mainboard.length).toBe(decklist.mainboard.length);
    expect(reparsed.sideboard.length).toBe(decklist.sideboard.length);
  });
});

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

describe("validateDecklist — Standard/Modern", () => {
  function makeModernDeck(mainCount: number, sideCount: number): import("@magic-flux/types").Decklist {
    const mainboard = [
      { count: 4, cardName: "Lightning Bolt", cardDataId: "bolt-id", setCode: null, collectorNumber: null },
      { count: 4, cardName: "Counterspell", cardDataId: "counterspell-id", setCode: null, collectorNumber: null },
      { count: mainCount - 8, cardName: "Mountain", cardDataId: "mountain-id", setCode: null, collectorNumber: null },
    ];
    const sideboard = sideCount > 0
      ? [{ count: sideCount, cardName: "Doom Blade", cardDataId: "doom-id", setCode: null, collectorNumber: null }]
      : [];

    return { name: "Test", format: "modern", mainboard, sideboard, commander: null, companion: null };
  }

  it("should accept valid 60-card deck", () => {
    const result = validateDecklist(makeModernDeck(60, 0), "modern");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject deck with fewer than 60 mainboard cards", () => {
    const result = validateDecklist(makeModernDeck(40, 0), "modern");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("minimum is 60"))).toBe(true);
  });

  it("should reject sideboard over 15 cards", () => {
    const result = validateDecklist(makeModernDeck(60, 16), "modern");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("maximum is 15"))).toBe(true);
  });

  it("should reject more than 4 copies of a non-basic card", () => {
    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "modern",
      mainboard: [
        { count: 5, cardName: "Lightning Bolt", cardDataId: "bolt-id", setCode: null, collectorNumber: null },
        { count: 55, cardName: "Mountain", cardDataId: "mountain-id", setCode: null, collectorNumber: null },
      ],
      sideboard: [],
      commander: null,
      companion: null,
    };
    const result = validateDecklist(deck, "modern");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("4-copy limit"))).toBe(true);
  });

  it("should allow unlimited basic lands", () => {
    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "modern",
      mainboard: [
        { count: 4, cardName: "Lightning Bolt", cardDataId: "bolt-id", setCode: null, collectorNumber: null },
        { count: 56, cardName: "Mountain", cardDataId: "mountain-id", setCode: null, collectorNumber: null },
      ],
      sideboard: [],
      commander: null,
      companion: null,
    };
    const result = validateDecklist(deck, "modern");
    expect(result.valid).toBe(true);
  });

  it("should flag banned cards", () => {
    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "modern",
      mainboard: [
        { count: 4, cardName: "Banned Card", cardDataId: "banned-id", setCode: null, collectorNumber: null },
        { count: 56, cardName: "Mountain", cardDataId: "mountain-id", setCode: null, collectorNumber: null },
      ],
      sideboard: [],
      commander: null,
      companion: null,
    };
    const result = validateDecklist(deck, "modern");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("banned"))).toBe(true);
  });
});

describe("validateDecklist — Commander", () => {
  it("should accept valid 100-card singleton deck", () => {
    const mainboard: import("@magic-flux/types").DecklistEntry[] = [
      { count: 1, cardName: "Atraxa, Praetors' Voice", cardDataId: "commander-id", setCode: null, collectorNumber: null },
      { count: 1, cardName: "Serra Angel", cardDataId: "serra-id", setCode: null, collectorNumber: null },
      { count: 1, cardName: "Counterspell", cardDataId: "counterspell-id", setCode: null, collectorNumber: null },
      { count: 97, cardName: "Plains", cardDataId: "plains-id", setCode: null, collectorNumber: null },
    ];

    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "commander",
      mainboard,
      sideboard: [],
      commander: mainboard[0],
      companion: null,
    };

    const result = validateDecklist(deck, "commander");
    expect(result.valid).toBe(true);
  });

  it("should reject non-100 card deck", () => {
    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "commander",
      mainboard: [
        { count: 1, cardName: "Atraxa, Praetors' Voice", cardDataId: "commander-id", setCode: null, collectorNumber: null },
        { count: 50, cardName: "Plains", cardDataId: "plains-id", setCode: null, collectorNumber: null },
      ],
      sideboard: [],
      commander: { count: 1, cardName: "Atraxa, Praetors' Voice", cardDataId: "commander-id", setCode: null, collectorNumber: null },
      companion: null,
    };

    const result = validateDecklist(deck, "commander");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("exactly 100"))).toBe(true);
  });

  it("should reject non-singleton entries", () => {
    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "commander",
      mainboard: [
        { count: 1, cardName: "Atraxa, Praetors' Voice", cardDataId: "commander-id", setCode: null, collectorNumber: null },
        { count: 2, cardName: "Serra Angel", cardDataId: "serra-id", setCode: null, collectorNumber: null },
        { count: 97, cardName: "Plains", cardDataId: "plains-id", setCode: null, collectorNumber: null },
      ],
      sideboard: [],
      commander: { count: 1, cardName: "Atraxa, Praetors' Voice", cardDataId: "commander-id", setCode: null, collectorNumber: null },
      companion: null,
    };

    const result = validateDecklist(deck, "commander");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("singleton"))).toBe(true);
  });

  it("should require a commander", () => {
    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "commander",
      mainboard: [{ count: 100, cardName: "Plains", cardDataId: "plains-id", setCode: null, collectorNumber: null }],
      sideboard: [],
      commander: null,
      companion: null,
    };

    const result = validateDecklist(deck, "commander");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("commander"))).toBe(true);
  });

  it("should reject cards outside commander color identity", () => {
    const mainboard: import("@magic-flux/types").DecklistEntry[] = [
      { count: 1, cardName: "Atraxa, Praetors' Voice", cardDataId: "commander-id", setCode: null, collectorNumber: null },
      { count: 1, cardName: "Lightning Bolt", cardDataId: "bolt-id", setCode: null, collectorNumber: null }, // R not in WUBG
      { count: 98, cardName: "Plains", cardDataId: "plains-id", setCode: null, collectorNumber: null },
    ];

    const deck: import("@magic-flux/types").Decklist = {
      name: "Test",
      format: "commander",
      mainboard,
      sideboard: [],
      commander: mainboard[0],
      companion: null,
    };

    const result = validateDecklist(deck, "commander");
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("color identity"))).toBe(true);
  });
});
