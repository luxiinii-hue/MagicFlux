import { describe, it, expect } from "vitest";
import type {
  SpellAbility,
  SpellAbilitySpell,
  SpellAbilityActivated,
  SpellAbilityTriggered,
  SpellAbilityStatic,
  Effect,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import {
  getCardOverride,
  hasCardOverride,
  getOverrideNames,
} from "../src/overrides/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSpellAbility(abilities: SpellAbility[]): SpellAbilitySpell {
  const spell = abilities.find((a) => a.type === "spell");
  if (!spell) throw new Error("No spell ability found");
  return spell as SpellAbilitySpell;
}

function getTriggeredAbility(abilities: SpellAbility[], id?: string): SpellAbilityTriggered {
  const match = id
    ? abilities.find((a) => a.type === "triggered" && a.id === id)
    : abilities.find((a) => a.type === "triggered");
  if (!match) throw new Error(`No triggered ability found${id ? ` with id ${id}` : ""}`);
  return match as SpellAbilityTriggered;
}

function getActivatedAbility(abilities: SpellAbility[], id?: string): SpellAbilityActivated {
  const match = id
    ? abilities.find((a) => a.type === "activated" && a.id === id)
    : abilities.find((a) => a.type === "activated");
  if (!match) throw new Error(`No activated ability found${id ? ` with id ${id}` : ""}`);
  return match as SpellAbilityActivated;
}

function getStaticAbility(abilities: SpellAbility[], id?: string): SpellAbilityStatic {
  const match = id
    ? abilities.find((a) => a.type === "static" && a.id === id)
    : abilities.find((a) => a.type === "static");
  if (!match) throw new Error(`No static ability found${id ? ` with id ${id}` : ""}`);
  return match as SpellAbilityStatic;
}

function getEffect(ability: SpellAbility, effectType: string): Effect {
  const effect = ability.effects.find((e) => e.type === effectType);
  if (!effect) throw new Error(`No ${effectType} effect found`);
  return effect;
}

// ---------------------------------------------------------------------------
// Registry total count
// ---------------------------------------------------------------------------

describe("final sprint: override count", () => {
  it("should have at least 200 overrides registered", () => {
    const names = getOverrideNames();
    expect(names.length).toBeGreaterThanOrEqual(200);
  });
});

// ===========================================================================
// REMOVAL / INTERACTION
// ===========================================================================

describe("Go for the Throat override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Go for the Throat")).toBe(true);
  });

  it("should destroy target nonartifact creature", () => {
    const override = getCardOverride("Go for the Throat")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("destroy");
  });

  it("should have target requirements for a creature", () => {
    const override = getCardOverride("Go for the Throat")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
  });
});

describe("Condemn override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Condemn")).toBe(true);
  });

  it("should use custom resolve for bottom-of-library effect", () => {
    const override = getCardOverride("Condemn")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("custom");
  });

  it("should target a creature", () => {
    const override = getCardOverride("Condemn")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
  });
});

describe("Anguished Unmaking override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Anguished Unmaking")).toBe(true);
  });

  it("should exile target nonland permanent and lose 3 life", () => {
    const override = getCardOverride("Anguished Unmaking")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);
    expect(spell.effects[0].type).toBe("exile");
    expect(spell.effects[1].type).toBe("loseLife");
    if (spell.effects[1].type === "loseLife") {
      expect(spell.effects[1].amount).toBe(3);
    }
  });

  it("should target a nonland permanent", () => {
    const override = getCardOverride("Anguished Unmaking")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("permanent");
    expect(override.spellTargets[0].filter).toBeDefined();
  });
});

describe("Dreadbore override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Dreadbore")).toBe(true);
  });

  it("should destroy target creature or planeswalker", () => {
    const override = getCardOverride("Dreadbore")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("destroy");
  });

  it("should target creatures and planeswalkers", () => {
    const override = getCardOverride("Dreadbore")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("planeswalker");
  });
});

