import { describe, it, expect } from "vitest";
import { transformScryfallCard } from "../src/scryfall/transformer.js";
import type { ScryfallCard } from "../src/scryfall/types.js";

/** Minimal Scryfall card fixture matching the shape from the API. */
function makeScryfallCard(overrides: Partial<ScryfallCard>): ScryfallCard {
  return {
    id: "test-id",
    oracle_id: "test-oracle",
    name: "Test Card",
    lang: "en",
    layout: "normal",
    cmc: 0,
    type_line: "Instant",
    color_identity: [],
    keywords: [],
    legalities: {},
    set: "tst",
    set_name: "Test Set",
    collector_number: "1",
    ...overrides,
  };
}

describe("transformScryfallCard", () => {
  it("should map basic fields from Lightning Bolt", () => {
    const raw = makeScryfallCard({
      id: "bolt-uuid",
      oracle_id: "bolt-oracle",
      name: "Lightning Bolt",
      mana_cost: "{R}",
      cmc: 1,
      type_line: "Instant",
      oracle_text: "Lightning Bolt deals 3 damage to any target.",
      colors: ["R"],
      color_identity: ["R"],
      keywords: [],
      legalities: { modern: "legal", standard: "not_legal" },
      image_uris: { normal: "https://example.com/bolt.jpg" },
    });

    const card = transformScryfallCard(raw);

    expect(card.id).toBe("bolt-uuid");
    expect(card.oracleId).toBe("bolt-oracle");
    expect(card.name).toBe("Lightning Bolt");
    expect(card.manaCost).toBe("{R}");
    expect(card.cmc).toBe(1);
    expect(card.oracleText).toBe("Lightning Bolt deals 3 damage to any target.");
    expect(card.colors).toEqual(["R"]);
    expect(card.colorIdentity).toEqual(["R"]);
    expect(card.cardTypes).toEqual(["Instant"]);
    expect(card.supertypes).toEqual([]);
    expect(card.subtypes).toEqual([]);
    expect(card.isToken).toBe(false);
  });

  it("should parse mana cost into ManaCost object", () => {
    const raw = makeScryfallCard({ mana_cost: "{2}{W}{U}" });
    const card = transformScryfallCard(raw);

    expect(card.parsedManaCost).not.toBeNull();
    expect(card.parsedManaCost!.symbols).toHaveLength(3);
    expect(card.parsedManaCost!.totalCMC).toBe(4);
  });

  it("should handle cards with no mana cost (lands)", () => {
    const raw = makeScryfallCard({
      name: "Plains",
      type_line: "Basic Land — Plains",
      // no mana_cost field
    });
    const card = transformScryfallCard(raw);

    expect(card.manaCost).toBeNull();
    expect(card.parsedManaCost).toEqual({ symbols: [], totalCMC: 0 });
    expect(card.supertypes).toEqual(["Basic"]);
    expect(card.cardTypes).toEqual(["Land"]);
    expect(card.subtypes).toEqual(["Plains"]);
  });

  it("should parse creature type line", () => {
    const raw = makeScryfallCard({
      type_line: "Legendary Creature — Human Wizard",
      power: "2",
      toughness: "3",
    });
    const card = transformScryfallCard(raw);

    expect(card.supertypes).toEqual(["Legendary"]);
    expect(card.cardTypes).toEqual(["Creature"]);
    expect(card.subtypes).toEqual(["Human", "Wizard"]);
    expect(card.power).toBe("2");
    expect(card.toughness).toBe("3");
  });

  it("should map legalities correctly", () => {
    const raw = makeScryfallCard({
      legalities: {
        standard: "legal",
        modern: "legal",
        legacy: "banned",
        vintage: "restricted",
        commander: "not_legal",
      },
    });
    const card = transformScryfallCard(raw);

    expect(card.legalities.standard).toBe("legal");
    expect(card.legalities.legacy).toBe("banned");
    expect(card.legalities.vintage).toBe("restricted");
    expect(card.legalities.commander).toBe("not_legal");
  });

  it("should map keywords array", () => {
    const raw = makeScryfallCard({
      keywords: ["Flying", "Vigilance", "Trample"],
    });
    const card = transformScryfallCard(raw);

    expect(card.keywords).toEqual(["Flying", "Vigilance", "Trample"]);
  });

  it("should map multi-faced card faces", () => {
    const raw = makeScryfallCard({
      name: "Delver of Secrets // Insectile Aberration",
      layout: "transform",
      card_faces: [
        {
          name: "Delver of Secrets",
          mana_cost: "{U}",
          type_line: "Creature — Human Wizard",
          oracle_text: "At the beginning of your upkeep...",
          power: "1",
          toughness: "1",
          colors: ["U"],
          image_uris: { normal: "https://example.com/delver-front.jpg" },
        },
        {
          name: "Insectile Aberration",
          type_line: "Creature — Human Insect",
          oracle_text: "Flying",
          power: "3",
          toughness: "2",
          colors: ["U"],
          image_uris: { normal: "https://example.com/delver-back.jpg" },
        },
      ],
    });
    const card = transformScryfallCard(raw);

    expect(card.layout).toBe("transform");
    expect(card.faces).toHaveLength(2);
    expect(card.faces![0].name).toBe("Delver of Secrets");
    expect(card.faces![0].power).toBe("1");
    expect(card.faces![1].name).toBe("Insectile Aberration");
    expect(card.faces![1].power).toBe("3");
  });

  it("should identify token cards", () => {
    const raw = makeScryfallCard({
      name: "Soldier",
      layout: "token",
      type_line: "Token Creature — Human Soldier",
    });
    const card = transformScryfallCard(raw);

    expect(card.isToken).toBe(true);
  });

  it("should map produced_mana", () => {
    const raw = makeScryfallCard({
      produced_mana: ["W", "U"],
    });
    const card = transformScryfallCard(raw);

    expect(card.producedMana).toEqual(["W", "U"]);
  });
});
