import { describe, it, expect } from "vitest";
import type { SpellAbility, SpellAbilitySpell, SpellAbilityMana, SpellAbilityActivated, SpellAbilityTriggered, Effect } from "@magic-flux/types";
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

function getManaAbility(abilities: SpellAbility[]): SpellAbilityMana {
  const mana = abilities.find((a) => a.type === "mana");
  if (!mana) throw new Error("No mana ability found");
  return mana as SpellAbilityMana;
}

function getEffect(ability: SpellAbility, effectType: string): Effect {
  const effect = ability.effects.find((e) => e.type === effectType);
  if (!effect) throw new Error(`No ${effectType} effect found`);
  return effect;
}

// ---------------------------------------------------------------------------
// Override registry
// ---------------------------------------------------------------------------

describe("override registry", () => {
  it("should have all overrides registered (Phase 2 spells + lands + Phase 3 creatures/enchantments/artifacts + Phase 3 additional creatures)", () => {
    const names = getOverrideNames();
    expect(names.length).toBeGreaterThanOrEqual(46);
  });

  it("should look up overrides case-insensitively", () => {
    expect(hasCardOverride("Lightning Bolt")).toBe(true);
    expect(hasCardOverride("lightning bolt")).toBe(true);
    expect(hasCardOverride("LIGHTNING BOLT")).toBe(true);
  });

  it("should return undefined for unknown cards", () => {
    expect(getCardOverride("Nonexistent Card")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Lightning Bolt
// ---------------------------------------------------------------------------

describe("Lightning Bolt override", () => {
  it("should produce a spell ability", () => {
    const override = getCardOverride("Lightning Bolt")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const spell = getSpellAbility(abilities);
    expect(spell.id).toBe("lightning_bolt_spell");
    expect(spell.zones).toContain(ZoneType.Hand);
    expect(spell.zones).toContain(ZoneType.Stack);
  });

  it("should deal 3 damage to a target", () => {
    const override = getCardOverride("Lightning Bolt")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "dealDamage");
    expect(effect.type).toBe("dealDamage");
    if (effect.type === "dealDamage") {
      expect(effect.amount).toBe(3);
      expect(effect.to.targetRequirementId).toBe("target_any");
    }
  });

  it("should have correct target requirements", () => {
    const override = getCardOverride("Lightning Bolt")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].id).toBe("target_any");
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("player");
    expect(override.spellTargets[0].targetTypes).toContain("planeswalker");
    expect(override.spellTargets[0].count).toEqual({ exactly: 1 });
  });
});

// ---------------------------------------------------------------------------
// Counterspell
// ---------------------------------------------------------------------------

describe("Counterspell override", () => {
  it("should produce a spell ability with counter effect", () => {
    const override = getCardOverride("Counterspell")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const spell = getSpellAbility(abilities);
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "counter");
    expect(effect.type).toBe("counter");
    if (effect.type === "counter") {
      expect(effect.target.targetRequirementId).toBe("target_spell");
    }
  });

  it("should target a spell", () => {
    const override = getCardOverride("Counterspell")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toEqual(["spell"]);
  });
});

// ---------------------------------------------------------------------------
// Giant Growth
// ---------------------------------------------------------------------------

describe("Giant Growth override", () => {
  it("should produce a modifyPT effect of +3/+3 until end of turn", () => {
    const override = getCardOverride("Giant Growth")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "modifyPT");
    expect(effect.type).toBe("modifyPT");
    if (effect.type === "modifyPT") {
      expect(effect.power).toBe(3);
      expect(effect.toughness).toBe(3);
      expect(effect.duration).toBe("endOfTurn");
      expect(effect.target.targetRequirementId).toBe("target_creature");
    }
  });

  it("should target a creature", () => {
    const override = getCardOverride("Giant Growth")!;
    expect(override.spellTargets[0].targetTypes).toEqual(["creature"]);
  });
});

// ---------------------------------------------------------------------------
// Shock
// ---------------------------------------------------------------------------