describe("Kolaghan's Command override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Kolaghan's Command")).toBe(true);
  });

  it("should deal 2 damage and have a custom effect for graveyard return", () => {
    const override = getCardOverride("Kolaghan's Command")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);
    expect(spell.effects[0].type).toBe("dealDamage");
    if (spell.effects[0].type === "dealDamage") {
      expect(spell.effects[0].amount).toBe(2);
    }
    expect(spell.effects[1].type).toBe("custom");
  });
});

describe("Electrolyze override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Electrolyze")).toBe(true);
  });

  it("should deal 2 damage and draw a card", () => {
    const override = getCardOverride("Electrolyze")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);
    expect(spell.effects[0].type).toBe("dealDamage");
    if (spell.effects[0].type === "dealDamage") {
      expect(spell.effects[0].amount).toBe(2);
    }
    expect(spell.effects[1].type).toBe("drawCards");
    if (spell.effects[1].type === "drawCards") {
      expect(spell.effects[1].count).toBe(1);
    }
  });
});

describe("Izzet Charm override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Izzet Charm")).toBe(true);
  });

  it("should counter a noncreature spell", () => {
    const override = getCardOverride("Izzet Charm")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("counter");
  });

  it("should target a spell", () => {
    const override = getCardOverride("Izzet Charm")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("spell");
  });
});

describe("Lightning Strike override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Lightning Strike")).toBe(true);
  });

  it("should deal 3 damage to any target", () => {
    const override = getCardOverride("Lightning Strike")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("dealDamage");
    if (spell.effects[0].type === "dealDamage") {
      expect(spell.effects[0].amount).toBe(3);
    }
  });

  it("should target creatures, planeswalkers, and players", () => {
    const override = getCardOverride("Lightning Strike")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("planeswalker");
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});

describe("Char override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Char")).toBe(true);
  });

  it("should deal 4 damage to a target and 2 life loss to controller", () => {
    const override = getCardOverride("Char")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);
    expect(spell.effects[0].type).toBe("dealDamage");
    if (spell.effects[0].type === "dealDamage") {
      expect(spell.effects[0].amount).toBe(4);
    }
    expect(spell.effects[1].type).toBe("loseLife");
    if (spell.effects[1].type === "loseLife") {
      expect(spell.effects[1].amount).toBe(2);
    }
  });
});

// ===========================================================================
// CREATURES
// ===========================================================================

describe("Vendilion Clique override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Vendilion Clique")).toBe(true);
  });

  it("should have spell + flying keyword + ETB trigger", () => {
    const override = getCardOverride("Vendilion Clique")!;
    const abilities = override.getAbilities();
    expect(abilities.length).toBeGreaterThanOrEqual(3);
    expect(abilities.some((a) => a.type === "spell")).toBe(true);
    expect(abilities.some((a) => a.type === "static")).toBe(true);
    expect(abilities.some((a) => a.type === "triggered")).toBe(true);
  });

  it("should have flying keyword static", () => {
    const override = getCardOverride("Vendilion Clique")!;
    const flying = override.getAbilities().find(
      (a) => a.type === "static" && a.id.includes("flying"),
    ) as SpellAbilityStatic;
    expect(flying).toBeDefined();
    expect(flying.continuousEffect.effectType).toBe("flying");
  });

  it("should have ETB trigger targeting a player", () => {
    const override = getCardOverride("Vendilion Clique")!;
    const etb = getTriggeredAbility(override.getAbilities(), "clique_etb");
    expect(etb.triggerCondition.eventType).toBe("cardEnteredZone");
    expect(etb.triggerCondition.self).toBe(true);
    expect(etb.targets).toHaveLength(1);
    expect(etb.targets![0].targetTypes).toContain("player");
  });
});

