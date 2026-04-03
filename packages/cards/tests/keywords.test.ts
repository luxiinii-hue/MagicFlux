import { describe, it, expect } from "vitest";
import {
  getKeywordDefinition,
  getKeywordBehavior,
  hasKeyword,
  getImplementedKeywords,
  generateKeywordAbilities,
} from "../src/keywords/index.js";

describe("keyword registry", () => {
  it("should have 20 keywords registered", () => {
    const keywords = getImplementedKeywords();
    expect(keywords.length).toBeGreaterThanOrEqual(20);
  });

  it("should find keywords case-insensitively", () => {
    expect(hasKeyword("Flying")).toBe(true);
    expect(hasKeyword("flying")).toBe(true);
    expect(hasKeyword("FLYING")).toBe(true);
  });

  it("should return undefined for unknown keywords", () => {
    expect(getKeywordDefinition("Nonexistent")).toBeUndefined();
    expect(hasKeyword("Banding")).toBe(false);
  });

  const expectedKeywords = [
    "Flying", "Reach", "Menace", "Intimidate",
    "First Strike", "Double Strike", "Trample", "Deathtouch", "Lifelink",
    "Vigilance", "Haste", "Defender", "Flash",
    "Hexproof", "Shroud", "Indestructible", "Protection",
    "Prowess", "Ward", "Equip",
  ];

  for (const keyword of expectedKeywords) {
    it(`should have "${keyword}" registered`, () => {
      expect(hasKeyword(keyword)).toBe(true);
      const def = getKeywordDefinition(keyword);
      expect(def).toBeDefined();
      expect(def!.name).toBe(keyword);
    });
  }
});

describe("generateKeywordAbilities", () => {
  it("should generate static abilities for Flying", () => {
    const abilities = generateKeywordAbilities(["Flying"]);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("static");
    expect(abilities[0].id).toBe("kw_flying");
  });

  it("should generate multiple abilities for multiple keywords", () => {
    const abilities = generateKeywordAbilities(["Flying", "Vigilance", "Trample"]);
    expect(abilities).toHaveLength(3);
    const ids = abilities.map((a) => a.id);
    expect(ids).toContain("kw_flying");
    expect(ids).toContain("kw_vigilance");
    expect(ids).toContain("kw_trample");
  });

  it("should skip unknown keywords without error", () => {
    const abilities = generateKeywordAbilities(["Flying", "Banding", "Reach"]);
    expect(abilities).toHaveLength(2);
  });

  it("should generate triggered ability for Prowess", () => {
    const abilities = generateKeywordAbilities(["Prowess"]);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("triggered");
    expect(abilities[0].id).toBe("kw_prowess");
  });

  it("should generate activated ability for Equip", () => {
    const abilities = generateKeywordAbilities(["Equip"]);
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("activated");
    expect(abilities[0].id).toBe("kw_equip");
  });

  it("should return empty array for empty keywords", () => {
    expect(generateKeywordAbilities([])).toEqual([]);
  });

  it("should set sourceCardInstanceId to null (stamped later by instantiateCard)", () => {
    const abilities = generateKeywordAbilities(["Flying"]);
    expect(abilities[0].sourceCardInstanceId).toBeNull();
  });
});

describe("keyword definitions", () => {
  it("Flying should be an evasion keyword", () => {
    expect(getKeywordDefinition("Flying")!.type).toBe("evasion");
  });

  it("First Strike should be a combat keyword", () => {
    expect(getKeywordDefinition("First Strike")!.type).toBe("combat");
  });

  it("Haste should be a flag keyword", () => {
    expect(getKeywordDefinition("Haste")!.type).toBe("flag");
  });

  it("Prowess should be a triggered keyword", () => {
    expect(getKeywordDefinition("Prowess")!.type).toBe("triggered");
  });

  it("Equip should be an activated keyword", () => {
    expect(getKeywordDefinition("Equip")!.type).toBe("activated");
  });

  it("static keyword abilities should target layer 6", () => {
    const abilities = generateKeywordAbilities(["Flying"]);
    const ability = abilities[0];
    if (ability.type === "static") {
      expect(ability.layer).toBe(6);
    }
  });
});

describe("getKeywordBehavior", () => {
  it("should be an alias for getKeywordDefinition", () => {
    const defFlying = getKeywordDefinition("Flying");
    const behaviorFlying = getKeywordBehavior("Flying");
    expect(defFlying).toBe(behaviorFlying);
  });

  it("should return undefined for unknown keywords", () => {
    expect(getKeywordBehavior("Banding")).toBeUndefined();
  });
});

describe("keyword effectType matches engine expectations", () => {
  const staticKeywords = [
    "Flying", "Trample", "Deathtouch", "Lifelink", "Vigilance",
    "Haste", "First Strike", "Double Strike", "Reach", "Hexproof",
    "Indestructible", "Menace", "Flash", "Defender",
  ];

  for (const keyword of staticKeywords) {
    it(`${keyword} should produce effectType as lowercase keyword name`, () => {
      const abilities = generateKeywordAbilities([keyword]);
      expect(abilities).toHaveLength(1);
      const ability = abilities[0];
      expect(ability.type).toBe("static");
      if (ability.type === "static") {
        // Engine's cardHasKeyword() checks effectType === keyword.toLowerCase()
        expect(ability.continuousEffect.effectType).toBe(keyword.toLowerCase());
      }
    });
  }
});
