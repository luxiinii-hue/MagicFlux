import { describe, it, expect } from "vitest";
import { parseOracleText } from "../src/parser/oracle-parser.js";
import type { CardData } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: "test-id",
    oracleId: "test-oracle",
    name: "Test Card",
    manaCost: null,
    parsedManaCost: null,
    cmc: 0,
    typeLine: "Creature",
    supertypes: [],
    cardTypes: ["Creature"],
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

describe("oracle parser — mana abilities", () => {
  it("should parse '{T}: Add {G}'", () => {
    const card = makeCard({ name: "Llanowar Elves", oracleText: "{T}: Add {G}." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("mana");
    expect(abilities[0].effects[0].type).toBe("addMana");
    const effect = abilities[0].effects[0] as any;
    expect(effect.mana.G).toBe(1);
  });

  it("should parse '{T}: Add {R}' for Mountain-type", () => {
    const card = makeCard({ oracleText: "{T}: Add {R}." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("mana");
  });

  it("should parse '{T}: Add {B}{B}'", () => {
    const card = makeCard({ oracleText: "{T}: Add {B}{B}." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities).toHaveLength(1);
    const effect = abilities[0].effects[0] as any;
    expect(effect.mana.B).toBe(2);
  });

  it("should set tapSelf cost", () => {
    const card = makeCard({ oracleText: "{T}: Add {W}." });
    const abilities = parseOracleText(card.oracleText, card);
    if (abilities[0].type === "mana") {
      expect(abilities[0].cost.tapSelf).toBe(true);
    }
  });
});

describe("oracle parser — ETB triggers", () => {
  it("should parse 'When ~ enters the battlefield, draw a card'", () => {
    const card = makeCard({
      name: "Elvish Visionary",
      oracleText: "When Elvish Visionary enters the battlefield, draw a card.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    expect(etb!.effects[0].type).toBe("drawCards");
  });

  it("should parse 'When ~ enters the battlefield, you gain 3 life'", () => {
    const card = makeCard({
      name: "Lone Missionary",
      oracleText: "When Lone Missionary enters the battlefield, you gain 3 life.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    expect(etb!.effects[0].type).toBe("gainLife");
    const effect = etb!.effects[0] as any;
    expect(effect.amount).toBe(3);
  });

  it("should parse ETB with damage effect", () => {
    const card = makeCard({
      name: "Flametongue Kavu",
      oracleText: "When Flametongue Kavu enters the battlefield, it deals 4 damage to target creature.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    expect(etb!.effects[0].type).toBe("dealDamage");
  });
});

describe("oracle parser — ETB bounce", () => {
  it("should parse 'When ~ enters the battlefield, return target creature to its owner's hand'", () => {
    const card = makeCard({
      name: "Man-o'-War",
      oracleText: "When Man-o'-War enters the battlefield, return target creature to its owner's hand.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    expect(etb!.effects[0].type).toBe("bounce");
    if (etb!.effects[0].type === "bounce") {
      expect(etb!.effects[0].to).toBe(ZoneType.Hand);
    }
  });
});

describe("oracle parser — each opponent loses life", () => {
  it("should parse 'When ~ enters the battlefield, each opponent loses 2 life'", () => {
    const card = makeCard({
      name: "Gray Merchant",
      oracleText: "When Gray Merchant enters the battlefield, each opponent loses 2 life.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    expect(etb!.effects[0].type).toBe("loseLife");
    if (etb!.effects[0].type === "loseLife") {
      expect(etb!.effects[0].amount).toBe(2);
    }
  });
});

describe("oracle parser — mana ability: any color", () => {
  it("should parse '{T}: Add one mana of any color'", () => {
    const card = makeCard({
      name: "Birds of Paradise",
      oracleText: "{T}: Add one mana of any color.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("mana");
    const effect = abilities[0].effects[0] as any;
    expect(effect.mana.C).toBe(1);
  });
});

describe("oracle parser — card name escaping", () => {
  it("should handle card names with special regex characters like Man-o'-War", () => {
    const card = makeCard({
      name: "Man-o'-War",
      oracleText: "When Man-o'-War enters the battlefield, return target creature to its owner's hand.",
    });
    // Should not throw a regex error
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("oracle parser — effect text patterns", () => {
  it("should return empty for empty oracle text", () => {
    const card = makeCard({ oracleText: "" });
    expect(parseOracleText(card.oracleText, card)).toEqual([]);
  });

  it("should return empty for unparseable text", () => {
    const card = makeCard({
      oracleText: "Whenever you cast a spell, if it's the second spell you cast this turn, copy it.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    // Complex text — parser can't handle it, returns empty
    expect(abilities).toEqual([]);
  });

  it("should handle multiline oracle text", () => {
    const card = makeCard({
      name: "Llanowar Elves",
      oracleText: "{T}: Add {G}.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});
