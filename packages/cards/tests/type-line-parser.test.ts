import { describe, it, expect } from "vitest";
import { parseTypeLine } from "../src/parser/type-line-parser.js";

describe("parseTypeLine", () => {
  it("should parse simple type 'Instant'", () => {
    const result = parseTypeLine("Instant");
    expect(result).toEqual({
      supertypes: [],
      cardTypes: ["Instant"],
      subtypes: [],
    });
  });

  it("should parse 'Sorcery'", () => {
    const result = parseTypeLine("Sorcery");
    expect(result.cardTypes).toEqual(["Sorcery"]);
    expect(result.supertypes).toEqual([]);
    expect(result.subtypes).toEqual([]);
  });

  it("should parse 'Legendary Creature — Human Wizard'", () => {
    const result = parseTypeLine("Legendary Creature — Human Wizard");
    expect(result.supertypes).toEqual(["Legendary"]);
    expect(result.cardTypes).toEqual(["Creature"]);
    expect(result.subtypes).toEqual(["Human", "Wizard"]);
  });

  it("should parse 'Artifact Creature — Golem'", () => {
    const result = parseTypeLine("Artifact Creature — Golem");
    expect(result.supertypes).toEqual([]);
    expect(result.cardTypes).toEqual(["Artifact", "Creature"]);
    expect(result.subtypes).toEqual(["Golem"]);
  });

  it("should parse 'Basic Land — Plains'", () => {
    const result = parseTypeLine("Basic Land — Plains");
    expect(result.supertypes).toEqual(["Basic"]);
    expect(result.cardTypes).toEqual(["Land"]);
    expect(result.subtypes).toEqual(["Plains"]);
  });

  it("should parse 'Snow Legendary Creature — Angel'", () => {
    const result = parseTypeLine("Snow Legendary Creature — Angel");
    expect(result.supertypes).toContain("Snow");
    expect(result.supertypes).toContain("Legendary");
    expect(result.cardTypes).toEqual(["Creature"]);
    expect(result.subtypes).toEqual(["Angel"]);
  });

  it("should parse 'Enchantment' with no subtypes", () => {
    const result = parseTypeLine("Enchantment");
    expect(result.cardTypes).toEqual(["Enchantment"]);
    expect(result.subtypes).toEqual([]);
  });

  it("should parse 'Enchantment — Aura'", () => {
    const result = parseTypeLine("Enchantment — Aura");
    expect(result.cardTypes).toEqual(["Enchantment"]);
    expect(result.subtypes).toEqual(["Aura"]);
  });

  it("should parse 'Legendary Planeswalker — Jace'", () => {
    const result = parseTypeLine("Legendary Planeswalker — Jace");
    expect(result.supertypes).toEqual(["Legendary"]);
    expect(result.cardTypes).toEqual(["Planeswalker"]);
    expect(result.subtypes).toEqual(["Jace"]);
  });

  it("should parse 'Land' with no subtypes", () => {
    const result = parseTypeLine("Land");
    expect(result.cardTypes).toEqual(["Land"]);
    expect(result.subtypes).toEqual([]);
  });

  it("should handle empty string", () => {
    const result = parseTypeLine("");
    expect(result).toEqual({
      supertypes: [],
      cardTypes: [],
      subtypes: [],
    });
  });

  it("should parse creature with multiple subtypes", () => {
    const result = parseTypeLine("Creature — Human Soldier Ally");
    expect(result.subtypes).toEqual(["Human", "Soldier", "Ally"]);
  });

  it("should parse 'Legendary Artifact — Equipment'", () => {
    const result = parseTypeLine("Legendary Artifact — Equipment");
    expect(result.supertypes).toEqual(["Legendary"]);
    expect(result.cardTypes).toEqual(["Artifact"]);
    expect(result.subtypes).toEqual(["Equipment"]);
  });
});
