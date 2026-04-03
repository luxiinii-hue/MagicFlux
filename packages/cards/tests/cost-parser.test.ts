import { describe, it, expect } from "vitest";
import { parseManaCost } from "../src/parser/cost-parser.js";

describe("parseManaCost", () => {
  it("should return empty cost for null/undefined/empty", () => {
    expect(parseManaCost(null)).toEqual({ symbols: [], totalCMC: 0 });
    expect(parseManaCost(undefined)).toEqual({ symbols: [], totalCMC: 0 });
    expect(parseManaCost("")).toEqual({ symbols: [], totalCMC: 0 });
  });

  it("should parse single colored mana {R}", () => {
    const result = parseManaCost("{R}");
    expect(result.symbols).toEqual([{ type: "colored", color: "R" }]);
    expect(result.totalCMC).toBe(1);
  });

  it("should parse generic + colored {2}{W}{U}", () => {
    const result = parseManaCost("{2}{W}{U}");
    expect(result.symbols).toEqual([
      { type: "generic", amount: 2 },
      { type: "colored", color: "W" },
      { type: "colored", color: "U" },
    ]);
    expect(result.totalCMC).toBe(4);
  });

  it("should parse X costs {X}{R}{R}", () => {
    const result = parseManaCost("{X}{R}{R}");
    expect(result.symbols).toEqual([
      { type: "X" },
      { type: "colored", color: "R" },
      { type: "colored", color: "R" },
    ]);
    expect(result.totalCMC).toBe(2); // X counts as 0 for CMC
  });

  it("should parse hybrid mana {W/U}", () => {
    const result = parseManaCost("{W/U}{W/U}");
    expect(result.symbols).toEqual([
      { type: "hybrid", colors: ["W", "U"] },
      { type: "hybrid", colors: ["W", "U"] },
    ]);
    expect(result.totalCMC).toBe(2);
  });

  it("should parse hybrid generic {2/W}", () => {
    const result = parseManaCost("{2/W}");
    expect(result.symbols).toEqual([
      { type: "hybridGeneric", amount: 2, color: "W" },
    ]);
    expect(result.totalCMC).toBe(2);
  });

  it("should parse phyrexian mana {W/P}", () => {
    const result = parseManaCost("{W/P}");
    expect(result.symbols).toEqual([
      { type: "phyrexian", color: "W" },
    ]);
    expect(result.totalCMC).toBe(1);
  });

  it("should parse colorless mana {C}", () => {
    const result = parseManaCost("{C}");
    expect(result.symbols).toEqual([{ type: "colorless" }]);
    expect(result.totalCMC).toBe(1);
  });

  it("should parse snow mana {S}", () => {
    const result = parseManaCost("{S}");
    expect(result.symbols).toEqual([{ type: "snow" }]);
    expect(result.totalCMC).toBe(1);
  });

  it("should parse zero generic mana {0}", () => {
    const result = parseManaCost("{0}");
    expect(result.symbols).toEqual([{ type: "generic", amount: 0 }]);
    expect(result.totalCMC).toBe(0);
  });

  it("should parse large generic cost {15}", () => {
    const result = parseManaCost("{15}");
    expect(result.symbols).toEqual([{ type: "generic", amount: 15 }]);
    expect(result.totalCMC).toBe(15);
  });

  it("should parse complex cost {X}{2}{B}{B}", () => {
    const result = parseManaCost("{X}{2}{B}{B}");
    expect(result.symbols).toHaveLength(4);
    expect(result.totalCMC).toBe(4); // X=0, 2+1+1
  });

  it("should parse all five colors", () => {
    const result = parseManaCost("{W}{U}{B}{R}{G}");
    expect(result.symbols).toEqual([
      { type: "colored", color: "W" },
      { type: "colored", color: "U" },
      { type: "colored", color: "B" },
      { type: "colored", color: "R" },
      { type: "colored", color: "G" },
    ]);
    expect(result.totalCMC).toBe(5);
  });

  it("should parse phyrexian in complex cost {1}{G/P}{G/P}", () => {
    const result = parseManaCost("{1}{G/P}{G/P}");
    expect(result.symbols).toEqual([
      { type: "generic", amount: 1 },
      { type: "phyrexian", color: "G" },
      { type: "phyrexian", color: "G" },
    ]);
    expect(result.totalCMC).toBe(3);
  });
});