describe("Spell Queller override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Spell Queller")).toBe(true);
  });

  it("should have spell + flying + ETB exile trigger + LTB return trigger", () => {
    const override = getCardOverride("Spell Queller")!;
    const abilities = override.getAbilities();
    expect(abilities.length).toBeGreaterThanOrEqual(4);
  });

  it("should have ETB that targets a spell with CMC 4 or less", () => {
    const override = getCardOverride("Spell Queller")!;
    const etb = getTriggeredAbility(override.getAbilities(), "squeller_etb");
    expect(etb.targets).toHaveLength(1);
    expect(etb.targets![0].targetTypes).toContain("spell");
    expect(etb.targets![0].filter).toBeDefined();
    expect(etb.targets![0].filter!.cmc).toBeDefined();
  });

  it("should have LTB trigger", () => {
    const override = getCardOverride("Spell Queller")!;
    const ltb = getTriggeredAbility(override.getAbilities(), "squeller_ltb");
    expect(ltb.triggerCondition.eventType).toBe("cardLeftZone");
  });
});

describe("Reflector Mage override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Reflector Mage")).toBe(true);
  });

  it("should have spell + ETB bounce trigger", () => {
    const override = getCardOverride("Reflector Mage")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should bounce a creature an opponent controls", () => {
    const override = getCardOverride("Reflector Mage")!;
    const etb = getTriggeredAbility(override.getAbilities());
    expect(etb.effects[0].type).toBe("bounce");
    expect(etb.targets).toHaveLength(1);
    expect(etb.targets![0].controller).toBe("opponent");
  });
});

describe("Thought-Knot Seer override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Thought-Knot Seer")).toBe(true);
  });

  it("should have spell + ETB exile from hand + LTB draw", () => {
    const override = getCardOverride("Thought-Knot Seer")!;
    const abilities = override.getAbilities();
    expect(abilities.length).toBeGreaterThanOrEqual(3);
  });

  it("should target an opponent on ETB", () => {
    const override = getCardOverride("Thought-Knot Seer")!;
    const etb = getTriggeredAbility(override.getAbilities(), "tks_etb");
    expect(etb.targets).toHaveLength(1);
    expect(etb.targets![0].controller).toBe("opponent");
  });
});

describe("Gurmag Angler override", () => {
  it("should be registered as a vanilla creature", () => {
    const override = getCardOverride("Gurmag Angler")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

describe("Tasigur, the Golden Fang override", () => {
  it("should be registered as a vanilla creature", () => {
    const override = getCardOverride("Tasigur, the Golden Fang")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

describe("Kalitas, Traitor of Ghet override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Kalitas, Traitor of Ghet")).toBe(true);
  });

  it("should have spell + lifelink keyword", () => {
    const override = getCardOverride("Kalitas, Traitor of Ghet")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
    const lifelink = abilities.find((a) => a.type === "static") as SpellAbilityStatic;
    expect(lifelink.continuousEffect.effectType).toBe("lifelink");
  });
});

describe("Glorybringer override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Glorybringer")).toBe(true);
  });

  it("should have spell + flying + haste keywords", () => {
    const override = getCardOverride("Glorybringer")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);
    const flying = abilities.find((a) => a.id?.includes("flying")) as SpellAbilityStatic;
    expect(flying.continuousEffect.effectType).toBe("flying");
    const haste = abilities.find((a) => a.id?.includes("haste")) as SpellAbilityStatic;
    expect(haste.continuousEffect.effectType).toBe("haste");
  });
});

describe("Rekindling Phoenix override", () => {
  it("should be registered with spell + flying", () => {
    const override = getCardOverride("Rekindling Phoenix")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
    const flying = abilities.find((a) => a.type === "static") as SpellAbilityStatic;
    expect(flying.continuousEffect.effectType).toBe("flying");
  });
});

describe("Questing Beast override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Questing Beast")).toBe(true);
  });

  it("should have spell + vigilance + deathtouch + haste", () => {
    const override = getCardOverride("Questing Beast")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(4);
    const keywords = abilities
      .filter((a) => a.type === "static")
      .map((a) => (a as SpellAbilityStatic).continuousEffect.effectType);
    expect(keywords).toContain("vigilance");
    expect(keywords).toContain("deathtouch");
    expect(keywords).toContain("haste");
  });
});