describe("Shock override", () => {
  it("should deal 2 damage to any target", () => {
    const override = getCardOverride("Shock")!;
    const spell = getSpellAbility(override.getAbilities());

    const effect = getEffect(spell, "dealDamage");
    if (effect.type === "dealDamage") {
      expect(effect.amount).toBe(2);
      expect(effect.to.targetRequirementId).toBe("target_any");
    }
  });

  it("should have same targeting as Lightning Bolt", () => {
    const override = getCardOverride("Shock")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});

// ---------------------------------------------------------------------------
// Dark Ritual
// ---------------------------------------------------------------------------

describe("Dark Ritual override", () => {
  it("should add {B}{B}{B} to controller's mana pool", () => {
    const override = getCardOverride("Dark Ritual")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.B).toBe(3);
      expect(effect.mana.W).toBe(0);
      expect(effect.mana.U).toBe(0);
      expect(effect.mana.R).toBe(0);
      expect(effect.mana.G).toBe(0);
      expect(effect.player).toEqual({ type: "controller" });
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Dark Ritual")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Doom Blade
// ---------------------------------------------------------------------------

describe("Doom Blade override", () => {
  it("should destroy a target", () => {
    const override = getCardOverride("Doom Blade")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "destroy");
    if (effect.type === "destroy") {
      expect(effect.target.targetRequirementId).toBe("target_nonblack_creature");
    }
  });

  it("should target nonblack creatures only", () => {
    const override = getCardOverride("Doom Blade")!;
    expect(override.spellTargets).toHaveLength(1);
    const target = override.spellTargets[0];
    expect(target.targetTypes).toEqual(["creature"]);
    expect(target.filter).not.toBeNull();
    expect(target.filter!.colorsNot).toContain("B");
  });
});

// ---------------------------------------------------------------------------
// Healing Salve
// ---------------------------------------------------------------------------

describe("Healing Salve override", () => {
  it("should gain 3 life for target player", () => {
    const override = getCardOverride("Healing Salve")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "gainLife");
    if (effect.type === "gainLife") {
      expect(effect.amount).toBe(3);
      expect(effect.player.type).toBe("targetPlayer");
    }
  });

  it("should target a player", () => {
    const override = getCardOverride("Healing Salve")!;
    expect(override.spellTargets[0].targetTypes).toEqual(["player"]);
  });
});

// ---------------------------------------------------------------------------
// Ancestral Recall
// ---------------------------------------------------------------------------

describe("Ancestral Recall override", () => {
  it("should draw 3 cards for target player", () => {
    const override = getCardOverride("Ancestral Recall")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "drawCards");
    if (effect.type === "drawCards") {
      expect(effect.count).toBe(3);
      expect(effect.player.type).toBe("targetPlayer");
    }
  });

  it("should target a player", () => {
    const override = getCardOverride("Ancestral Recall")!;
    expect(override.spellTargets[0].targetTypes).toEqual(["player"]);
  });
});

// ---------------------------------------------------------------------------
// Naturalize
// ---------------------------------------------------------------------------

describe("Naturalize override", () => {
  it("should destroy a target", () => {
    const override = getCardOverride("Naturalize")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "destroy");
    if (effect.type === "destroy") {
      expect(effect.target.targetRequirementId).toBe("target_artifact_or_enchantment");
    }
  });

  it("should target artifact or enchantment", () => {
    const override = getCardOverride("Naturalize")!;
    const target = override.spellTargets[0];
    expect(target.targetTypes).toContain("artifact");
    expect(target.targetTypes).toContain("enchantment");
    expect(target.targetTypes).not.toContain("creature");
  });
});

// ---------------------------------------------------------------------------
// Divination
// ---------------------------------------------------------------------------

describe("Divination override", () => {
  it("should draw 2 cards for controller", () => {
    const override = getCardOverride("Divination")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "drawCards");
    if (effect.type === "drawCards") {
      expect(effect.count).toBe(2);
      expect(effect.player).toEqual({ type: "controller" });
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Divination")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Basic lands
// ---------------------------------------------------------------------------

describe("basic land overrides", () => {
  const landTests: Array<{ name: string; color: string; manaKey: string }> = [
    { name: "Plains", color: "W", manaKey: "W" },
    { name: "Island", color: "U", manaKey: "U" },
    { name: "Swamp", color: "B", manaKey: "B" },
    { name: "Mountain", color: "R", manaKey: "R" },
    { name: "Forest", color: "G", manaKey: "G" },
  ];

  for (const { name, color, manaKey } of landTests) {
    describe(name, () => {
      it("should produce a mana ability", () => {
        const override = getCardOverride(name)!;
        expect(override).toBeDefined();
        const abilities = override.getAbilities();
        expect(abilities).toHaveLength(1);

        const mana = getManaAbility(abilities);
        expect(mana.type).toBe("mana");
        expect(mana.zones).toEqual([ZoneType.Battlefield]);
      });

      it("should require tapping as cost", () => {
        const override = getCardOverride(name)!;
        const mana = getManaAbility(override.getAbilities());
        expect(mana.cost.tapSelf).toBe(true);
        expect(mana.cost.manaCost).toBeNull();
      });

      it(`should add 1 ${color} mana`, () => {
        const override = getCardOverride(name)!;
        const mana = getManaAbility(override.getAbilities());
        const effect = getEffect(mana, "addMana");
        if (effect.type === "addMana") {
          expect(effect.mana[manaKey as keyof typeof effect.mana]).toBe(1);
          // All other colors should be 0
          for (const key of ["W", "U", "B", "R", "G", "C"]) {
            if (key !== manaKey) {
              expect(effect.mana[key as keyof typeof effect.mana]).toBe(0);
            }
          }
        }
      });

      it("should not require targets", () => {
        const override = getCardOverride(name)!;
        expect(override.spellTargets).toHaveLength(0);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Creature overrides with keywords
// ---------------------------------------------------------------------------

describe("Grizzly Bears override", () => {
  it("should produce a spell ability only (vanilla creature)", () => {
    const override = getCardOverride("Grizzly Bears")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
    expect(abilities[0].id).toBe("grizzly_bears_spell");
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Grizzly Bears")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Serra Angel override", () => {
  it("should produce spell + flying + vigilance abilities", () => {
    const override = getCardOverride("Serra Angel")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();
    expect(spell!.id).toBe("serra_angel_spell");
  });

  it("should have flying static ability with correct effectType", () => {
    const override = getCardOverride("Serra Angel")!;
    const abilities = override.getAbilities();
    const flying = abilities.find((a) => a.id === "serra_angel_flying");
    expect(flying).toBeDefined();
    expect(flying!.type).toBe("static");
    if (flying!.type === "static") {
      expect(flying!.continuousEffect.effectType).toBe("flying");
      expect(flying!.layer).toBe(6);
    }
  });

  it("should have vigilance static ability with correct effectType", () => {
    const override = getCardOverride("Serra Angel")!;
    const abilities = override.getAbilities();
    const vigilance = abilities.find((a) => a.id === "serra_angel_vigilance");
    expect(vigilance).toBeDefined();
    expect(vigilance!.type).toBe("static");
    if (vigilance!.type === "static") {
      expect(vigilance!.continuousEffect.effectType).toBe("vigilance");
    }
  });
});

describe("Llanowar Elves override", () => {
  it("should produce spell + mana ability", () => {
    const override = getCardOverride("Llanowar Elves")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();

    const mana = getManaAbility(abilities);
    expect(mana.cost.tapSelf).toBe(true);
  });

  it("should add {G} when tapped", () => {
    const override = getCardOverride("Llanowar Elves")!;
    const mana = getManaAbility(override.getAbilities());
    const effect = getEffect(mana, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.G).toBe(1);
      expect(effect.mana.W).toBe(0);
      expect(effect.mana.U).toBe(0);
      expect(effect.mana.B).toBe(0);
      expect(effect.mana.R).toBe(0);
    }
  });
});

describe("Goblin Guide override", () => {
  it("should produce spell + haste + attack trigger", () => {
    const override = getCardOverride("Goblin Guide")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();

    const haste = abilities.find((a) => a.id === "goblin_guide_haste");
    expect(haste).toBeDefined();
    expect(haste!.type).toBe("static");
    if (haste!.type === "static") {
      expect(haste!.continuousEffect.effectType).toBe("haste");
    }

    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    expect(trigger!.id).toBe("goblin_guide_attack");
  });
});

describe("Giant Spider override", () => {
  it("should produce spell + reach", () => {
    const override = getCardOverride("Giant Spider")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const reach = abilities.find((a) => a.id === "giant_spider_reach");
    expect(reach).toBeDefined();
    expect(reach!.type).toBe("static");
    if (reach!.type === "static") {
      expect(reach!.continuousEffect.effectType).toBe("reach");
    }
  });
});

describe("Air Elemental override", () => {
  it("should produce spell + flying", () => {
    const override = getCardOverride("Air Elemental")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const flying = abilities.find((a) => a.id === "air_elemental_flying");
    expect(flying).toBeDefined();
    expect(flying!.type).toBe("static");
    if (flying!.type === "static") {
      expect(flying!.continuousEffect.effectType).toBe("flying");
    }
  });
});

describe("Vampire Nighthawk override", () => {
  it("should produce spell + flying + deathtouch + lifelink", () => {
    const override = getCardOverride("Vampire Nighthawk")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(4);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();
  });

  it("should have all three keyword abilities with correct effectTypes", () => {
    const override = getCardOverride("Vampire Nighthawk")!;
    const abilities = override.getAbilities();

    const flying = abilities.find((a) => a.id === "vampire_nighthawk_flying");
    expect(flying).toBeDefined();
    if (flying!.type === "static") {
      expect(flying!.continuousEffect.effectType).toBe("flying");
    }

    const deathtouch = abilities.find((a) => a.id === "vampire_nighthawk_deathtouch");
    expect(deathtouch).toBeDefined();
    if (deathtouch!.type === "static") {
      expect(deathtouch!.continuousEffect.effectType).toBe("deathtouch");
    }

    const lifelink = abilities.find((a) => a.id === "vampire_nighthawk_lifelink");
    expect(lifelink).toBeDefined();
    if (lifelink!.type === "static") {
      expect(lifelink!.continuousEffect.effectType).toBe("lifelink");
    }
  });
});

describe("Monastery Swiftspear override", () => {
  it("should produce spell + haste + prowess trigger", () => {
    const override = getCardOverride("Monastery Swiftspear")!;
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    const haste = abilities.find((a) => a.id === "monastery_swiftspear_haste");
    expect(haste).toBeDefined();
    if (haste!.type === "static") {
      expect(haste!.continuousEffect.effectType).toBe("haste");
    }
  });

  it("should have prowess triggered ability", () => {
    const override = getCardOverride("Monastery Swiftspear")!;
    const abilities = override.getAbilities();
    const prowess = abilities.find((a) => a.type === "triggered");
    expect(prowess).toBeDefined();
    expect(prowess!.id).toBe("monastery_swiftspear_prowess");

    if (prowess!.type === "triggered") {
      expect(prowess!.triggerCondition.eventType).toBe("spellCast");
      expect(prowess!.effects).toHaveLength(1);
      expect(prowess!.effects[0].type).toBe("modifyPT");
      if (prowess!.effects[0].type === "modifyPT") {
        expect(prowess!.effects[0].power).toBe(1);
        expect(prowess!.effects[0].toughness).toBe(1);
        expect(prowess!.effects[0].duration).toBe("endOfTurn");
      }
    }
  });
});

describe("Savannah Lions override", () => {
  it("should produce a spell ability only (vanilla creature)", () => {
    const override = getCardOverride("Savannah Lions")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

describe("Elvish Mystic override", () => {
  it("should produce spell + mana ability", () => {
    const override = getCardOverride("Elvish Mystic")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();

    const mana = getManaAbility(abilities);
    expect(mana.cost.tapSelf).toBe(true);
  });

  it("should add {G} when tapped", () => {
    const override = getCardOverride("Elvish Mystic")!;
    const mana = getManaAbility(override.getAbilities());
    const effect = getEffect(mana, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.G).toBe(1);
    }
  });
});

// ===========================================================================
// Phase 3 additional creature overrides
// ===========================================================================

// ---------------------------------------------------------------------------
// Wall of Omens
// ---------------------------------------------------------------------------

describe("Wall of Omens override", () => {
  it("should produce spell + defender + ETB draw", () => {
    const override = getCardOverride("Wall of Omens")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();
  });

  it("should have defender static ability", () => {
    const override = getCardOverride("Wall of Omens")!;
    const abilities = override.getAbilities();
    const defender = abilities.find((a) => a.id === "wall_of_omens_defender");
    expect(defender).toBeDefined();
    expect(defender!.type).toBe("static");
    if (defender!.type === "static") {
      expect(defender!.continuousEffect.effectType).toBe("defender");
    }
  });

  it("should have ETB trigger that draws a card", () => {
    const override = getCardOverride("Wall of Omens")!;
    const abilities = override.getAbilities();
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    if (etb!.type === "triggered") {
      expect(etb!.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(etb!.triggerCondition.self).toBe(true);
    }
    expect(etb!.effects).toHaveLength(1);
    expect(etb!.effects[0].type).toBe("drawCards");
    if (etb!.effects[0].type === "drawCards") {
      expect(etb!.effects[0].count).toBe(1);
    }
  });

  it("should not require targets", () => {
    const override = getCardOverride("Wall of Omens")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mother of Runes
// ---------------------------------------------------------------------------

describe("Mother of Runes override", () => {
  it("should produce spell + activated protection ability", () => {
    const override = getCardOverride("Mother of Runes")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();

    const activated = abilities.find((a) => a.type === "activated");
    expect(activated).toBeDefined();
  });

  it("should have activated ability that costs {T}", () => {
    const override = getCardOverride("Mother of Runes")!;
    const abilities = override.getAbilities();
    const activated = abilities.find((a) => a.type === "activated");
    if (activated!.type === "activated") {
      expect(activated!.cost.tapSelf).toBe(true);
      expect(activated!.cost.manaCost).toBeNull();
    }
  });

  it("should target a creature you control", () => {
    const override = getCardOverride("Mother of Runes")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].controller).toBe("you");
  });
});

// ---------------------------------------------------------------------------
// Baneslayer Angel
// ---------------------------------------------------------------------------

describe("Baneslayer Angel override", () => {
  it("should produce spell + flying + first_strike + lifelink", () => {
    const override = getCardOverride("Baneslayer Angel")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(4);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();
  });

  it("should have all three keyword static abilities", () => {
    const override = getCardOverride("Baneslayer Angel")!;
    const abilities = override.getAbilities();

    const flying = abilities.find((a) => a.id === "baneslayer_angel_flying");
    expect(flying).toBeDefined();
    expect(flying!.type).toBe("static");

    const firstStrike = abilities.find((a) => a.id === "baneslayer_angel_first_strike");
    expect(firstStrike).toBeDefined();
    if (firstStrike!.type === "static") {
      expect(firstStrike!.continuousEffect.effectType).toBe("first strike");
    }

    const lifelink = abilities.find((a) => a.id === "baneslayer_angel_lifelink");
    expect(lifelink).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Snapcaster Mage
// ---------------------------------------------------------------------------

describe("Snapcaster Mage override", () => {
  it("should produce spell + flash + ETB trigger", () => {
    const override = getCardOverride("Snapcaster Mage")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);
  });

  it("should have flash keyword static", () => {
    const override = getCardOverride("Snapcaster Mage")!;
    const abilities = override.getAbilities();
    const flash = abilities.find((a) => a.id === "snapcaster_mage_flash");
    expect(flash).toBeDefined();
    expect(flash!.type).toBe("static");
    if (flash!.type === "static") {
      expect(flash!.continuousEffect.effectType).toBe("flash");
    }
  });

  it("should have ETB trigger targeting instant/sorcery in graveyard", () => {
    const override = getCardOverride("Snapcaster Mage")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("card-in-graveyard");
    expect(override.spellTargets[0].filter).toBeDefined();
    expect(override.spellTargets[0].filter!.cardTypes).toContain("Instant");
    expect(override.spellTargets[0].filter!.cardTypes).toContain("Sorcery");
    expect(override.spellTargets[0].controller).toBe("you");
  });
});

// ---------------------------------------------------------------------------
// Delver of Secrets
// ---------------------------------------------------------------------------

describe("Delver of Secrets override", () => {
  it("should produce only a spell ability (simplified)", () => {
    const override = getCardOverride("Delver of Secrets")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

// ---------------------------------------------------------------------------
// Man-o'-War
// ---------------------------------------------------------------------------

describe("Man-o'-War override", () => {
  it("should produce spell + ETB bounce trigger", () => {
    const override = getCardOverride("Man-o'-War")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should have ETB bounce effect", () => {
    const override = getCardOverride("Man-o'-War")!;
    const abilities = override.getAbilities();
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    expect(etb!.effects[0].type).toBe("bounce");
    if (etb!.effects[0].type === "bounce") {
      expect(etb!.effects[0].to).toBe(ZoneType.Hand);
    }
  });

  it("should target any creature", () => {
    const override = getCardOverride("Man-o'-War")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].controller).toBe("any");
  });
});

// ---------------------------------------------------------------------------
// Nether Spirit
// ---------------------------------------------------------------------------

describe("Nether Spirit override", () => {
  it("should produce only a spell ability (simplified)", () => {
    const override = getCardOverride("Nether Spirit")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

// ---------------------------------------------------------------------------
// Dark Confidant
// ---------------------------------------------------------------------------

describe("Dark Confidant override", () => {
  it("should produce spell + upkeep trigger", () => {
    const override = getCardOverride("Dark Confidant")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();

    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
  });

  it("should have upkeep trigger with custom resolve", () => {
    const override = getCardOverride("Dark Confidant")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    if (trigger!.type === "triggered") {
      expect(trigger!.triggerCondition.eventType).toBe("stepBegin");
    }
    expect(trigger!.effects[0].type).toBe("custom");
    if (trigger!.effects[0].type === "custom") {
      expect(trigger!.effects[0].resolveFunction).toBe("dark_confidant_reveal");
    }
  });
});

// ---------------------------------------------------------------------------
// Dread Shade
// ---------------------------------------------------------------------------

describe("Dread Shade override", () => {
  it("should produce spell + activated pump ability", () => {
    const override = getCardOverride("Dread Shade")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should have {B}: +1/+1 until end of turn pump", () => {
    const override = getCardOverride("Dread Shade")!;
    const abilities = override.getAbilities();
    const pump = abilities.find((a) => a.type === "activated");
    expect(pump).toBeDefined();
    if (pump!.type === "activated") {
      expect(pump!.cost.manaCost).toBeDefined();
      expect(pump!.cost.tapSelf).toBe(false);
    }
    expect(pump!.effects[0].type).toBe("modifyPT");
    if (pump!.effects[0].type === "modifyPT") {
      expect(pump!.effects[0].power).toBe(1);
      expect(pump!.effects[0].toughness).toBe(1);
      expect(pump!.effects[0].duration).toBe("endOfTurn");
    }
  });
});

// ---------------------------------------------------------------------------
// Lightning Mauler
// ---------------------------------------------------------------------------

describe("Lightning Mauler override", () => {
  it("should produce spell + haste", () => {
    const override = getCardOverride("Lightning Mauler")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const haste = abilities.find((a) => a.id === "lightning_mauler_haste");
    expect(haste).toBeDefined();
    if (haste!.type === "static") {
      expect(haste!.continuousEffect.effectType).toBe("haste");
    }
  });
});

// ---------------------------------------------------------------------------
// Ball Lightning
// ---------------------------------------------------------------------------

describe("Ball Lightning override", () => {
  it("should produce spell + trample + haste + end-step sacrifice trigger", () => {
    const override = getCardOverride("Ball Lightning")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(4);
  });

  it("should have trample and haste keyword statics", () => {
    const override = getCardOverride("Ball Lightning")!;
    const abilities = override.getAbilities();

    const trample = abilities.find((a) => a.id === "ball_lightning_trample");
    expect(trample).toBeDefined();
    if (trample!.type === "static") {
      expect(trample!.continuousEffect.effectType).toBe("trample");
    }

    const haste = abilities.find((a) => a.id === "ball_lightning_haste");
    expect(haste).toBeDefined();
    if (haste!.type === "static") {
      expect(haste!.continuousEffect.effectType).toBe("haste");
    }
  });

  it("should have end-step sacrifice trigger", () => {
    const override = getCardOverride("Ball Lightning")!;
    const abilities = override.getAbilities();
    const sacrifice = abilities.find((a) => a.type === "triggered");
    expect(sacrifice).toBeDefined();
    if (sacrifice!.type === "triggered") {
      expect(sacrifice!.triggerCondition.eventType).toBe("stepBegin");
    }
    expect(sacrifice!.effects[0].type).toBe("sacrifice");
  });
});

// ---------------------------------------------------------------------------
// Ember Hauler
// ---------------------------------------------------------------------------

describe("Ember Hauler override", () => {
  it("should produce spell + activated damage ability", () => {
    const override = getCardOverride("Ember Hauler")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should have activated ability that costs {1} + sacrifice self", () => {
    const override = getCardOverride("Ember Hauler")!;
    const abilities = override.getAbilities();
    const activated = abilities.find((a) => a.type === "activated");
    expect(activated).toBeDefined();
    if (activated!.type === "activated") {
      expect(activated!.cost.manaCost).toBeDefined();
      expect(activated!.cost.sacrifice).toBeDefined();
      expect(activated!.cost.sacrifice!.self).toBe(true);
    }
  });

  it("should deal 2 damage to any target", () => {
    const override = getCardOverride("Ember Hauler")!;
    const abilities = override.getAbilities();
    const activated = abilities.find((a) => a.type === "activated");
    expect(activated!.effects[0].type).toBe("dealDamage");
    if (activated!.effects[0].type === "dealDamage") {
      expect(activated!.effects[0].amount).toBe(2);
    }
  });

  it("should have spell-level targets for the activated ability", () => {
    const override = getCardOverride("Ember Hauler")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});

// ---------------------------------------------------------------------------
// Tarmogoyf (simplified)
// ---------------------------------------------------------------------------

describe("Tarmogoyf override", () => {
  it("should produce only a spell ability (simplified 4/5)", () => {
    const override = getCardOverride("Tarmogoyf")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

// ---------------------------------------------------------------------------
// Sylvan Caryatid
// ---------------------------------------------------------------------------

describe("Sylvan Caryatid override", () => {
  it("should produce spell + defender + hexproof + mana ability", () => {
    const override = getCardOverride("Sylvan Caryatid")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(4);
  });

  it("should have defender and hexproof keyword statics", () => {
    const override = getCardOverride("Sylvan Caryatid")!;
    const abilities = override.getAbilities();

    const defender = abilities.find((a) => a.id === "sylvan_caryatid_defender");
    expect(defender).toBeDefined();
    if (defender!.type === "static") {
      expect(defender!.continuousEffect.effectType).toBe("defender");
    }

    const hexproof = abilities.find((a) => a.id === "sylvan_caryatid_hexproof");
    expect(hexproof).toBeDefined();
    if (hexproof!.type === "static") {
      expect(hexproof!.continuousEffect.effectType).toBe("hexproof");
    }
  });

  it("should have mana ability that taps for any color", () => {
    const override = getCardOverride("Sylvan Caryatid")!;
    const abilities = override.getAbilities();
    const mana = getManaAbility(abilities);
    expect(mana.cost.tapSelf).toBe(true);
    const effect = getEffect(mana, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.C).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Leatherback Baloth
// ---------------------------------------------------------------------------

describe("Leatherback Baloth override", () => {
  it("should produce only a spell ability (vanilla)", () => {
    const override = getCardOverride("Leatherback Baloth")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

// ---------------------------------------------------------------------------
// Kalonian Tusker
// ---------------------------------------------------------------------------

describe("Kalonian Tusker override", () => {
  it("should produce only a spell ability (vanilla)", () => {
    const override = getCardOverride("Kalonian Tusker")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);
    expect(abilities[0].type).toBe("spell");
  });
});

// ---------------------------------------------------------------------------
// Courser of Kruphix
// ---------------------------------------------------------------------------

describe("Courser of Kruphix override", () => {
  it("should produce spell + land-ETB life trigger", () => {
    const override = getCardOverride("Courser of Kruphix")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should have trigger that fires when a land enters", () => {
    const override = getCardOverride("Courser of Kruphix")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger!.type === "triggered") {
      expect(trigger!.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(trigger!.triggerCondition.self).toBe(false);
      expect(trigger!.triggerCondition.filter).toBeDefined();
      expect(trigger!.triggerCondition.filter!.cardTypes).toContain("Land");
    }
  });

  it("should gain 1 life when triggered", () => {
    const override = getCardOverride("Courser of Kruphix")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger!.effects[0].type).toBe("gainLife");
    if (trigger!.effects[0].type === "gainLife") {
      expect(trigger!.effects[0].amount).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Geist of Saint Traft
// ---------------------------------------------------------------------------

describe("Geist of Saint Traft override", () => {
  it("should produce spell + hexproof + attack trigger", () => {
    const override = getCardOverride("Geist of Saint Traft")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);
  });

  it("should have hexproof keyword static", () => {
    const override = getCardOverride("Geist of Saint Traft")!;
    const abilities = override.getAbilities();
    const hexproof = abilities.find((a) => a.id === "geist_of_saint_traft_hexproof");
    expect(hexproof).toBeDefined();
    if (hexproof!.type === "static") {
      expect(hexproof!.continuousEffect.effectType).toBe("hexproof");
    }
  });

  it("should have attack trigger with custom resolve", () => {
    const override = getCardOverride("Geist of Saint Traft")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger!.type === "triggered") {
      expect(trigger!.triggerCondition.eventType).toBe("attackersDeclared");
    }
    expect(trigger!.effects[0].type).toBe("custom");
  });
});

// ---------------------------------------------------------------------------
// Kitchen Finks
// ---------------------------------------------------------------------------

describe("Kitchen Finks override", () => {
  it("should produce spell + ETB life gain trigger", () => {
    const override = getCardOverride("Kitchen Finks")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should gain 2 life on ETB", () => {
    const override = getCardOverride("Kitchen Finks")!;
    const abilities = override.getAbilities();
    const etb = abilities.find((a) => a.type === "triggered");
    expect(etb).toBeDefined();
    if (etb!.type === "triggered") {
      expect(etb!.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(etb!.triggerCondition.self).toBe(true);
    }
    expect(etb!.effects[0].type).toBe("gainLife");
    if (etb!.effects[0].type === "gainLife") {
      expect(etb!.effects[0].amount).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Bloodbraid Elf
// ---------------------------------------------------------------------------

describe("Bloodbraid Elf override", () => {
  it("should produce spell + haste + cascade trigger", () => {
    const override = getCardOverride("Bloodbraid Elf")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);
  });

  it("should have haste keyword static", () => {
    const override = getCardOverride("Bloodbraid Elf")!;
    const abilities = override.getAbilities();
    const haste = abilities.find((a) => a.id === "bloodbraid_elf_haste");
    expect(haste).toBeDefined();
    if (haste!.type === "static") {
      expect(haste!.continuousEffect.effectType).toBe("haste");
    }
  });

  it("should have cascade trigger on spell cast", () => {
    const override = getCardOverride("Bloodbraid Elf")!;
    const abilities = override.getAbilities();
    const cascade = abilities.find((a) => a.type === "triggered");
    expect(cascade).toBeDefined();
    if (cascade!.type === "triggered") {
      expect(cascade!.triggerCondition.eventType).toBe("spellCast");
      expect(cascade!.triggerCondition.self).toBe(true);
    }
    expect(cascade!.effects[0].type).toBe("custom");
  });
});

// ---------------------------------------------------------------------------
// Bonesplitter
// ---------------------------------------------------------------------------

describe("Bonesplitter override", () => {
  it("should produce static P/T mod + equip activated ability", () => {
    const override = getCardOverride("Bonesplitter")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);
  });

  it("should have static +2/+0 for equipped creature", () => {
    const override = getCardOverride("Bonesplitter")!;
    const abilities = override.getAbilities();
    const pt = abilities.find((a) => a.type === "static");
    expect(pt).toBeDefined();
    if (pt!.type === "static") {
      expect(pt!.continuousEffect.effectType).toBe("modifyPT");
      expect(pt!.continuousEffect.affectedFilter.custom).toBe("equipped_creature");
      const mod = pt!.continuousEffect.modification as { power: number; toughness: number };
      expect(mod.power).toBe(2);
      expect(mod.toughness).toBe(0);
    }
  });

  it("should have equip {1} activated ability", () => {
    const override = getCardOverride("Bonesplitter")!;
    const abilities = override.getAbilities();
    const equip = abilities.find((a) => a.type === "activated");
    expect(equip).toBeDefined();
    if (equip!.type === "activated") {
      expect(equip!.timing).toBe("sorcery");
      expect(equip!.cost.manaCost).toBeDefined();
      expect(equip!.cost.manaCost!.totalCMC).toBe(1);
    }
  });

  it("should target creature you control for equip", () => {
    const override = getCardOverride("Bonesplitter")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].controller).toBe("you");
  });
});

// ===========================================================================
// Phase 5 Group A — Aggro staples
// ===========================================================================

describe("Eidolon of the Great Revel override", () => {
  it("should produce spell + triggered abilities", () => {
    const override = getCardOverride("Eidolon of the Great Revel")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();
    expect(spell!.id).toContain("eidolon");

    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
  });

  it("should have a trigger on spellCast with CMC <= 3", () => {
    const override = getCardOverride("Eidolon of the Great Revel")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    if (trigger && trigger.type === "triggered") {
      expect(trigger.triggerCondition.eventType).toBe("spellCast");
      expect(trigger.triggerCondition.filter).not.toBeNull();
      expect(trigger.triggerCondition.filter!.cmc).toEqual({ op: "lte", value: 3 });
    }
  });

  it("should deal 2 damage via the trigger", () => {
    const override = getCardOverride("Eidolon of the Great Revel")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger!.effects).toHaveLength(1);
    expect(trigger!.effects[0].type).toBe("dealDamage");
    if (trigger!.effects[0].type === "dealDamage") {
      expect(trigger!.effects[0].amount).toBe(2);
    }
  });

  it("should not require targets from registry (no spellTargets)", () => {
    const override = getCardOverride("Eidolon of the Great Revel")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Earthshaker Khenra override", () => {
  it("should produce spell + haste + ETB trigger", () => {
    const override = getCardOverride("Earthshaker Khenra")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    expect(abilities.filter((a) => a.type === "spell")).toHaveLength(1);
    expect(abilities.filter((a) => a.type === "static")).toHaveLength(1);
    expect(abilities.filter((a) => a.type === "triggered")).toHaveLength(1);
  });

  it("should have haste keyword static", () => {
    const override = getCardOverride("Earthshaker Khenra")!;
    const abilities = override.getAbilities();
    const haste = abilities.find((a) => a.type === "static");
    if (haste && haste.type === "static") {
      expect(haste.continuousEffect.effectType).toBe("haste");
    }
  });

  it("should have ETB trigger targeting a creature", () => {
    const override = getCardOverride("Earthshaker Khenra")!;
    const abilities = override.getAbilities();
    const trigger = abilities.find((a) => a.type === "triggered");
    if (trigger && trigger.type === "triggered") {
      expect(trigger.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(trigger.triggerCondition.self).toBe(true);
      expect(trigger.targets).toHaveLength(1);
      expect(trigger.targets[0].targetTypes).toContain("creature");
    }
  });

  it("should have spellTargets for the ETB creature target", () => {
    const override = getCardOverride("Earthshaker Khenra")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
  });
});

describe("Thalia, Guardian of Thraben override", () => {
  it("should produce spell + first strike + tax static", () => {
    const override = getCardOverride("Thalia, Guardian of Thraben")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(3);

    expect(abilities.filter((a) => a.type === "spell")).toHaveLength(1);
    expect(abilities.filter((a) => a.type === "static")).toHaveLength(2);
  });

  it("should have first strike keyword", () => {
    const override = getCardOverride("Thalia, Guardian of Thraben")!;
    const abilities = override.getAbilities();
    const firstStrike = abilities.find(
      (a) => a.type === "static" && a.id.includes("first_strike")
    );
    expect(firstStrike).toBeDefined();
    if (firstStrike && firstStrike.type === "static") {
      expect(firstStrike.continuousEffect.effectType).toBe("first strike");
    }
  });

  it("should have costIncrease static for noncreature spells", () => {
    const override = getCardOverride("Thalia, Guardian of Thraben")!;
    const abilities = override.getAbilities();
    const tax = abilities.find(
      (a) => a.type === "static" && a.id.includes("tax")
    );
    expect(tax).toBeDefined();
    if (tax && tax.type === "static") {
      expect(tax.continuousEffect.effectType).toBe("costIncrease");
      expect(tax.continuousEffect.modification).toEqual({ genericIncrease: 1 });
    }
  });
});

describe("Adanto Vanguard override", () => {
  it("should produce spell + activated ability", () => {
    const override = getCardOverride("Adanto Vanguard")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    expect(abilities.filter((a) => a.type === "spell")).toHaveLength(1);
    expect(abilities.filter((a) => a.type === "activated")).toHaveLength(1);
  });

  it("should pay 4 life as activation cost", () => {
    const override = getCardOverride("Adanto Vanguard")!;
    const abilities = override.getAbilities();
    const activated = abilities.find((a) => a.type === "activated");
    if (activated && activated.type === "activated") {
      expect(activated.cost.payLife).toBe(4);
      expect(activated.cost.manaCost).toBeNull();
      expect(activated.cost.tapSelf).toBe(false);
    }
  });
});

describe("Benalish Marshal override", () => {
  it("should produce spell + anthem static", () => {
    const override = getCardOverride("Benalish Marshal")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    expect(abilities.filter((a) => a.type === "spell")).toHaveLength(1);
    expect(abilities.filter((a) => a.type === "static")).toHaveLength(1);
  });

  it("should have modifyPT anthem at layer 7 for other creatures you control", () => {
    const override = getCardOverride("Benalish Marshal")!;
    const abilities = override.getAbilities();
    const anthem = abilities.find((a) => a.type === "static");
    if (anthem && anthem.type === "static") {
      expect(anthem.continuousEffect.effectType).toBe("modifyPT");
      expect(anthem.continuousEffect.modification).toEqual({ power: 1, toughness: 1 });
      expect(anthem.continuousEffect.affectedFilter).toEqual(
        expect.objectContaining({ cardTypes: ["Creature"], self: false })
      );
      expect(anthem.layer).toBe(7);
    }
  });
});

describe("Experiment One override", () => {
  it("should produce spell + evolve triggered ability", () => {
    const override = getCardOverride("Experiment One")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger && trigger.type === "triggered") {
      expect(trigger.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(trigger.triggerCondition.filter!.cardTypes).toContain("Creature");
      expect(trigger.triggerCondition.self).toBe(false);
      expect(trigger.effects[0].type).toBe("custom");
    }
  });
});

describe("Pelt Collector override", () => {
  it("should produce spell + counter-on-creature-ETB triggered ability", () => {
    const override = getCardOverride("Pelt Collector")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger && trigger.type === "triggered") {
      expect(trigger.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(trigger.triggerCondition.filter!.cardTypes).toContain("Creature");
      expect(trigger.effects[0].type).toBe("custom");
    }
  });
});

describe("Steel Leaf Champion override", () => {
  it("should produce spell + evasion static", () => {
    const override = getCardOverride("Steel Leaf Champion")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const evasion = abilities.find((a) => a.type === "static");
    expect(evasion).toBeDefined();
    if (evasion && evasion.type === "static") {
      expect(evasion.continuousEffect.effectType).toBe("cantBeBlockedBy");
      expect(evasion.continuousEffect.modification).toEqual(
        expect.objectContaining({
          blockerFilter: { power: { op: "lte", value: 2 } },
        })
      );
    }
  });
});

describe("Burning-Tree Emissary override", () => {
  it("should produce spell + ETB mana trigger", () => {
    const override = getCardOverride("Burning-Tree Emissary")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const trigger = abilities.find((a) => a.type === "triggered");
    expect(trigger).toBeDefined();
    if (trigger && trigger.type === "triggered") {
      expect(trigger.triggerCondition.eventType).toBe("cardEnteredZone");
      expect(trigger.triggerCondition.self).toBe(true);
      expect(trigger.effects).toHaveLength(1);
      expect(trigger.effects[0].type).toBe("addMana");
      if (trigger.effects[0].type === "addMana") {
        expect(trigger.effects[0].mana.R).toBe(1);
        expect(trigger.effects[0].mana.G).toBe(1);
      }
    }
  });
});

describe("Gruul Spellbreaker override", () => {
  it("should produce spell + haste", () => {
    const override = getCardOverride("Gruul Spellbreaker")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const spell = abilities.find((a) => a.type === "spell");
    expect(spell).toBeDefined();

    const haste = abilities.find((a) => a.type === "static");
    expect(haste).toBeDefined();
    if (haste && haste.type === "static") {
      expect(haste.continuousEffect.effectType).toBe("haste");
    }
  });
});

// ===========================================================================
// Phase 5 Group B — Control staples
// ===========================================================================

describe("Essence Scatter override", () => {
  it("should counter a creature spell", () => {
    const override = getCardOverride("Essence Scatter")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const spell = getSpellAbility(abilities);
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("counter");
  });

  it("should target creature spells only", () => {
    const override = getCardOverride("Essence Scatter")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toEqual(["spell"]);
    expect(override.spellTargets[0].filter).not.toBeNull();
    expect(override.spellTargets[0].filter!.cardTypes).toContain("Creature");
  });
});

describe("Serum Visions override", () => {
  it("should draw 1 card for controller", () => {
    const override = getCardOverride("Serum Visions")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "drawCards");
    if (effect.type === "drawCards") {
      expect(effect.count).toBe(1);
      expect(effect.player).toEqual({ type: "controller" });
    }
  });

  it("should not require targets", () => {
    const override = getCardOverride("Serum Visions")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Fatal Push override", () => {
  it("should destroy a target creature", () => {
    const override = getCardOverride("Fatal Push")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "destroy");
    expect(effect.type).toBe("destroy");
  });

  it("should target creatures", () => {
    const override = getCardOverride("Fatal Push")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toEqual(["creature"]);
  });
});

describe("Inquisition of Kozilek override", () => {
  it("should force target player to discard 1 card", () => {
    const override = getCardOverride("Inquisition of Kozilek")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "discardCards");
    if (effect.type === "discardCards") {
      expect(effect.count).toBe(1);
      expect(effect.player.type).toBe("targetPlayer");
    }
  });

  it("should target a player", () => {
    const override = getCardOverride("Inquisition of Kozilek")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toEqual(["player"]);
  });
});

describe("Hero's Downfall override", () => {
  it("should destroy a target creature or planeswalker", () => {
    const override = getCardOverride("Hero's Downfall")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "destroy");
    expect(effect.type).toBe("destroy");
  });

  it("should target creatures and planeswalkers", () => {
    const override = getCardOverride("Hero's Downfall")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("planeswalker");
  });
});

describe("Wrath of God override", () => {
  it("should use custom destroy_all_creatures resolve", () => {
    const override = getCardOverride("Wrath of God")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("custom");
    if (spell.effects[0].type === "custom") {
      expect(spell.effects[0].resolveFunction).toBe("destroy_all_creatures");
    }
  });

  it("should not require targets (board wipe)", () => {
    const override = getCardOverride("Wrath of God")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Day of Judgment override", () => {
  it("should use custom destroy_all_creatures resolve (same as Wrath)", () => {
    const override = getCardOverride("Day of Judgment")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);
    expect(spell.effects[0].type).toBe("custom");
    if (spell.effects[0].type === "custom") {
      expect(spell.effects[0].resolveFunction).toBe("destroy_all_creatures");
    }
  });

  it("should not require targets (board wipe)", () => {
    const override = getCardOverride("Day of Judgment")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// ===========================================================================
// Group C: Midrange/utility staples
// ===========================================================================

describe("Siege Rhino override", () => {
  it("should produce a triggered ETB ability and a trample static", () => {
    const override = getCardOverride("Siege Rhino")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const triggered = abilities.find((a) => a.type === "triggered");
    expect(triggered).toBeDefined();
    expect(triggered!.id).toBe("siege_rhino_etb");

    const staticAb = abilities.find((a) => a.type === "static");
    expect(staticAb).toBeDefined();
    if (staticAb!.type === "static") {
      expect(staticAb!.continuousEffect.effectType).toBe("trample");
    }
  });

  it("should have loseLife and gainLife effects on ETB", () => {
    const override = getCardOverride("Siege Rhino")!;
    const triggered = override.getAbilities().find((a) => a.type === "triggered")!;
    expect(triggered.effects).toHaveLength(2);

    // "each opponent loses 3 life" can't be expressed with a single loseLife
    // (PlayerRef has no "eachOpponent" variant), so it uses a custom handler
    const eachOpponentEffect = triggered.effects.find((e) => e.type === "custom");
    expect(eachOpponentEffect).toBeDefined();

    const gainLife = triggered.effects.find((e) => e.type === "gainLife");
    expect(gainLife).toBeDefined();
    if (gainLife && gainLife.type === "gainLife") {
      expect(gainLife.amount).toBe(3);
      expect(gainLife.player).toEqual({ type: "controller" });
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Siege Rhino")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Assassin's Trophy override", () => {
  it("should produce a spell ability that destroys target permanent", () => {
    const override = getCardOverride("Assassin's Trophy")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const spell = getSpellAbility(abilities);
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "destroy");
    if (effect.type === "destroy") {
      expect(effect.target.targetRequirementId).toBe("at_t1");
    }
  });

  it("should target any permanent", () => {
    const override = getCardOverride("Assassin's Trophy")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("permanent");
    expect(override.spellTargets[0].controller).toBe("any");
  });
});

describe("Mind Stone override", () => {
  it("should produce a mana ability and an activated draw ability", () => {
    const override = getCardOverride("Mind Stone")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const mana = abilities.find((a) => a.type === "mana");
    expect(mana).toBeDefined();

    const activated = abilities.find((a) => a.type === "activated");
    expect(activated).toBeDefined();
  });

  it("should add {C} with the mana ability", () => {
    const override = getCardOverride("Mind Stone")!;
    const mana = getManaAbility(override.getAbilities());
    const effect = getEffect(mana, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.C).toBe(1);
      expect(effect.mana.W).toBe(0);
    }
    expect(mana.cost.tapSelf).toBe(true);
  });

  it("should require sacrifice + {1} + tap to draw a card", () => {
    const override = getCardOverride("Mind Stone")!;
    const activated = override.getAbilities().find((a) => a.type === "activated") as SpellAbilityActivated;
    expect(activated.cost.tapSelf).toBe(true);
    expect(activated.cost.sacrifice).toBeDefined();
    expect(activated.cost.sacrifice!.self).toBe(true);
    expect(activated.cost.manaCost!.totalCMC).toBe(1);

    const drawEffect = activated.effects.find((e) => e.type === "drawCards");
    expect(drawEffect).toBeDefined();
    if (drawEffect && drawEffect.type === "drawCards") {
      expect(drawEffect.count).toBe(1);
    }
  });
});

describe("Rampant Growth override", () => {
  it("should produce a spell ability that adds {G}", () => {
    const override = getCardOverride("Rampant Growth")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.G).toBe(1);
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Rampant Growth")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Cultivate override", () => {
  it("should produce a spell ability that adds {G}{G}", () => {
    const override = getCardOverride("Cultivate")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = getEffect(spell, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.G).toBe(2);
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Cultivate")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// ===========================================================================
// Group D: Cards using new effect types
// ===========================================================================

// --- Token creation cards ---

describe("Raise the Alarm override", () => {
  it("should create two 1/1 white Soldier tokens", () => {
    const override = getCardOverride("Raise the Alarm")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = spell.effects[0];
    expect(effect.type).toBe("createToken");
    if (effect.type === "createToken") {
      expect(effect.count).toBe(2);
      expect(effect.token.name).toBe("Soldier");
      expect(effect.token.colors).toEqual(["W"]);
      expect(effect.token.power).toBe(1);
      expect(effect.token.toughness).toBe(1);
      expect(effect.controller).toEqual({ type: "controller" });
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Raise the Alarm")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

describe("Dragon Fodder override", () => {
  it("should create two 1/1 red Goblin tokens", () => {
    const override = getCardOverride("Dragon Fodder")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());

    const effect = spell.effects[0];
    expect(effect.type).toBe("createToken");
    if (effect.type === "createToken") {
      expect(effect.count).toBe(2);
      expect(effect.token.name).toBe("Goblin");
      expect(effect.token.colors).toEqual(["R"]);
      expect(effect.token.power).toBe(1);
      expect(effect.token.toughness).toBe(1);
    }
  });
});

describe("Lingering Souls override", () => {
  it("should create two 1/1 white Spirit tokens with flying", () => {
    const override = getCardOverride("Lingering Souls")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());

    const effect = spell.effects[0];
    expect(effect.type).toBe("createToken");
    if (effect.type === "createToken") {
      expect(effect.count).toBe(2);
      expect(effect.token.name).toBe("Spirit");
      expect(effect.token.colors).toEqual(["W"]);
      expect(effect.token.keywords).toContain("Flying");
    }
  });

  it("should be castable from graveyard (flashback zone)", () => {
    const override = getCardOverride("Lingering Souls")!;
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.zones).toContain(ZoneType.Graveyard);
  });
});

describe("Spectral Procession override", () => {
  it("should create three 1/1 white Spirit tokens with flying", () => {
    const override = getCardOverride("Spectral Procession")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());

    const effect = spell.effects[0];
    expect(effect.type).toBe("createToken");
    if (effect.type === "createToken") {
      expect(effect.count).toBe(3);
      expect(effect.token.name).toBe("Spirit");
      expect(effect.token.keywords).toContain("Flying");
    }
  });
});

describe("Young Pyromancer override", () => {
  it("should create a 1/1 red Elemental token when an instant or sorcery is cast", () => {
    const override = getCardOverride("Young Pyromancer")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const triggered = abilities[0];
    expect(triggered.type).toBe("triggered");
    if (triggered.type === "triggered") {
      expect(triggered.triggerCondition.eventType).toBe("spellCast");
      expect(triggered.triggerCondition.filter).toEqual({ cardTypes: ["Instant", "Sorcery"] });
    }

    const effect = triggered.effects[0];
    expect(effect.type).toBe("createToken");
    if (effect.type === "createToken") {
      expect(effect.count).toBe(1);
      expect(effect.token.name).toBe("Elemental");
      expect(effect.token.colors).toEqual(["R"]);
    }
  });
});

// --- Sacrifice cards ---

describe("Sakura-Tribe Elder override", () => {
  it("should have a mana ability that sacrifices itself to add {G}", () => {
    const override = getCardOverride("Sakura-Tribe Elder")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const mana = getManaAbility(abilities);
    expect(mana.cost.sacrifice).toBeDefined();
    expect(mana.cost.sacrifice!.self).toBe(true);
    expect(mana.cost.tapSelf).toBe(false);

    const effect = getEffect(mana, "addMana");
    if (effect.type === "addMana") {
      expect(effect.mana.G).toBe(1);
    }
  });
});

describe("Village Rites override", () => {
  it("should sacrifice a creature and draw 2 cards", () => {
    const override = getCardOverride("Village Rites")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);

    const sacrifice = spell.effects.find((e) => e.type === "sacrifice");
    expect(sacrifice).toBeDefined();
    if (sacrifice && sacrifice.type === "sacrifice") {
      expect(sacrifice.count).toBe(1);
      expect(sacrifice.filter.cardTypes).toContain("Creature");
    }

    const draw = spell.effects.find((e) => e.type === "drawCards");
    expect(draw).toBeDefined();
    if (draw && draw.type === "drawCards") {
      expect(draw.count).toBe(2);
    }
  });
});

describe("Viscera Seer override", () => {
  it("should sacrifice a creature to draw a card (simplified scry)", () => {
    const override = getCardOverride("Viscera Seer")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const activated = abilities[0] as SpellAbilityActivated;
    expect(activated.type).toBe("activated");
    expect(activated.cost.sacrifice).toBeDefined();
    expect(activated.cost.sacrifice!.cardTypes).toContain("Creature");
    expect(activated.cost.tapSelf).toBe(false);

    const effect = getEffect(activated, "drawCards");
    if (effect.type === "drawCards") {
      expect(effect.count).toBe(1);
    }
  });
});

// --- Counter-based cards ---

describe("Walking Ballista override", () => {
  it("should enter with X +1/+1 counters via ETB trigger", () => {
    const override = getCardOverride("Walking Ballista")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(2);

    const triggered = abilities.find((a) => a.type === "triggered") as SpellAbilityTriggered;
    expect(triggered).toBeDefined();
    expect(triggered.triggerCondition.eventType).toBe("cardEnteredZone");
    expect(triggered.triggerCondition.self).toBe(true);

    const addCounters = triggered.effects[0];
    expect(addCounters.type).toBe("addCounters");
    if (addCounters.type === "addCounters") {
      expect(addCounters.counterType).toBe("+1/+1");
      expect(addCounters.count).toEqual({ variable: "X" });
    }
  });

  it("should have an activated ability to remove a +1/+1 counter and deal 1 damage", () => {
    const override = getCardOverride("Walking Ballista")!;
    const activated = override.getAbilities().find((a) => a.type === "activated") as SpellAbilityActivated;
    expect(activated).toBeDefined();
    expect(activated.cost.removeCounters).toEqual({ counterType: "+1/+1", count: 1 });

    const damage = activated.effects[0];
    expect(damage.type).toBe("dealDamage");
    if (damage.type === "dealDamage") {
      expect(damage.amount).toBe(1);
    }
  });

  it("should have target requirements for the ping ability", () => {
    const override = getCardOverride("Walking Ballista")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});

describe("Luminarch Aspirant override", () => {
  it("should put a +1/+1 counter on target creature you control at beginning of combat", () => {
    const override = getCardOverride("Luminarch Aspirant")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const triggered = abilities[0] as SpellAbilityTriggered;
    expect(triggered.type).toBe("triggered");
    expect(triggered.triggerCondition.eventType).toBe("phaseChanged");

    const effect = triggered.effects[0];
    expect(effect.type).toBe("addCounters");
    if (effect.type === "addCounters") {
      expect(effect.counterType).toBe("+1/+1");
      expect(effect.count).toBe(1);
    }
  });

  it("should target a creature you control", () => {
    const override = getCardOverride("Luminarch Aspirant")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].controller).toBe("you");
    expect(override.spellTargets[0].targetTypes).toContain("creature");
  });
});

describe("Champion of the Parish override", () => {
  it("should put a +1/+1 counter on itself when another Human enters", () => {
    const override = getCardOverride("Champion of the Parish")!;
    expect(override).toBeDefined();
    const abilities = override.getAbilities();
    expect(abilities).toHaveLength(1);

    const triggered = abilities[0] as SpellAbilityTriggered;
    expect(triggered.type).toBe("triggered");
    expect(triggered.triggerCondition.eventType).toBe("cardEnteredZone");
    expect(triggered.triggerCondition.filter).toEqual({ subtypes: ["Human"] });
    expect(triggered.triggerCondition.self).toBe(false);

    const effect = triggered.effects[0];
    expect(effect.type).toBe("addCounters");
    if (effect.type === "addCounters") {
      expect(effect.counterType).toBe("+1/+1");
      expect(effect.count).toBe(1);
      expect(effect.target.targetRequirementId).toBe("self");
    }
  });

  it("should not require external targets", () => {
    const override = getCardOverride("Champion of the Parish")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// --- X spell cards ---

describe("Fireball override", () => {
  it("should deal X damage to any target", () => {
    const override = getCardOverride("Fireball")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(1);

    const effect = spell.effects[0];
    expect(effect.type).toBe("dealDamage");
    if (effect.type === "dealDamage") {
      expect(effect.amount).toEqual({ variable: "X" });
      expect(effect.to.targetRequirementId).toBe("fireball_t1");
    }
  });

  it("should target any target (creature, planeswalker, player)", () => {
    const override = getCardOverride("Fireball")!;
    expect(override.spellTargets).toHaveLength(1);
    expect(override.spellTargets[0].targetTypes).toContain("creature");
    expect(override.spellTargets[0].targetTypes).toContain("planeswalker");
    expect(override.spellTargets[0].targetTypes).toContain("player");
  });
});

describe("Sphinx's Revelation override", () => {
  it("should gain X life and draw X cards", () => {
    const override = getCardOverride("Sphinx's Revelation")!;
    expect(override).toBeDefined();
    const spell = getSpellAbility(override.getAbilities());
    expect(spell.effects).toHaveLength(2);

    const gainLife = spell.effects.find((e) => e.type === "gainLife");
    expect(gainLife).toBeDefined();
    if (gainLife && gainLife.type === "gainLife") {
      expect(gainLife.amount).toEqual({ variable: "X" });
      expect(gainLife.player).toEqual({ type: "controller" });
    }

    const drawCards = spell.effects.find((e) => e.type === "drawCards");
    expect(drawCards).toBeDefined();
    if (drawCards && drawCards.type === "drawCards") {
      expect(drawCards.count).toEqual({ variable: "X" });
      expect(drawCards.player).toEqual({ type: "controller" });
    }
  });

  it("should not require any targets", () => {
    const override = getCardOverride("Sphinx's Revelation")!;
    expect(override.spellTargets).toHaveLength(0);
  });
});

// ===========================================================================
// Override count validation
// ===========================================================================

describe("override registry — overall count", () => {
  it("should have at least 81 overrides (previous 46 + 17 standard-instants + 10 aggro + 7 control + 5 midrange + 13 new-effect)", () => {
    const names = getOverrideNames();
    expect(names.length).toBeGreaterThanOrEqual(81);
  });
});

// ---------------------------------------------------------------------------
// General validation for all overrides
// ---------------------------------------------------------------------------

describe("all overrides produce valid SpellAbility arrays", () => {
  const allOverrideNames = getOverrideNames();

  for (const name of allOverrideNames) {
    it(`${name} should return a non-empty SpellAbility array`, () => {
      const override = getCardOverride(name)!;
      const abilities = override.getAbilities();
      expect(Array.isArray(abilities)).toBe(true);
      expect(abilities.length).toBeGreaterThan(0);
    });

    it(`${name} should have abilities with valid type discriminants`, () => {
      const override = getCardOverride(name)!;
      const abilities = override.getAbilities();
      for (const ability of abilities) {
        expect(["spell", "activated", "triggered", "static", "mana"]).toContain(ability.type);
      }
    });

    it(`${name} should have abilities with non-empty id`, () => {
      const override = getCardOverride(name)!;
      const abilities = override.getAbilities();
      for (const ability of abilities) {
        expect(ability.id).toBeTruthy();
        expect(typeof ability.id).toBe("string");
      }
    });

    it(`${name} should have abilities with effects or continuousEffect`, () => {
      const override = getCardOverride(name)!;
      const abilities = override.getAbilities();
      for (const ability of abilities) {
        // Static abilities may have empty effects but must have continuousEffect
        if (ability.type === "static") {
          expect(ability.continuousEffect).toBeDefined();
        } else if (ability.type === "spell") {
          // Spell abilities for creatures may have empty effects (the "effect"
          // is placing the permanent on the battlefield, handled by the engine)
          // Spell abilities for instants/sorceries should have effects
          // We allow both cases here
        } else {
          expect(ability.effects.length).toBeGreaterThan(0);
        }
      }
    });

    it(`${name} should have abilities with non-empty zones`, () => {
      const override = getCardOverride(name)!;
      const abilities = override.getAbilities();
      for (const ability of abilities) {
        expect(ability.zones.length).toBeGreaterThan(0);
      }
    });
  }
});
