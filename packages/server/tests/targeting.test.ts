import { describe, it, expect } from "vitest";
import { getCardOverride, getRegisteredManaCost } from "@magic-flux/cards";

describe("Server targeting integration", () => {
  it("should find Shock override with spellTargets", () => {
    const override = getCardOverride("Shock");
    expect(override).toBeDefined();
    expect(override!.spellTargets.length).toBeGreaterThan(0);
    expect(override!.spellTargets[0].description).toContain("target");
  });

  it("should find Lightning Bolt override with spellTargets", () => {
    const override = getCardOverride("Lightning Bolt");
    expect(override).toBeDefined();
    expect(override!.spellTargets.length).toBeGreaterThan(0);
  });

  it("should find mana cost for Shock", () => {
    const cost = getRegisteredManaCost("Shock");
    expect(cost).toBeDefined();
    expect(cost!.totalCMC).toBe(1);
    expect(cost!.symbols.length).toBe(1);
  });

  it("should find mana cost for Rift Bolt", () => {
    const cost = getRegisteredManaCost("Rift Bolt");
    expect(cost).toBeDefined();
    expect(cost!.totalCMC).toBe(3);
  });

  it("should not find mana cost for Mountain", () => {
    const cost = getRegisteredManaCost("Mountain");
    expect(cost).toBeNull();
  });

  it("should find Goblin Guide override (creature, no spellTargets)", () => {
    const override = getCardOverride("Goblin Guide");
    expect(override).toBeDefined();
    expect(override!.spellTargets.length).toBe(0);
  });
});