describe("Polukranos, World Eater override", () => {
  it("should be registered as vanilla", () => {
    const override = getCardOverride("Polukranos, World Eater")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

describe("Knight of Autumn override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Knight of Autumn")).toBe(true);
  });

  it("should have spell + ETB gain 4 life", () => {
    const override = getCardOverride("Knight of Autumn")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
    const etb = getTriggeredAbility(abilities);
    expect(etb.triggerCondition.self).toBe(true);
    expect(etb.effects[0].type).toBe("gainLife");
    if (etb.effects[0].type === "gainLife") {
      expect(etb.effects[0].amount).toBe(4);
    }
  });
});

// ===========================================================================
// ENCHANTMENTS / ARTIFACTS
// ===========================================================================

describe("Rest in Peace override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Rest in Peace")).toBe(true);
  });

  it("should have a replacement effect static and an ETB trigger", () => {
    const override = getCardOverride("Rest in Peace")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
    const static_ = getStaticAbility(abilities);
    expect(static_.continuousEffect.effectType).toBe("replacementEffect");
    const etb = getTriggeredAbility(abilities);
    expect(etb.triggerCondition.self).toBe(true);
  });
});

describe("Leyline of the Void override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Leyline of the Void")).toBe(true);
  });

  it("should have a replacement effect static", () => {
    const override = getCardOverride("Leyline of the Void")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    const static_ = getStaticAbility(abilities);
    expect(static_.continuousEffect.effectType).toBe("replacementEffect");
  });
});

describe("Chalice of the Void override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Chalice of the Void")).toBe(true);
  });

  it("should have ETB to add X charge counters + triggered counter ability", () => {
    const override = getCardOverride("Chalice of the Void")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const etb = getTriggeredAbility(abilities, "chalice_etb");
    expect(etb.effects[0].type).toBe("addCounters");
    if (etb.effects[0].type === "addCounters") {
      expect(etb.effects[0].counterType).toBe("charge");
    }

    const counter = getTriggeredAbility(abilities, "chalice_counter");
    expect(counter.triggerCondition.eventType).toBe("spellCast");
  });
});

describe("Pithing Needle override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Pithing Needle")).toBe(true);
  });

  it("should have a restriction static ability", () => {
    const override = getCardOverride("Pithing Needle")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    const static_ = getStaticAbility(abilities);
    expect(static_.continuousEffect.effectType).toBe("restriction");
  });
});

describe("Grafdigger's Cage override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Grafdigger's Cage")).toBe(true);
  });

  it("should have a restriction static for creatures from graveyard/library", () => {
    const override = getCardOverride("Grafdigger's Cage")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    const static_ = getStaticAbility(abilities);
    expect(static_.continuousEffect.effectType).toBe("restriction");
    expect(static_.continuousEffect.affectedFilter.cardTypes).toContain("Creature");
  });
});

describe("Tormod's Crypt override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Tormod's Crypt")).toBe(true);
  });

  it("should have activated ability that taps + sacrifices self", () => {
    const override = getCardOverride("Tormod's Crypt")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    const activated = getActivatedAbility(abilities);
    expect(activated.cost.tapSelf).toBe(true);
    expect(activated.cost.sacrifice).toBeDefined();
    expect(activated.cost.sacrifice!.self).toBe(true);
  });

  it("should target a player", () => {
    const override = getCardOverride("Tormod's Crypt")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});

