import { describe, it, expect } from "vitest";
import { parseOracleText } from "../src/parser/oracle-parser.js";
import type { CardData } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: "test-id", oracleId: "test-oracle", name: "Test Card",
    manaCost: null, parsedManaCost: null, cmc: 0, typeLine: "Creature",
    supertypes: [], cardTypes: ["Creature"], subtypes: [],
    oracleText: "", power: null, toughness: null, loyalty: null, defense: null,
    colors: [], colorIdentity: [], keywords: [], layout: "normal",
    faces: null, imageUris: null, legalities: {}, isToken: false, producedMana: null,
    ...overrides,
  };
}

describe("oracle parser v3 — board wipes", () => {
  it("should parse 'Destroy all creatures'", () => {
    const card = makeCard({ oracleText: "Destroy all creatures." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    expect(abilities[0].effects[0].type).toBe("custom");
  });

  it("should parse 'Exile all creatures'", () => {
    const card = makeCard({ oracleText: "Exile all creatures." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("oracle parser v3 — modal spells", () => {
  it("should parse 'Choose one —' with two modes", () => {
    const card = makeCard({
      oracleText: "Choose one —\n• Destroy target creature.\n• You gain 5 life.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    const modal = abilities.find((a) => a.effects[0]?.type === "playerChoice");
    expect(modal).toBeDefined();
  });
});

describe("oracle parser v3 — landfall triggers", () => {
  it("should parse 'Whenever a land enters the battlefield under your control, [effect]'", () => {
    const card = makeCard({
      name: "Lotus Cobra",
      oracleText: "Whenever a land enters the battlefield under your control, you gain 1 life.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger?.type === "triggered") {
      expect(trigger.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(trigger.triggerCondition.self).toBe(false);
    }
  });
});

describe("oracle parser v3 — non-self creature triggers", () => {
  it("should parse 'Whenever a creature enters the battlefield, [effect]'", () => {
    const card = makeCard({
      oracleText: "Whenever a creature enters the battlefield, you draw a card.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger?.type === "triggered") {
      expect(trigger.triggerCondition.self).toBe(false);
    }
  });

  it("should parse 'Whenever a creature you control dies, [effect]'", () => {
    const card = makeCard({
      oracleText: "Whenever a creature you control dies, you draw a card.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
  });
});

describe("oracle parser v3 — sacrifice non-self costs", () => {
  it("should parse '{1}, Sacrifice a creature: [effect]'", () => {
    const card = makeCard({
      oracleText: "{1}, Sacrifice a creature: Draw a card.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const activated = abilities.find((a) => a.type === "activated");
    expect(activated).toBeDefined();
    if (activated?.type === "activated") {
      expect(activated.cost.sacrifice).not.toBeNull();
      expect(activated.cost.sacrifice!.self).toBe(false);
    }
  });
});

describe("oracle parser v3 — search/tutor", () => {
  it("should parse 'Search your library for a creature card'", () => {
    const card = makeCard({
      oracleText: "Search your library for a creature card, reveal it, and put it into your hand.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    expect(abilities[0].effects[0].type).toBe("search");
  });
});

describe("oracle parser v3 — mill", () => {
  it("should parse 'Mill 3 cards'", () => {
    const card = makeCard({ oracleText: "Mill 3 cards." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });

  it("should parse 'Target player mills 4 cards'", () => {
    const card = makeCard({ oracleText: "Target player mills 4 cards." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("oracle parser v3 — treasure tokens", () => {
  it("should parse 'Create a Treasure token'", () => {
    const card = makeCard({ oracleText: "Create a Treasure token." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    const effect = abilities[0].effects[0];
    expect(effect.type).toBe("createToken");
    if (effect.type === "createToken") {
      expect(effect.token.name).toBe("Treasure");
    }
  });

  it("should parse 'Create two Treasure tokens'", () => {
    const card = makeCard({ oracleText: "Create two Treasure tokens." });
    const abilities = parseOracleText(card.oracleText, card);
    const effect = abilities[0].effects[0];
    if (effect.type === "createToken") {
      expect(effect.count).toBe(2);
    }
  });
});

describe("oracle parser v3 — static abilities", () => {
  it("should parse '~ can't be blocked'", () => {
    const card = makeCard({ oracleText: "Test Card can't be blocked." });
    const abilities = parseOracleText(card.oracleText, card);
    const staticA = abilities.find((a) => a.type === "static");
    expect(staticA).toBeDefined();
  });

  it("should parse anthem: 'Other creatures you control get +1/+1'", () => {
    const card = makeCard({ oracleText: "Other creatures you control get +1/+1." });
    const abilities = parseOracleText(card.oracleText, card);
    const staticA = abilities.find((a) => a.type === "static");
    expect(staticA).toBeDefined();
    if (staticA?.type === "static") {
      expect(staticA.continuousEffect.effectType).toBe("modifyPT");
    }
  });

  it("should parse keyword grant: 'Other creatures you control have flying'", () => {
    const card = makeCard({ oracleText: "Other creatures you control have flying." });
    const abilities = parseOracleText(card.oracleText, card);
    const staticA = abilities.find((a) => a.type === "static");
    expect(staticA).toBeDefined();
    if (staticA?.type === "static") {
      expect(staticA.continuousEffect.effectType).toBe("grantKeyword");
    }
  });

  it("should parse cost tax: 'Noncreature spells cost {1} more'", () => {
    const card = makeCard({ oracleText: "Noncreature spells cost {1} more to cast." });
    const abilities = parseOracleText(card.oracleText, card);
    const staticA = abilities.find((a) => a.type === "static");
    expect(staticA).toBeDefined();
    if (staticA?.type === "static") {
      expect(staticA.continuousEffect.effectType).toBe("costIncrease");
    }
  });
});

describe("oracle parser v3 — linked ability pairs", () => {
  it("should parse ETB exile + LTB return pattern", () => {
    const card = makeCard({
      name: "Banisher Priest",
      oracleText: "When Banisher Priest enters the battlefield, exile target creature an opponent controls.\nWhen Banisher Priest leaves the battlefield, return the exiled card to the battlefield.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(2);

    const etb = abilities.find((a) => a.type === "triggered" && a.id.includes("etb"));
    const ltb = abilities.find((a) => a.type === "triggered" && a.id.includes("ltb"));
    expect(etb).toBeDefined();
    expect(ltb).toBeDefined();

    // ETB should have exile effect
    expect(etb!.effects[0].type).toBe("exile");
    // LTB should have custom return effect
    expect(ltb!.effects[0].type).toBe("custom");
  });
});

describe("oracle parser v3 — multi-ability cards", () => {
  it("should parse multiple abilities from one card", () => {
    const card = makeCard({
      name: "Elvish Mystic",
      oracleText: "{T}: Add {G}.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("mana");
  });

  it("should parse a creature with keyword line + ability", () => {
    const card = makeCard({
      oracleText: "Flying\nWhenever ~ deals combat damage to a player, you draw a card.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    // "Flying" line should be skipped (keyword registry handles it)
    // Only the triggered ability should be parsed
    const triggers = abilities.filter((a) => a.type === "triggered");
    expect(triggers).toHaveLength(1);
  });

  it("should parse ETB + mana ability on same card", () => {
    const card = makeCard({
      name: "Burning-Tree Emissary",
      oracleText: "When Burning-Tree Emissary enters the battlefield, you gain 1 life.\n{T}: Add {G}.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(2);

    const mana = abilities.find((a) => a.type === "mana");
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(mana).toBeDefined();
    expect(trigger).toBeDefined();
  });

  it("should generate independent SpellAbility objects for each ability", () => {
    const card = makeCard({
      name: "Korvold",
      oracleText: "Whenever ~ attacks, you draw a card.\nWhenever a creature you control dies, you draw a card.",
    });
    const abilities = parseOracleText(card.oracleText, card);
    const triggers = abilities.filter((a) => a.type === "triggered");
    expect(triggers.length).toBeGreaterThanOrEqual(2);

    // Each trigger should have a unique id
    const ids = triggers.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Each trigger should have independent triggerCondition
    if (triggers.length >= 2 && triggers[0].type === "triggered" && triggers[1].type === "triggered") {
      expect(triggers[0].triggerCondition.eventType).not.toBe(triggers[1].triggerCondition.eventType);
    }
  });
});

describe("oracle parser v3 — counter spells from text", () => {
  it("should parse 'Counter target spell'", () => {
    const card = makeCard({ oracleText: "Counter target spell." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    expect(abilities[0].effects[0].type).toBe("counter");
  });
});

describe("oracle parser v3 — prevent damage", () => {
  it("should parse 'Prevent all combat damage'", () => {
    const card = makeCard({ oracleText: "Prevent all combat damage that would be dealt this turn." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("oracle parser v3 — each effects", () => {
  it("should parse 'Each player draws a card'", () => {
    const card = makeCard({ oracleText: "Each player draws a card." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });

  it("should parse 'Each opponent discards a card'", () => {
    const card = makeCard({ oracleText: "Each opponent discards a card." });
    const abilities = parseOracleText(card.oracleText, card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});
