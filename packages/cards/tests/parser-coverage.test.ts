/**
 * Parser coverage tests — verify that the oracle parser v3 correctly handles
 * cards that DON'T have manual overrides. These cards rely entirely on
 * the keyword registry + oracle parser for their abilities.
 *
 * Each test simulates what populateCardAbilities does: pass oracle text
 * through the parser and verify the resulting SpellAbility objects.
 */

import { describe, it, expect } from "vitest";
import { parseOracleText } from "../src/parser/oracle-parser.js";
import { generateKeywordAbilities } from "../src/keywords/index.js";
import type { CardData } from "@magic-flux/types";

function makeCard(name: string, oracleText: string, keywords: string[] = [], overrides: Partial<CardData> = {}): CardData {
  return {
    id: `test-${name}`, oracleId: `oracle-${name}`, name, manaCost: null, parsedManaCost: null,
    cmc: 0, typeLine: "Creature", supertypes: [], cardTypes: ["Creature"], subtypes: [],
    oracleText, power: null, toughness: null, loyalty: null, defense: null,
    colors: [], colorIdentity: [], keywords, layout: "normal",
    faces: null, imageUris: null, legalities: {}, isToken: false, producedMana: null,
    ...overrides,
  };
}

/** Simulate the full three-tier resolution (no overrides — only keywords + parser) */
function resolveAbilities(card: CardData): any[] {
  const kw = generateKeywordAbilities(card.keywords);
  const parsed = parseOracleText(card.oracleText, card);
  return [...kw, ...parsed];
}

describe("vanilla/French-vanilla creatures (keywords only)", () => {
  it("should handle a vanilla 2/2 with no abilities", () => {
    const card = makeCard("Grizzly Bears", "", []);
    expect(resolveAbilities(card)).toEqual([]);
  });

  it("should handle Flying keyword", () => {
    const abilities = resolveAbilities(makeCard("Wind Drake", "Flying", ["Flying"]));
    expect(abilities.length).toBeGreaterThanOrEqual(1);
    expect(abilities.some((a: any) => a.type === "static" && a.id === "kw_flying")).toBe(true);
  });

  it("should handle multiple keywords", () => {
    const abilities = resolveAbilities(makeCard("Vampire Nighthawk", "Flying, deathtouch, lifelink", ["Flying", "Deathtouch", "Lifelink"]));
    expect(abilities.length).toBe(3);
  });

  it("should handle First Strike + Vigilance", () => {
    const abilities = resolveAbilities(makeCard("Boros Elite", "First strike, vigilance", ["First Strike", "Vigilance"]));
    expect(abilities.length).toBe(2);
  });
});

describe("mana dorks (tap for mana)", () => {
  it("should parse Elvish Mystic: {T}: Add {G}", () => {
    const abilities = resolveAbilities(makeCard("Elvish Mystic", "{T}: Add {G}."));
    expect(abilities.some((a: any) => a.type === "mana")).toBe(true);
  });

  it("should parse Birds of Paradise: {T}: Add one mana of any color", () => {
    const abilities = resolveAbilities(makeCard("Birds of Paradise", "{T}: Add one mana of any color.", ["Flying"]));
    const mana = abilities.find((a: any) => a.type === "mana");
    expect(mana).toBeDefined();
  });
});

describe("ETB creatures (enter-the-battlefield triggers)", () => {
  it("should parse Elvish Visionary: When ~ ETB, draw a card", () => {
    const card = makeCard("Elvish Visionary", "When Elvish Visionary enters the battlefield, draw a card.");
    const abilities = resolveAbilities(card);
    const trigger = abilities.find((a: any) => a.type === "triggered");
    expect(trigger).toBeDefined();
    expect(trigger.effects[0].type).toBe("drawCards");
  });

  it("should parse Lone Missionary: When ~ ETB, gain 4 life", () => {
    const card = makeCard("Lone Missionary", "When Lone Missionary enters the battlefield, you gain 4 life.");
    const abilities = resolveAbilities(card);
    const trigger = abilities.find((a: any) => a.type === "triggered");
    expect(trigger).toBeDefined();
    expect(trigger.effects[0].type).toBe("gainLife");
  });

  it("should parse Ravenous Rats: When ~ ETB, target opponent discards a card", () => {
    const card = makeCard("Ravenous Rats", "When Ravenous Rats enters the battlefield, target opponent discards a card.");
    const abilities = resolveAbilities(card);
    const trigger = abilities.find((a: any) => a.type === "triggered");
    expect(trigger).toBeDefined();
    expect(trigger.effects[0].type).toBe("discardCards");
  });
});