describe("Relic of Progenitus override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Relic of Progenitus")).toBe(true);
  });

  it("should have two activated abilities", () => {
    const override = getCardOverride("Relic of Progenitus")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
    expect(abilities.every((a) => a.type === "activated")).toBe(true);
  });

  it("should have first ability targeting a card in graveyard", () => {
    const override = getCardOverride("Relic of Progenitus")!;
    const first = getActivatedAbility(override.getAbilities(), "relic_exile_one");
    expect(first.cost.tapSelf).toBe(true);
    expect(first.targets).toHaveLength(1);
    expect(first.targets![0].targetTypes).toContain("card-in-graveyard");
  });

  it("should have second ability that exiles self and draws a card", () => {
    const override = getCardOverride("Relic of Progenitus")!;
    const second = getActivatedAbility(override.getAbilities(), "relic_exile_all");
    expect(second.cost.exileSelf).toBe(true);
    expect(second.cost.manaCost).toBeDefined();
    const draw = second.effects.find((e) => e.type === "drawCards");
    expect(draw).toBeDefined();
  });
});

// ===========================================================================
// INSTANTS / SORCERIES
// ===========================================================================

describe("Abzan Charm override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Abzan Charm")).toBe(true);
  });

  it("should draw 2 cards and lose 2 life", () => {
    const override = getCardOverride("Abzan Charm")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);
    expect(spell.effects[0].type).toBe("drawCards");
    if (spell.effects[0].type === "drawCards") {
      expect(spell.effects[0].count).toBe(2);
    }
    expect(spell.effects[1].type).toBe("loseLife");
    if (spell.effects[1].type === "loseLife") {
      expect(spell.effects[1].amount).toBe(2);
    }
  });
});

describe("Dromoka's Command override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Dromoka's Command")).toBe(true);
  });

  it("should put a +1/+1 counter on target creature", () => {
    const override = getCardOverride("Dromoka's Command")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("addCounters");
    if (spell.effects[0].type === "addCounters") {
      expect(spell.effects[0].counterType).toBe("+1/+1");
      expect(spell.effects[0].count).toBe(1);
    }
  });

  it("should target a creature", () => {
    const override = getCardOverride("Dromoka's Command")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
  });
});

describe("Unburial Rites override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Unburial Rites")).toBe(true);
  });

  it("should be castable from graveyard (flashback)", () => {
    const override = getCardOverride("Unburial Rites")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.zones).toContain(ZoneType.Graveyard);
  });

  it("should use custom resolve for reanimation", () => {
    const override = getCardOverride("Unburial Rites")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("custom");
  });

  it("should target a creature card in a graveyard", () => {
    const override = getCardOverride("Unburial Rites")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("card-in-graveyard");
  });
});

describe("Traverse the Ulvenwald override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Traverse the Ulvenwald")).toBe(true);
  });

  it("should add green mana", () => {
    const override = getCardOverride("Traverse the Ulvenwald")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("addMana");
    if (spell.effects[0].type === "addMana") {
      expect(spell.effects[0].mana.G).toBe(1);
    }
  });
});

// ===========================================================================
// EXTRA STAPLES
// ===========================================================================

describe("Settle the Wreckage override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Settle the Wreckage")).toBe(true);
  });

  it("should use custom resolve", () => {
    const override = getCardOverride("Settle the Wreckage")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects[0].type).toBe("custom");
  });
});

describe("Council's Judgment override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Council's Judgment")).toBe(true);
  });

  it("should exile target nonland permanent", () => {
    const override = getCardOverride("Council's Judgment")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("exile");
  });

  it("should target a permanent", () => {
    const override = getCardOverride("Council's Judgment")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("permanent");
  });
});

describe("Spell Snare override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Spell Snare")).toBe(true);
  });

  it("should counter target spell with CMC 2", () => {
    const override = getCardOverride("Spell Snare")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("counter");
  });

  it("should have filter for CMC 2 on target", () => {
    const override = getCardOverride("Spell Snare")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].filter).toBeDefined();
    expect(override.spellTargets[0].filter!.cmc).toBeDefined();
  });
});

describe("Dissolve override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Dissolve")).toBe(true);
  });

  it("should counter target spell and scry 1", () => {
    const override = getCardOverride("Dissolve")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);
    expect(spell.effects[0].type).toBe("counter");
    expect(spell.effects[1].type).toBe("custom");
  });
});

