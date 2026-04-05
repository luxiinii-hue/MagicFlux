/**
 * Final sprint overrides — ~45 new cards to reach 200+ total.
 *
 * Grouped: removal/interaction, creatures (keyword + ETB), enchantments/artifacts,
 * instants/sorceries, and a handful of extra staples to hit the target.
 */

import type {
  SpellAbility,
  SpellAbilityStatic,
  SpellAbilityTriggered,
  SpellAbilityActivated,
  TargetRequirement,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function spellAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/[',\s-]+/g, "_");
  return {
    type: "spell",
    id: `${slug}_spell`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
  };
}

function flashSpellAbility(cardName: string): SpellAbility {
  const slug = cardName.toLowerCase().replace(/[',\s-]+/g, "_");
  return {
    type: "spell",
    id: `${slug}_spell`,
    sourceCardInstanceId: null,
    effects: [],
    zones: [ZoneType.Hand, ZoneType.Stack],
  };
}

function keywordStatic(cardName: string, keyword: string): SpellAbilityStatic {
  const slug = cardName.toLowerCase().replace(/[',\s-]+/g, "_");
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

// ===========================================================================
// REMOVAL / INTERACTION (~9 cards)
// ===========================================================================

// --- Go for the Throat: {1}{B} instant. Destroy target nonartifact creature ---
export function goForTheThroatOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "gftt_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "gftt_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const goForTheThroatTargets: TargetRequirement[] = [{
  id: "gftt_t1", description: "target nonartifact creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Condemn: {W} instant. Put target attacking creature on the bottom of its owner's library ---
export function condemnOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "condemn_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "condemn_bottom_library" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const condemnTargets: TargetRequirement[] = [{
  id: "condemn_t1", description: "target attacking creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Anguished Unmaking: {1}{W}{B} instant. Exile target nonland permanent. You lose 3 life ---
export function anguishedUnmakingOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "au_spell", sourceCardInstanceId: null,
    effects: [
      { type: "exile", target: { targetRequirementId: "au_t1" } },
      { type: "loseLife", amount: 3, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const anguishedUnmakingTargets: TargetRequirement[] = [{
  id: "au_t1", description: "target nonland permanent", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: { cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"] }, controller: "any",
}];

// --- Dreadbore: {B}{R} sorcery. Destroy target creature or planeswalker ---
export function dreadboreOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "dreadbore_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "dread_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const dreadboreTargets: TargetRequirement[] = [{
  id: "dread_t1", description: "target creature or planeswalker", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker"], filter: null, controller: "any",
}];

// --- Kolaghan's Command: {1}{B}{R} instant. Choose two (simplified: deal 2 to any target + return creature from graveyard to hand) ---
export function kolaghansCommandOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "kcmd_spell", sourceCardInstanceId: null,
    effects: [
      { type: "dealDamage", amount: 2, to: { targetRequirementId: "kcmd_t1" } },
      { type: "custom", resolveFunction: "kolaghans_command_return" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const kolaghansCommandTargets: TargetRequirement[] = [{
  id: "kcmd_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Electrolyze: {1}{U}{R} instant. Deal 2 damage to any target. Draw a card ---
export function electrolyzeOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "electrolyze_spell", sourceCardInstanceId: null,
    effects: [
      { type: "dealDamage", amount: 2, to: { targetRequirementId: "elec_t1" } },
      { type: "drawCards", count: 1, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const electrolyzeTargets: TargetRequirement[] = [{
  id: "elec_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Izzet Charm: {U}{R} instant. Choose one (simplified: counter target noncreature spell) ---
export function izzetCharmOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "izzet_charm_spell", sourceCardInstanceId: null,
    effects: [{ type: "counter", target: { targetRequirementId: "ic_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const izzetCharmTargets: TargetRequirement[] = [{
  id: "ic_t1", description: "target noncreature spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: { cardTypes: ["Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker"] }, controller: "any",
}];

// --- Lightning Strike: {1}{R} instant. Deal 3 damage to any target ---
export function lightningStrikeOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "lstrike_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "lstrike_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const lightningStrikeTargets: TargetRequirement[] = [{
  id: "lstrike_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Char: {2}{R} instant. Deal 4 damage to any target. Deal 2 damage to you ---
export function charOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "char_spell", sourceCardInstanceId: null,
    effects: [
      { type: "dealDamage", amount: 4, to: { targetRequirementId: "char_t1" } },
      { type: "loseLife", amount: 2, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const charTargets: TargetRequirement[] = [{
  id: "char_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// ===========================================================================
// CREATURES (~12 cards)
// ===========================================================================

// --- Vendilion Clique: 3/1 flash flying {1}{U}{U}. ETB: look at target player's hand, exile a nonland card, they draw ---
export function vendilionCliqueOverride(): SpellAbility[] {
  return [
    flashSpellAbility("Vendilion Clique"),
    keywordStatic("Vendilion Clique", "flying"),
    {
      type: "triggered", id: "clique_etb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "vendilion_clique_hand" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: true, interveningIf: null },
      targets: [{ id: "clique_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "any" }],
    } as SpellAbilityTriggered,
  ];
}

// --- Spell Queller: 2/3 flash flying {1}{W}{U}. ETB: exile target spell with CMC 4 or less ---
export function spellQuellerOverride(): SpellAbility[] {
  return [
    flashSpellAbility("Spell Queller"),
    keywordStatic("Spell Queller", "flying"),
    {
      type: "triggered", id: "squeller_etb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "spell_queller_exile" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [{ id: "squeller_t1", description: "target spell with mana value 4 or less", count: { exactly: 1 }, targetTypes: ["spell"], filter: { cmc: { op: "lte", value: 4 } }, controller: "any" }],
    } as SpellAbilityTriggered,
    {
      type: "triggered", id: "squeller_ltb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "spell_queller_return" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardLeftZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// --- Reflector Mage: 2/3 {1}{W}{U}. ETB: return target creature an opponent controls to hand ---
export function reflectorMageOverride(): SpellAbility[] {
  return [
    spellAbility("Reflector Mage"),
    {
      type: "triggered", id: "reflector_etb", sourceCardInstanceId: null,
      effects: [{ type: "bounce", target: { targetRequirementId: "reflector_t1" }, to: ZoneType.Hand }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [{ id: "reflector_t1", description: "target creature an opponent controls", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "opponent" }],
    } as SpellAbilityTriggered,
  ];
}
export const reflectorMageTargets: TargetRequirement[] = [{
  id: "reflector_t1", description: "target creature an opponent controls", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "opponent",
}];

// --- Thought-Knot Seer: 4/4 {3}{C}. ETB: target opponent exiles a card from hand ---
export function thoughtKnotSeerOverride(): SpellAbility[] {
  return [
    spellAbility("Thought-Knot Seer"),
    {
      type: "triggered", id: "tks_etb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "thought_knot_seer_exile" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [{ id: "tks_t1", description: "target opponent", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "opponent" }],
    } as SpellAbilityTriggered,
    {
      type: "triggered", id: "tks_ltb", sourceCardInstanceId: null,
      effects: [{ type: "drawCards", count: 1, player: { type: "targetPlayer", targetRef: { targetRequirementId: "tks_t1" } } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardLeftZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// --- Gurmag Angler: 5/5 {6}{B} (delve simplified — just a big vanilla creature) ---
export function gurmagAnglerOverride(): SpellAbility[] {
  return [spellAbility("Gurmag Angler")];
}

// --- Tasigur, the Golden Fang: 4/5 {5}{B} (simplified vanilla) ---
export function tasigurOverride(): SpellAbility[] {
  return [spellAbility("Tasigur, the Golden Fang")];
}

// --- Kalitas, Traitor of Ghet: 3/4 lifelink {2}{B}{B} ---
export function kalitasOverride(): SpellAbility[] {
  return [
    spellAbility("Kalitas, Traitor of Ghet"),
    keywordStatic("Kalitas, Traitor of Ghet", "lifelink"),
  ];
}

// --- Glorybringer: 4/4 flying haste {3}{R}{R} ---
export function glorybringerOverride(): SpellAbility[] {
  return [
    spellAbility("Glorybringer"),
    keywordStatic("Glorybringer", "flying"),
    keywordStatic("Glorybringer", "haste"),
  ];
}

// --- Rekindling Phoenix: 4/3 flying {2}{R}{R} (simplified — just flying creature) ---
export function rekindlingPhoenixOverride(): SpellAbility[] {
  return [
    spellAbility("Rekindling Phoenix"),
    keywordStatic("Rekindling Phoenix", "flying"),
  ];
}

// --- Questing Beast: 4/4 vigilance deathtouch haste {2}{G}{G} ---
export function questingBeastOverride(): SpellAbility[] {
  return [
    spellAbility("Questing Beast"),
    keywordStatic("Questing Beast", "vigilance"),
    keywordStatic("Questing Beast", "deathtouch"),
    keywordStatic("Questing Beast", "haste"),
  ];
}

// --- Polukranos, World Eater: 5/5 {2}{G}{G} (vanilla — monstrosity simplified away) ---
export function polukranosOverride(): SpellAbility[] {
  return [spellAbility("Polukranos, World Eater")];
}

// --- Knight of Autumn: 2/1 {1}{G}{W}. ETB: gain 4 life (simplified mode) ---
export function knightOfAutumnOverride(): SpellAbility[] {
  return [
    spellAbility("Knight of Autumn"),
    {
      type: "triggered", id: "koa_etb", sourceCardInstanceId: null,
      effects: [{ type: "gainLife", amount: 4, player: { type: "controller" } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// ===========================================================================
// ENCHANTMENTS / ARTIFACTS (~7 cards)
// ===========================================================================

// --- Rest in Peace: {1}{W} enchantment. Replacement: cards going to graveyard are exiled instead ---
export function restInPeaceOverride(): SpellAbility[] {
  return [
    {
      type: "static", id: "rip_replacement", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "replacementEffect", affectedFilter: {}, modification: { replacement: "exile_instead_of_graveyard" } },
      condition: null, layer: 1,
    },
    {
      type: "triggered", id: "rip_etb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "rest_in_peace_exile_all" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// --- Leyline of the Void: {2}{B}{B} enchantment. Opponent cards going to graveyard are exiled ---
export function leylineOfTheVoidOverride(): SpellAbility[] {
  return [{
    type: "static", id: "leyline_replacement", sourceCardInstanceId: null, effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: { effectType: "replacementEffect", affectedFilter: { custom: "opponent_cards" }, modification: { replacement: "exile_instead_of_graveyard" } },
    condition: null, layer: 1,
  }];
}

// --- Chalice of the Void: {X}{X} artifact. Enters with X charge counters ---
export function chaliceOfTheVoidOverride(): SpellAbility[] {
  return [
    {
      type: "triggered", id: "chalice_etb", sourceCardInstanceId: null,
      effects: [{ type: "addCounters", counterType: "charge", count: { variable: "X" }, target: { targetRequirementId: "self" } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
    {
      type: "triggered", id: "chalice_counter", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "chalice_counter_spell" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "spellCast", filter: null, self: false, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
  ];
}

// --- Pithing Needle: {1} artifact. Named card's activated abilities can't be activated (simplified: static ability marker) ---
export function pithingNeedleOverride(): SpellAbility[] {
  return [{
    type: "static", id: "needle_lock", sourceCardInstanceId: null, effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: { effectType: "restriction", affectedFilter: { custom: "named_card" }, modification: { restriction: "no_activated_abilities" } },
    condition: null, layer: 6,
  }];
}

// --- Grafdigger's Cage: {1} artifact. Creatures can't enter from graveyards or libraries ---
export function grafdiggersCageOverride(): SpellAbility[] {
  return [{
    type: "static", id: "cage_restriction", sourceCardInstanceId: null, effects: [],
    zones: [ZoneType.Battlefield],
    continuousEffect: { effectType: "restriction", affectedFilter: { cardTypes: ["Creature"] }, modification: { restriction: "no_enter_from_graveyard_or_library" } },
    condition: null, layer: 6,
  }];
}

// --- Tormod's Crypt: {0} artifact. {T}, Sacrifice: Exile all cards from target player's graveyard ---
export function tormodsCryptOverride(): SpellAbility[] {
  return [{
    type: "activated", id: "crypt_exile", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "tormods_crypt_exile" }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null, tapSelf: true, untapSelf: false,
      sacrifice: { self: true, description: "Sacrifice Tormod's Crypt" },
      discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [],
    },
    timing: "instant",
    targets: [{ id: "crypt_t1", description: "target player", count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: "any" }],
    activationRestrictions: [],
  } as SpellAbilityActivated];
}
export const tormodsCryptTargets: TargetRequirement[] = [{
  id: "crypt_t1", description: "target player", count: { exactly: 1 },
  targetTypes: ["player"], filter: null, controller: "any",
}];

// --- Relic of Progenitus: {1} artifact. Activated: exile target card from graveyard. Second activated: exile all graveyards, draw a card ---
export function relicOfProgenitusOverride(): SpellAbility[] {
  return [
    {
      type: "activated", id: "relic_exile_one", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "relic_exile_card" }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: null, tapSelf: true, untapSelf: false,
        sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [],
      },
      timing: "instant",
      targets: [{ id: "relic_t1", description: "target card in a graveyard", count: { exactly: 1 }, targetTypes: ["card-in-graveyard"], filter: null, controller: "any" }],
      activationRestrictions: [],
    } as SpellAbilityActivated,
    {
      type: "activated", id: "relic_exile_all", sourceCardInstanceId: null,
      effects: [
        { type: "custom", resolveFunction: "relic_exile_all_graveyards" },
        { type: "drawCards", count: 1, player: { type: "controller" } },
      ],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 },
        tapSelf: false, untapSelf: false,
        sacrifice: null, discard: null, payLife: null, exileSelf: true, exileFromGraveyard: null, removeCounters: null, additionalCosts: [],
      },
      timing: "instant",
      targets: [],
      activationRestrictions: [],
    } as SpellAbilityActivated,
  ];
}

// ===========================================================================
// INSTANTS / SORCERIES (~4 cards)
// ===========================================================================

// --- Abzan Charm: {W}{B}{G} instant. Choose one (simplified: draw 2 cards, lose 2 life) ---
export function abzanCharmOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "abzan_charm_spell", sourceCardInstanceId: null,
    effects: [
      { type: "drawCards", count: 2, player: { type: "controller" } },
      { type: "loseLife", amount: 2, player: { type: "controller" } },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Dromoka's Command: {G}{W} instant. Choose two (simplified: put a +1/+1 counter on target creature) ---
export function dromokasCommandOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "dromoka_cmd_spell", sourceCardInstanceId: null,
    effects: [{ type: "addCounters", counterType: "+1/+1", count: 1, target: { targetRequirementId: "dromoka_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const dromokasCommandTargets: TargetRequirement[] = [{
  id: "dromoka_t1", description: "target creature", count: { exactly: 1 },
  targetTypes: ["creature"], filter: null, controller: "any",
}];

// --- Unburial Rites: {4}{B} sorcery. Return target creature card from graveyard to battlefield. Flashback {3}{W} ---
export function unburialRitesOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "unburial_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "unburial_rites_reanimate" }],
    zones: [ZoneType.Hand, ZoneType.Stack, ZoneType.Graveyard],
  }];
}
export const unburialRitesTargets: TargetRequirement[] = [{
  id: "unburial_t1", description: "target creature card in a graveyard", count: { exactly: 1 },
  targetTypes: ["card-in-graveyard"], filter: { cardTypes: ["Creature"] }, controller: "any",
}];

// --- Traverse the Ulvenwald: {G} sorcery. Search for a basic land (simplified: add {G}) ---
export function traverseTheUlvenwaldOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "traverse_spell", sourceCardInstanceId: null,
    effects: [{ type: "addMana", mana: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 }, player: { type: "controller" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// ===========================================================================
// EXTRA STAPLES TO HIT 200 (~13 cards)
// ===========================================================================

// --- Settle the Wreckage: {2}{W}{W} instant. Exile all attacking creatures. Their controller searches for basics ---
export function settleTheWreckageOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "settle_spell", sourceCardInstanceId: null,
    effects: [{ type: "custom", resolveFunction: "settle_the_wreckage" }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}

// --- Council's Judgment: {1}{W}{W} sorcery. Exile target nonland permanent ---
export function councilsJudgmentOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "cj_spell", sourceCardInstanceId: null,
    effects: [{ type: "exile", target: { targetRequirementId: "cj_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const councilsJudgmentTargets: TargetRequirement[] = [{
  id: "cj_t1", description: "target nonland permanent", count: { exactly: 1 },
  targetTypes: ["permanent"], filter: { cardTypes: ["Creature", "Artifact", "Enchantment", "Planeswalker"] }, controller: "any",
}];

// --- Spell Snare: {U} instant. Counter target spell with mana value 2 ---
export function spellSnareOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "snare_spell", sourceCardInstanceId: null,
    effects: [{ type: "counter", target: { targetRequirementId: "snare_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const spellSnareTargets: TargetRequirement[] = [{
  id: "snare_t1", description: "target spell with mana value 2", count: { exactly: 1 },
  targetTypes: ["spell"], filter: { cmc: { op: "eq", value: 2 } }, controller: "any",
}];

// --- Dissolve: {1}{U}{U} instant. Counter target spell. Scry 1 ---
export function dissolveOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "dissolve_spell", sourceCardInstanceId: null,
    effects: [
      { type: "counter", target: { targetRequirementId: "dissolve_t1" } },
      { type: "custom", resolveFunction: "scry_1" },
    ],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const dissolveTargets: TargetRequirement[] = [{
  id: "dissolve_t1", description: "target spell", count: { exactly: 1 },
  targetTypes: ["spell"], filter: null, controller: "any",
}];

// --- Bone Shards: {B} sorcery. As additional cost, discard a card or sacrifice a creature. Destroy target creature or planeswalker ---
export function boneShardsOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "bone_shards_spell", sourceCardInstanceId: null,
    effects: [{ type: "destroy", target: { targetRequirementId: "bs_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const boneShardsTargets: TargetRequirement[] = [{
  id: "bs_t1", description: "target creature or planeswalker", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker"], filter: null, controller: "any",
}];

// --- Searing Spear: {1}{R} instant. Deal 3 damage to any target ---
export function searingSpearOverride(): SpellAbility[] {
  return [{
    type: "spell", id: "searing_spear_spell", sourceCardInstanceId: null,
    effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "sspear_t1" } }],
    zones: [ZoneType.Hand, ZoneType.Stack],
  }];
}
export const searingSpearTargets: TargetRequirement[] = [{
  id: "sspear_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];

// --- Skullclamp: {1} artifact equipment. Equipped creature gets +1/-1. When equipped creature dies, draw 2 cards ---
export function skullclampOverride(): SpellAbility[] {
  return [
    {
      type: "static", id: "skullclamp_buff", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "modifyPT", affectedFilter: { self: false, custom: "equipped_creature" }, modification: { power: 1, toughness: -1 } },
      condition: null, layer: 7,
    },
    {
      type: "triggered", id: "skullclamp_draw", sourceCardInstanceId: null,
      effects: [{ type: "drawCards", count: 2, player: { type: "controller" } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardDestroyed", filter: null, self: false, optional: false, interveningIf: null },
      targets: [],
    } as SpellAbilityTriggered,
    {
      type: "activated", id: "skullclamp_equip", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "equip_attach" }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: { symbols: [{ type: "generic", amount: 1 }], totalCMC: 1 },
        tapSelf: false, untapSelf: false, sacrifice: null, discard: null, payLife: null, exileSelf: false, exileFromGraveyard: null, removeCounters: null, additionalCosts: [],
      },
      timing: "sorcery",
      targets: [{ id: "skullclamp_eq_t1", description: "target creature you control", count: { exactly: 1 }, targetTypes: ["creature"], filter: null, controller: "you" }],
      activationRestrictions: ["Equip only as a sorcery"],
    } as SpellAbilityActivated,
  ];
}

// --- Thrun, the Last Troll: {2}{G}{G} 4/4 (simplified: just a vanilla beater) ---
export function thrunOverride(): SpellAbility[] {
  return [spellAbility("Thrun, the Last Troll")];
}

// --- Fleecemane Lion: {G}{W} 3/3 (simplified vanilla — monstrosity simplified away) ---
export function fleecemaneLionOverride(): SpellAbility[] {
  return [spellAbility("Fleecemane Lion")];
}

// --- Dragonlord Ojutai: {3}{W}{U} 5/4 flying ---
export function dragonlordOjutaiOverride(): SpellAbility[] {
  return [
    spellAbility("Dragonlord Ojutai"),
    keywordStatic("Dragonlord Ojutai", "flying"),
  ];
}

// --- Mantis Rider: {U}{R}{W} 3/3 flying, vigilance, haste ---
export function mantisRiderOverride(): SpellAbility[] {
  return [
    spellAbility("Mantis Rider"),
    keywordStatic("Mantis Rider", "flying"),
    keywordStatic("Mantis Rider", "vigilance"),
    keywordStatic("Mantis Rider", "haste"),
  ];
}

// --- Anafenza, the Foremost: {W}{B}{G} 4/4 (simplified: vanilla creature) ---
export function anafenzaOverride(): SpellAbility[] {
  return [spellAbility("Anafenza, the Foremost")];
}

// --- Grim Lavamancer: {R} 1/1. {T}, Exile two cards from your graveyard: Deal 2 damage to any target ---
export function grimLavamancerOverride(): SpellAbility[] {
  return [
    spellAbility("Grim Lavamancer"),
    {
      type: "activated", id: "lavamancer_ping", sourceCardInstanceId: null,
      effects: [{ type: "dealDamage", amount: 2, to: { targetRequirementId: "lav_t1" } }],
      zones: [ZoneType.Battlefield],
      cost: {
        manaCost: null, tapSelf: true, untapSelf: false,
        sacrifice: null, discard: null, payLife: null, exileSelf: false,
        exileFromGraveyard: { count: 2, filter: null },
        removeCounters: null, additionalCosts: [],
      },
      timing: "instant",
      targets: [{ id: "lav_t1", description: "any target", count: { exactly: 1 }, targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any" }],
      activationRestrictions: [],
    } as SpellAbilityActivated,
  ];
}
export const grimLavamancerTargets: TargetRequirement[] = [{
  id: "lav_t1", description: "any target", count: { exactly: 1 },
  targetTypes: ["creature", "planeswalker", "player"], filter: null, controller: "any",
}];