describe("removal instants/sorceries (spell effects)", () => {
  it("should parse Terror: Destroy target nonblack creature", () => {
    const card = makeCard("Terror", "Destroy target nonblack creature.", [], { cardTypes: ["Instant"] });
    const abilities = resolveAbilities(card);
    expect(abilities.some((a: any) => a.effects[0]?.type === "destroy")).toBe(true);
  });

  it("should parse Unsummon: Return target creature to its owner's hand", () => {
    const card = makeCard("Unsummon", "Return target creature to its owner's hand.", [], { cardTypes: ["Instant"] });
    const abilities = resolveAbilities(card);
    expect(abilities.some((a: any) => a.effects[0]?.type === "bounce")).toBe(true);
  });

  it("should parse Lava Axe: Deal 5 damage to target player", () => {
    const card = makeCard("Lava Axe", "Lava Axe deals 5 damage to target player.", [], { cardTypes: ["Sorcery"] });
    const abilities = resolveAbilities(card);
    expect(abilities.some((a: any) => a.effects[0]?.type === "dealDamage")).toBe(true);
  });
});

describe("board wipes", () => {
  it("should parse Wrath of God: Destroy all creatures", () => {
    const card = makeCard("Wrath of God", "Destroy all creatures. They can't be regenerated.", [], { cardTypes: ["Sorcery"] });
    const abilities = resolveAbilities(card);
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });
});

describe("anthem effects (static)", () => {
  it("should parse Glorious Anthem: Other creatures you control get +1/+1", () => {
    const card = makeCard("Glorious Anthem", "Other creatures you control get +1/+1.", [], { cardTypes: ["Enchantment"] });
    const abilities = resolveAbilities(card);
    const anthem = abilities.find((a: any) => a.type === "static");
    expect(anthem).toBeDefined();
  });

  it("should parse Honor of the Pure: Other white creatures you control get +1/+1", () => {
    const card = makeCard("Honor of the Pure", "Other white creatures you control get +1/+1.", [], { cardTypes: ["Enchantment"] });
    const abilities = resolveAbilities(card);
    expect(abilities.some((a: any) => a.type === "static")).toBe(true);
  });
});

describe("landfall triggers", () => {
  it("should parse Steppe Lynx: Whenever a land ETB under your control, +2/+2 until EOT", () => {
    const card = makeCard("Steppe Lynx", "Whenever a land enters the battlefield under your control, Steppe Lynx gets +2/+2 until end of turn.");
    const abilities = resolveAbilities(card);
    const trigger = abilities.find((a: any) => a.type === "triggered");
    expect(trigger).toBeDefined();
  });
});

describe("dies triggers", () => {
  it("should parse Doomed Traveler: When ~ dies, create a 1/1 Spirit token with flying", () => {
    const card = makeCard("Doomed Traveler", "When Doomed Traveler dies, create a 1/1 white Spirit creature token with flying.");
    const abilities = resolveAbilities(card);
    const trigger = abilities.find((a: any) => a.type === "triggered");
    expect(trigger).toBeDefined();
    expect(trigger.effects[0].type).toBe("createToken");
  });
});

describe("attack triggers", () => {
  it("should parse Boros Reckoner: Whenever ~ attacks, draw a card", () => {
    const card = makeCard("Audacious Thief", "Whenever Audacious Thief attacks, you draw a card.");
    const abilities = resolveAbilities(card);
    const trigger = abilities.find((a: any) => a.type === "triggered");
    expect(trigger).toBeDefined();
  });
});

describe("token creation", () => {
  it("should parse Raise the Alarm: Create two 1/1 white Soldier creature tokens", () => {
    const card = makeCard("Raise the Alarm", "Create two 1/1 white Soldier creature tokens.", [], { cardTypes: ["Instant"] });
    const abilities = resolveAbilities(card);
    expect(abilities.some((a: any) => a.effects[0]?.type === "createToken")).toBe(true);
  });
});

describe("counter placement", () => {
  it("should parse Dromoka's Gift: Put a +1/+1 counter on target creature", () => {
    const card = makeCard("Travel Preparations", "Put a +1/+1 counter on target creature.", [], { cardTypes: ["Sorcery"] });
    const abilities = resolveAbilities(card);
    expect(abilities.some((a: any) => a.effects[0]?.type === "addCounters")).toBe(true);
  });
});

describe("cycling", () => {
  it("should parse Cycling {2}", () => {
    const card = makeCard("Hieroglyphic Illumination", "Cycling {2}", ["Cycling"]);
    const abilities = resolveAbilities(card);
    // Cycling comes from both keyword registry and oracle parser
    const cycling = abilities.find((a: any) => a.type === "activated" && a.zones?.includes("Hand"));
    expect(cycling).toBeDefined();
  });
});

describe("multi-ability cards (no override needed)", () => {
  it("should handle keyword + mana ability", () => {
    const card = makeCard("Elvish Archdruid", "Other Elf creatures you control get +1/+1.\n{T}: Add {G} for each Elf you control.", ["Flying"]);
    const abilities = resolveAbilities(card);
    // Should get: Flying keyword + anthem static + mana ability
    expect(abilities.length).toBeGreaterThanOrEqual(2);
  });
});