describe("Bone Shards override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Bone Shards")).toBe(true);
  });

  it("should destroy target creature or planeswalker", () => {
    const override = getCardOverride("Bone Shards")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("destroy");
  });

  it("should target creatures and planeswalkers", () => {
    const override = getCardOverride("Bone Shards")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("planeswalker");
  });
});

describe("Searing Spear override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Searing Spear")).toBe(true);
  });

  it("should deal 3 damage to any target", () => {
    const override = getCardOverride("Searing Spear")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("dealDamage");
    if (spell.effects[0].type === "dealDamage") {
      expect(spell.effects[0].amount).toBe(3);
    }
  });
});

describe("Skullclamp override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Skullclamp")).toBe(true);
  });

  it("should have static +1/-1 buff, death trigger draw 2, and equip activated ability", () => {
    const override = getCardOverride("Skullclamp")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    const buff = getStaticAbility(abilities, "skullclamp_buff");
    expect(buff.continuousEffect.effectType).toBe("modifyPT");

    const deathTrigger = getTriggeredAbility(abilities, "skullclamp_draw");
    expect(deathTrigger.effects[0].type).toBe("drawCards");

    const equip = getActivatedAbility(abilities, "skullclamp_equip");
    expect(equip.timing).toBe("sorcery");
  });
});

describe("Thrun, the Last Troll override", () => {
  it("should be registered as vanilla", () => {
    const override = getCardOverride("Thrun, the Last Troll")!;
    expect(override).toBeDefined();
    expect(override.getAbilities()).toHaveLength(1);
    expect(override.getAbilities()[0].type).toBe("spell");
  });
});

describe("Fleecemane Lion override", () => {
  it("should be registered as vanilla", () => {
    const override = getCardOverride("Fleecemane Lion")!;
    expect(override).toBeDefined();
    expect(override.getAbilities()).toHaveLength(1);
    expect(override.getAbilities()[0].type).toBe("spell");
  });
});

describe("Dragonlord Ojutai override", () => {
  it("should be registered with spell + flying", () => {
    const override = getCardOverride("Dragonlord Ojutai")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
    const flying = abilities.find((a) => a.type === "static") as SpellAbilityStatic;
    expect(flying.continuousEffect.effectType).toBe("flying");
  });
});

describe("Mantis Rider override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Mantis Rider")).toBe(true);
  });

  it("should have spell + flying + vigilance + haste", () => {
    const override = getCardOverride("Mantis Rider")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(4);
    const keywords = abilities
      .filter((a) => a.type === "static")
      .map((a) => (a as SpellAbilityStatic).continuousEffect.effectType);
    expect(keywords).toContain("flying");
    expect(keywords).toContain("vigilance");
    expect(keywords).toContain("haste");
  });
});

describe("Anafenza, the Foremost override", () => {
  it("should be registered as vanilla", () => {
    const override = getCardOverride("Anafenza, the Foremost")!;
    expect(override).toBeDefined();
    expect(override.getAbilities()).toHaveLength(1);
    expect(override.getAbilities()[0].type).toBe("spell");
  });
});

describe("Grim Lavamancer override", () => {
  it("should be registered", () => {
    expect(hasCardOverride("Grim Lavamancer")).toBe(true);
  });

  it("should have spell + activated damage ability", () => {
    const override = getCardOverride("Grim Lavamancer")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should have activated ability that taps + exiles from graveyard to deal 2 damage", () => {
    const override = getCardOverride("Grim Lavamancer")!;
    const activated = getActivatedAbility(override.getAbilities(), "lavamancer_ping");
    expect(activated.cost.tapSelf).toBe(true);
    expect(activated.cost.exileFromGraveyard).toBeDefined();
    expect(activated.cost.exileFromGraveyard!.count).toBe(2);
    expect(activated.effects[0].type).toBe("dealDamage");
    if (activated.effects[0].type === "dealDamage") {
      expect(activated.effects[0].amount).toBe(2);
    }
  });

  it("should have spell-level targets for the activated ability", () => {
    const override = getCardOverride("Grim Lavamancer")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});
