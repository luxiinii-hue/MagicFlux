import { describe, it, expect } from "vitest";
import type { SpellAbility, SpellAbilitySpell, SpellAbilityMana, Effect } from "@magic-flux/types";
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
// Override count validation
// ===========================================================================

describe("override registry — Phase 3 count", () => {
  it("should have at least 46 overrides (15 Phase 2 + 5 lands + 5 Phase 3 creatures + 10 keyword creatures + 4 enchantment/artifact + 20 new Phase 3 creatures + Bonesplitter)", () => {
    const names = getOverrideNames();
    expect(names.length).toBeGreaterThanOrEqual(46);
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
