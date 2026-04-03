/**
 * Keyword creature overrides — creatures whose abilities are fully
 * described by a spell ability plus keyword static abilities (and
 * optionally mana abilities).
 *
 * Each override produces:
 * - A "spell" ability for casting
 * - Static abilities for each keyword (with effectType matching the
 *   keyword name lowercase, so the engine's cardHasKeyword() finds them)
 * - Mana abilities where applicable
 */

import type { SpellAbility, SpellAbilityStatic } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function spellAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/\s+/g, "_");
  return {
    type: "spell",
    id: `${slug}_spell`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
  };
}

function keywordStatic(cardName: string, keyword: string): SpellAbilityStatic {
  const slug = cardName.toLowerCase().replace(/\s+/g, "_");
  const kwSlug = keyword.toLowerCase().replace(/\s+/g, "_");
  return {
    type: "static",
    id: `${slug}_${kwSlug}`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: {
      effectType: keyword.toLowerCase(),
      affectedFilter: {},
      modification: {},
    },
    condition: null,
    layer: 6,
  };
}

function greenManaAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/\s+/g, "_");
  return {
    type: "mana",
    id: `${slug}_mana`,
    sourceCardInstanceId: null,
    effects: [{
      type: "addMana",
      mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
      player: { type: "controller" },
    }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
      tapSelf: true,
      untapSelf: false,
      sacrifice: null,
      discard: null,
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Grizzly Bears — {1}{G} 2/2, no abilities
// ---------------------------------------------------------------------------

export function grizzlyBearsOverride(): SpellAbility[] {
  return [spellAbility("Grizzly Bears")];
}

// ---------------------------------------------------------------------------
// Serra Angel — {3}{W}{W} 4/4, Flying, Vigilance
// ---------------------------------------------------------------------------

export function serraAngelOverride(): SpellAbility[] {
  return [
    spellAbility("Serra Angel"),
    keywordStatic("Serra Angel", "flying"),
    keywordStatic("Serra Angel", "vigilance"),
  ];
}

// ---------------------------------------------------------------------------
// Llanowar Elves — {G} 1/1, {T}: Add {G}
// (replaces the previous override in creatures-vanilla.ts which only
//  had the mana ability — now also includes the spell ability)
// ---------------------------------------------------------------------------

export function llanowarElvesKeywordOverride(): SpellAbility[] {
  return [
    spellAbility("Llanowar Elves"),
    greenManaAbility("Llanowar Elves"),
  ];
}

// ---------------------------------------------------------------------------
// Goblin Guide — {R} 2/2, Haste
// (replaces the previous override in creatures-vanilla.ts which only
//  had the attack trigger — now includes spell + haste + trigger)
// ---------------------------------------------------------------------------

export function goblinGuideKeywordOverride(): SpellAbility[] {
  return [
    spellAbility("Goblin Guide"),
    keywordStatic("Goblin Guide", "haste"),
    {
      type: "triggered",
      id: "goblin_guide_attack",
      sourceCardInstanceId: null,
      effects: [{
        type: "custom",
        resolveFunction: "goblin_guide_reveal",
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "attackersDeclared",
        filter: null,
        self: true,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Giant Spider — {1}{G}{G} 2/4, Reach
// ---------------------------------------------------------------------------

export function giantSpiderOverride(): SpellAbility[] {
  return [
    spellAbility("Giant Spider"),
    keywordStatic("Giant Spider", "reach"),
  ];
}

// ---------------------------------------------------------------------------
// Air Elemental — {3}{U}{U} 4/4, Flying
// ---------------------------------------------------------------------------

export function airElementalOverride(): SpellAbility[] {
  return [
    spellAbility("Air Elemental"),
    keywordStatic("Air Elemental", "flying"),
  ];
}

// ---------------------------------------------------------------------------
// Vampire Nighthawk — {1}{B}{B} 2/3, Flying, Deathtouch, Lifelink
// ---------------------------------------------------------------------------

export function vampireNighthawkOverride(): SpellAbility[] {
  return [
    spellAbility("Vampire Nighthawk"),
    keywordStatic("Vampire Nighthawk", "flying"),
    keywordStatic("Vampire Nighthawk", "deathtouch"),
    keywordStatic("Vampire Nighthawk", "lifelink"),
  ];
}

// ---------------------------------------------------------------------------
// Monastery Swiftspear — {R} 1/2, Haste, Prowess
// ---------------------------------------------------------------------------

export function monasterySwiftspearOverride(): SpellAbility[] {
  return [
    spellAbility("Monastery Swiftspear"),
    keywordStatic("Monastery Swiftspear", "haste"),
    {
      type: "triggered",
      id: "monastery_swiftspear_prowess",
      sourceCardInstanceId: null,
      effects: [{
        type: "modifyPT",
        power: 1,
        toughness: 1,
        target: { targetRequirementId: "self" },
        duration: "endOfTurn",
      }],
      zones: [ZoneType.Battlefield],
      triggerCondition: {
        eventType: "spellCast",
        filter: {
          cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"],
        },
        self: false,
        optional: false,
        interveningIf: null,
      },
      targets: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Savannah Lions — {W} 2/1, no abilities
// ---------------------------------------------------------------------------

export function savannahLionsOverride(): SpellAbility[] {
  return [spellAbility("Savannah Lions")];
}

// ---------------------------------------------------------------------------
// Elvish Mystic — {G} 1/1, {T}: Add {G}
// ---------------------------------------------------------------------------

export function elvishMysticOverride(): SpellAbility[] {
  return [
    spellAbility("Elvish Mystic"),
    greenManaAbility("Elvish Mystic"),
  ];
}
