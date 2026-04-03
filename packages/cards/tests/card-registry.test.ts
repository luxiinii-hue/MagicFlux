import { describe, it, expect, beforeAll } from "vitest";
import type { CardData } from "@magic-flux/types";
import {
  buildIndexes,
  getCardData,
  getCardDataByName,
  searchCards,
  isLegalInFormat,
  getLoadedCardCount,
  instantiateCard,
} from "../src/registry/card-registry.js";
import { ZoneType } from "@magic-flux/types";

/** Helper to create a minimal CardData for testing. */
function makeCardData(overrides: Partial<CardData> & { id: string; name: string }): CardData {
  return {
    oracleId: overrides.oracleId ?? `oracle-${overrides.id}`,
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

const bolt = makeCardData({
  id: "bolt-id",
  name: "Lightning Bolt",
  manaCost: "{R}",
  cmc: 1,
  typeLine: "Instant",
  cardTypes: ["Instant"],
  oracleText: "Lightning Bolt deals 3 damage to any target.",
  colors: ["R"],
  colorIdentity: ["R"],
  legalities: { standard: "not_legal", modern: "legal", legacy: "legal", commander: "legal" },
});

const serra = makeCardData({
  id: "serra-id",
  name: "Serra Angel",
  manaCost: "{3}{W}{W}",
  cmc: 5,
  typeLine: "Creature — Angel",
  cardTypes: ["Creature"],
  subtypes: ["Angel"],
  oracleText: "Flying, vigilance",
  power: "4",
  toughness: "4",
  colors: ["W"],
  colorIdentity: ["W"],
  keywords: ["Flying", "Vigilance"],
  legalities: { standard: "not_legal", modern: "legal", commander: "legal" },
});

const fireIce = makeCardData({
  id: "fire-ice-id",
  name: "Fire // Ice",
  manaCost: "{1}{R}",
  cmc: 4, // combined CMC
  typeLine: "Instant // Instant",
  cardTypes: ["Instant"],
  colors: ["R", "U"],
  legalities: { modern: "legal" },
});

const soldierToken = makeCardData({
  id: "soldier-token-id",
  name: "Soldier",
  typeLine: "Token Creature — Human Soldier",
  cardTypes: ["Creature"],
  subtypes: ["Human", "Soldier"],
  power: "1",
  toughness: "1",
  colors: ["W"],
  isToken: true,
  layout: "token",
});

const allCards = [bolt, serra, fireIce, soldierToken];

beforeAll(() => {
  buildIndexes(allCards);
});

describe("card registry lookups", () => {
  it("should return correct card count", () => {
    expect(getLoadedCardCount()).toBe(4);
  });

  it("should find card by ID", () => {
    expect(getCardData("bolt-id")).toBe(bolt);
    expect(getCardData("serra-id")).toBe(serra);
    expect(getCardData("nonexistent")).toBeUndefined();
  });

  it("should find card by name (case-insensitive)", () => {
    expect(getCardDataByName("Lightning Bolt")).toBe(bolt);
    expect(getCardDataByName("lightning bolt")).toBe(bolt);
    expect(getCardDataByName("LIGHTNING BOLT")).toBe(bolt);
  });

  it("should find split card by full name", () => {
    expect(getCardDataByName("Fire // Ice")).toBe(fireIce);
  });

  it("should find split card by individual face name", () => {
    expect(getCardDataByName("Fire")).toBe(fireIce);
    expect(getCardDataByName("Ice")).toBe(fireIce);
  });
});

describe("searchCards", () => {
  it("should search by partial name", () => {
    const results = searchCards({ name: "bolt" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Lightning Bolt");
  });

  it("should search by card type", () => {
    const results = searchCards({ types: ["Creature"], excludeTokens: false });
    expect(results).toHaveLength(2); // Serra + Soldier token
  });

  it("should exclude tokens by default", () => {
    const results = searchCards({ types: ["Creature"] });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Serra Angel");
  });

  it("should search by color", () => {
    const results = searchCards({ colors: ["W"] });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Serra Angel");
  });

  it("should search by format legality", () => {
    const results = searchCards({ format: "modern" });
    expect(results.length).toBeGreaterThanOrEqual(3); // bolt, serra, fire//ice
  });

  it("should search by keyword", () => {
    const results = searchCards({ keywords: ["Flying"] });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Serra Angel");
  });

  it("should search by CMC", () => {
    const results = searchCards({ cmc: 1 });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Lightning Bolt");
  });

  it("should AND multiple filters", () => {
    const results = searchCards({ colors: ["R"], cmc: 1 });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Lightning Bolt");
  });

  it("should respect limit", () => {
    const results = searchCards({ limit: 1 });
    expect(results).toHaveLength(1);
  });

  it("should return empty for no matches", () => {
    const results = searchCards({ name: "Nonexistent Card" });
    expect(results).toHaveLength(0);
  });
});

describe("isLegalInFormat", () => {
  it("should return true for legal cards", () => {
    expect(isLegalInFormat("bolt-id", "modern")).toBe(true);
    expect(isLegalInFormat("bolt-id", "commander")).toBe(true);
  });

  it("should return false for not_legal cards", () => {
    expect(isLegalInFormat("bolt-id", "standard")).toBe(false);
  });

  it("should return false for unknown card", () => {
    expect(isLegalInFormat("nonexistent", "modern")).toBe(false);
  });

  it("should return false for unknown format", () => {
    expect(isLegalInFormat("bolt-id", "pauper-commander-edh")).toBe(false);
  });
});

describe("instantiateCard", () => {
  it("should create a basic card instance", () => {
    const instance = instantiateCard(bolt, "player1", "inst-1", ZoneType.Hand, "player1");
    expect(instance.instanceId).toBe("inst-1");
    expect(instance.cardDataId).toBe("bolt-id");
    expect(instance.owner).toBe("player1");
    expect(instance.controller).toBe("player1");
    expect(instance.zone).toBe(ZoneType.Hand);
    expect(instance.tapped).toBe(false);
    expect(instance.damage).toBe(0);
    expect(instance.modifiedPower).toBeNull(); // not a creature
    expect(instance.modifiedToughness).toBeNull();
  });

  it("should parse creature base power/toughness", () => {
    const instance = instantiateCard(serra, "player1", "inst-2", ZoneType.Battlefield, null);
    expect(instance.modifiedPower).toBe(4);
    expect(instance.modifiedToughness).toBe(4);
  });

  it("should handle * power/toughness as 0", () => {
    const starCard = makeCardData({
      id: "star-id",
      name: "Tarmogoyf",
      power: "*",
      toughness: "1+*",
    });
    const instance = instantiateCard(starCard, "p1", "inst-3", ZoneType.Battlefield, null);
    // * → 0, "1+*" is not purely numeric so parseInt gives NaN → falls through to 0
    expect(instance.modifiedPower).toBe(0);
  });

  it("should populate abilities from override for Lightning Bolt", () => {
    const boltCard = makeCardData({
      id: "bolt-override-test",
      name: "Lightning Bolt",
    });
    const instance = instantiateCard(boltCard, "p1", "inst-bolt", ZoneType.Hand, "p1");
    expect(instance.abilities.length).toBeGreaterThan(0);
    const spellAbility = instance.abilities.find((a) => a.type === "spell");
    expect(spellAbility).toBeDefined();
    expect(spellAbility!.sourceCardInstanceId).toBe("inst-bolt");
    expect(spellAbility!.effects).toHaveLength(1);
    expect(spellAbility!.effects[0].type).toBe("dealDamage");
  });

  it("should populate mana ability from override for basic lands", () => {
    const mountain = makeCardData({
      id: "mountain-override-test",
      name: "Mountain",
      typeLine: "Basic Land — Mountain",
      cardTypes: ["Land"],
    });
    const instance = instantiateCard(mountain, "p1", "inst-mtn", ZoneType.Battlefield, null);
    expect(instance.abilities.length).toBeGreaterThan(0);
    const manaAbility = instance.abilities.find((a) => a.type === "mana");
    expect(manaAbility).toBeDefined();
    expect(manaAbility!.sourceCardInstanceId).toBe("inst-mtn");
  });

  it("should use override abilities for Serra Angel (spell + flying + vigilance)", () => {
    const instance = instantiateCard(serra, "p1", "inst-serra", ZoneType.Battlefield, null);
    // Serra Angel has an override that produces spell + 2 keyword static abilities
    expect(instance.abilities).toHaveLength(3);
    const spellAbility = instance.abilities.find((a) => a.type === "spell");
    expect(spellAbility).toBeDefined();
    expect(spellAbility!.sourceCardInstanceId).toBe("inst-serra");
    const flyingAbility = instance.abilities.find((a) => a.id === "serra_angel_flying");
    expect(flyingAbility).toBeDefined();
    expect(flyingAbility!.type).toBe("static");
    const vigilanceAbility = instance.abilities.find((a) => a.id === "serra_angel_vigilance");
    expect(vigilanceAbility).toBeDefined();
  });

  it("should generate keyword abilities for cards without overrides", () => {
    const keywordOnly = makeCardData({
      id: "keyword-only-id",
      name: "Keyword Only Creature",
      cardTypes: ["Creature"],
      keywords: ["Flying", "Vigilance"],
      power: "3",
      toughness: "3",
    });
    const instance = instantiateCard(keywordOnly, "p1", "inst-kw", ZoneType.Battlefield, null);
    // No override, so keyword registry generates static abilities
    expect(instance.abilities).toHaveLength(2);
    const flyingAbility = instance.abilities.find((a) => a.id === "kw_flying");
    expect(flyingAbility).toBeDefined();
    expect(flyingAbility!.type).toBe("static");
    expect(flyingAbility!.sourceCardInstanceId).toBe("inst-kw");
    const vigilanceAbility = instance.abilities.find((a) => a.id === "kw_vigilance");
    expect(vigilanceAbility).toBeDefined();
  });

  it("should return empty abilities for cards with no keywords and no override", () => {
    const vanilla = makeCardData({
      id: "vanilla-id",
      name: "Vanilla Creature",
      cardTypes: ["Creature"],
      keywords: [],
    });
    const instance = instantiateCard(vanilla, "p1", "inst-vanilla", ZoneType.Battlefield, null);
    expect(instance.abilities).toEqual([]);
  });
});
