/**
 * Oracle text parser v2.
 *
 * Converts common oracle text patterns into structured SpellAbility objects.
 * Target: 50%+ of card templates handled automatically.
 *
 * Supported triggers:
 * - "When ~ enters the battlefield, [effect]" (ETB)
 * - "When ~ dies, [effect]" (dies trigger)
 * - "When ~ leaves the battlefield, [effect]" (LTB)
 * - "Whenever ~ attacks, [effect]"
 * - "Whenever ~ blocks, [effect]"
 * - "Whenever ~ deals combat damage to a player, [effect]"
 * - "Whenever you cast a [type] spell, [effect]"
 * - "At the beginning of your upkeep/end step, [effect]"
 *
 * Supported activated abilities:
 * - "{T}: Add {M}" (mana ability)
 * - "{T}: Add one mana of any color"
 * - "{Cost}: [Effect]"
 * - "{Cost}, {T}: [Effect]"
 * - "{Cost}, Sacrifice ~: [Effect]"
 * - "Cycling {Cost}"
 *
 * Supported effect patterns:
 * - "deals N damage to [target]"
 * - "destroy target [type]"
 * - "exile target [type]"
 * - "return target [type] to its owner's hand"
 * - "draw N cards" / "you draw a card"
 * - "target player draws/discards N cards"
 * - "you gain N life" / "target player gains N life"
 * - "each opponent loses N life"
 * - "target [type] gets +N/+N until end of turn"
 * - "target creature gains [keyword] until end of turn"
 * - "put N +1/+1 counters on target [type]"
 * - "create N N/N [color] [type] creature token"
 * - "tap/untap target [type]"
 * - "target player discards a card"
 * - "sacrifice a [type]"
 * - "scry N" (approximated as look at top N)
 */

import type {
  SpellAbility,
  Effect,
  TargetRequirement,
  CardData,
  ManaPool,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { parseManaCost } from "./cost-parser.js";

// ---------------------------------------------------------------------------
// Mana ability parsing
// ---------------------------------------------------------------------------

const MANA_ABILITY_REGEX = /^\{T\}: Add (\{[WUBRGC]\}(?:\{[WUBRGC]\})*)\.?$/i;
const MANA_ANY_COLOR_REGEX = /^\{T\}: Add one mana of any color\.?$/i;

function parseManaAbility(text: string): SpellAbility | null {
  if (MANA_ANY_COLOR_REGEX.test(text)) {
    return makeManaAbility({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 });
  }

  const match = text.match(MANA_ABILITY_REGEX);
  if (!match) return null;

  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const symbolRegex = /\{([WUBRGC])\}/g;
  let m: RegExpExecArray | null;
  while ((m = symbolRegex.exec(match[1])) !== null) {
    counts[m[1]]++;
  }

  return makeManaAbility({
    W: counts.W, U: counts.U, B: counts.B,
    R: counts.R, G: counts.G, C: counts.C,
  });
}

function makeManaAbility(mana: ManaPool): SpellAbility {
  return {
    type: "mana",
    id: "parsed_mana_tap",
    sourceCardInstanceId: null,
    effects: [{ type: "addMana", mana, player: { type: "controller" } }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null, tapSelf: true, untapSelf: false,
      sacrifice: null, discard: null, payLife: null,
      exileSelf: false, exileFromGraveyard: null,
      removeCounters: null, additionalCosts: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Trigger parsing (all "When/Whenever/At" patterns)
// ---------------------------------------------------------------------------

interface TriggerParse {
  eventType: string | readonly string[];
  self: boolean;
  filter: import("@magic-flux/types").CardFilter | null;
}

function parseTriggerLine(text: string): { trigger: TriggerParse; effectText: string } | null {
  // ETB: "When ~ enters the battlefield, [effect]"
  const etb = text.match(/^When (?:~|this creature|this permanent) enters the battlefield,?\s*(.+)$/i);
  if (etb) return { trigger: { eventType: "cardEnteredZone", self: true, filter: null }, effectText: etb[1].replace(/\.$/, "") };

  // Dies: "When ~ dies, [effect]"
  const dies = text.match(/^When (?:~|this creature) dies,?\s*(.+)$/i);
  if (dies) return { trigger: { eventType: "cardDestroyed", self: true, filter: null }, effectText: dies[1].replace(/\.$/, "") };

  // LTB: "When ~ leaves the battlefield, [effect]"
  const ltb = text.match(/^When (?:~|this) leaves the battlefield,?\s*(.+)$/i);
  if (ltb) return { trigger: { eventType: "cardLeftZone", self: true, filter: null }, effectText: ltb[1].replace(/\.$/, "") };

  // Attacks: "Whenever ~ attacks, [effect]"
  const attacks = text.match(/^Whenever ~ attacks,?\s*(.+)$/i);
  if (attacks) return { trigger: { eventType: "attackersDeclared", self: true, filter: null }, effectText: attacks[1].replace(/\.$/, "") };

  // Blocks: "Whenever ~ blocks, [effect]"
  const blocks = text.match(/^Whenever ~ blocks,?\s*(.+)$/i);
  if (blocks) return { trigger: { eventType: "blockersDeclared", self: true, filter: null }, effectText: blocks[1].replace(/\.$/, "") };

  // Combat damage to player: "Whenever ~ deals combat damage to a player, [effect]"
  const combatDmg = text.match(/^Whenever ~ deals combat damage to a player,?\s*(.+)$/i);
  if (combatDmg) return { trigger: { eventType: "damageDealt", self: true, filter: null }, effectText: combatDmg[1].replace(/\.$/, "") };

  // Cast trigger: "Whenever you cast a [type] spell, [effect]"
  const castTrigger = text.match(/^Whenever you cast a(?:n)? ([\w\s]+) spell,?\s*(.+)$/i);
  if (castTrigger) {
    return {
      trigger: { eventType: "spellCast", self: false, filter: null },
      effectText: castTrigger[2].replace(/\.$/, ""),
    };
  }

  // Beginning of step: "At the beginning of your upkeep/end step, [effect]"
  const beginStep = text.match(/^At the beginning of your (upkeep|end step|draw step),?\s*(.+)$/i);
  if (beginStep) {
    return {
      trigger: { eventType: "phaseChanged", self: false, filter: null },
      effectText: beginStep[2].replace(/\.$/, ""),
    };
  }

  // Beginning of each upkeep: "At the beginning of each player's upkeep, [effect]"
  const eachUpkeep = text.match(/^At the beginning of each (?:player's )?upkeep,?\s*(.+)$/i);
  if (eachUpkeep) {
    return {
      trigger: { eventType: "phaseChanged", self: false, filter: null },
      effectText: eachUpkeep[1].replace(/\.$/, ""),
    };
  }

  return null;
}

function parseTrigger(text: string, cardData: CardData): SpellAbility | null {
  const result = parseTriggerLine(text);
  if (!result) return null;

  const parsed = parseEffectText(result.effectText, cardData);
  if (!parsed) return null;

  return {
    type: "triggered",
    id: "parsed_trigger",
    sourceCardInstanceId: null,
    effects: parsed.effects,
    zones: [ZoneType.Battlefield],
    triggerCondition: {
      eventType: result.trigger.eventType,
      filter: result.trigger.filter,
      self: result.trigger.self,
      optional: false,
      interveningIf: null,
    },
    targets: parsed.targets,
  };
}

// ---------------------------------------------------------------------------
// Activated ability parsing
// ---------------------------------------------------------------------------

const ACTIVATED_REGEX = /^(\{[^}]+\}(?:\{[^}]+\})*(?:,\s*\{T\})?(?:,\s*[Ss]acrifice ~)?): (.+)$/;

function parseActivatedAbility(text: string, cardData: CardData): SpellAbility | null {
  const match = text.match(ACTIVATED_REGEX);
  if (!match) return null;

  const costStr = match[1];
  const effectText = match[2].replace(/\.$/, "");

  // Skip if this is a mana ability
  if (/^Add \{[WUBRGC]\}/i.test(effectText)) return null;
  if (/^Add one mana of any color/i.test(effectText)) return null;

  const tapSelf = costStr.includes("{T}");
  const sacrificeSelf = /sacrifice ~/i.test(costStr);
  const manaCostStr = costStr
    .replace(/,?\s*\{T\}/, "")
    .replace(/,?\s*[Ss]acrifice ~/, "")
    .trim();
  const manaCost = manaCostStr ? parseManaCost(manaCostStr) : null;

  const parsed = parseEffectText(effectText, cardData);
  if (!parsed) return null;

  return {
    type: "activated",
    id: "parsed_activated",
    sourceCardInstanceId: null,
    effects: parsed.effects,
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost,
      tapSelf,
      untapSelf: false,
      sacrifice: sacrificeSelf ? { self: true, description: "Sacrifice this permanent" } : null,
      discard: null,
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [],
    },
    timing: "instant",
    targets: parsed.targets,
    activationRestrictions: [],
  };
}

// Cycling: "Cycling {Cost}" → activated ability from hand
function parseCycling(text: string): SpellAbility | null {
  const match = text.match(/^Cycling (\{[^}]+\}(?:\{[^}]+\})*)$/i);
  if (!match) return null;

  const manaCost = parseManaCost(match[1]);

  return {
    type: "activated",
    id: "parsed_cycling",
    sourceCardInstanceId: null,
    effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
    zones: [ZoneType.Hand],
    cost: {
      manaCost,
      tapSelf: false,
      untapSelf: false,
      sacrifice: null,
      discard: { self: true, description: "Discard this card" },
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [],
    },
    timing: "instant",
    targets: [],
    activationRestrictions: [],
  };
}

// ---------------------------------------------------------------------------
// Effect text parsing — massively expanded for v2
// ---------------------------------------------------------------------------

interface ParsedEffect {
  effects: Effect[];
  targets: TargetRequirement[];
}

function parseEffectText(text: string, _cardData: CardData): ParsedEffect | null {
  // "deals N damage to target [type]" or "deals N damage to any target"
  const damageMatch = text.match(/deals? (\d+) damage to (any target|target ([\w\s]+?))\s*$/i);
  if (damageMatch) {
    const amount = parseInt(damageMatch[1], 10);
    const targetDesc = damageMatch[2];
    const targetTypes = targetDesc === "any target"
      ? ["creature", "planeswalker", "player"] as const
      : inferTargetTypes(damageMatch[3]);

    return {
      effects: [{ type: "dealDamage", amount, to: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", targetDesc, targetTypes)],
    };
  }

  // "return target [type] to its owner's hand"
  const bounceMatch = text.match(/return target ([\w\s]+) to its owner'?s hand/i);
  if (bounceMatch) {
    const types = inferTargetTypes(bounceMatch[1]);
    return {
      effects: [{ type: "bounce", target: { targetRequirementId: "parsed_t1" }, to: ZoneType.Hand }],
      targets: [makeTarget("parsed_t1", `target ${bounceMatch[1].trim()}`, types)],
    };
  }

  // "exile target [type]"
  const exileTargetMatch = text.match(/exile target ([\w\s]+)/i);
  if (exileTargetMatch) {
    const types = inferTargetTypes(exileTargetMatch[1]);
    return {
      effects: [{ type: "exile", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${exileTargetMatch[1].trim()}`, types)],
    };
  }

  // "destroy target [type]"
  const destroyMatch = text.match(/destroy target ([\w\s]+)/i);
  if (destroyMatch) {
    const types = inferTargetTypes(destroyMatch[1]);
    return {
      effects: [{ type: "destroy", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${destroyMatch[1].trim()}`, types)],
    };
  }

  // "put N +1/+1 counters on target [type]"
  const counterMatch = text.match(/put (\d+|a) \+1\/\+1 counters? on target ([\w\s]+)/i);
  if (counterMatch) {
    const count = counterMatch[1] === "a" ? 1 : parseInt(counterMatch[1], 10);
    const types = inferTargetTypes(counterMatch[2]);
    return {
      effects: [{ type: "addCounters", counterType: "+1/+1", count, target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${counterMatch[2].trim()}`, types)],
    };
  }

  // "put N +1/+1 counters on ~" (self, no target)
  const selfCounterMatch = text.match(/put (\d+|a) \+1\/\+1 counters? on ~/i);
  if (selfCounterMatch) {
    const count = selfCounterMatch[1] === "a" ? 1 : parseInt(selfCounterMatch[1], 10);
    return {
      effects: [{ type: "addCounters", counterType: "+1/+1", count, target: { targetRequirementId: "self" } }],
      targets: [],
    };
  }

  // "create N N/N [color] [type] creature token(s)"
  const tokenMatch = text.match(/create (\d+|a|an|two|three) (\d+)\/(\d+) ([\w\s]+?) creature tokens?/i);
  if (tokenMatch) {
    const countWord = tokenMatch[1];
    const count = countWord === "a" || countWord === "an" ? 1
      : countWord === "two" ? 2
      : countWord === "three" ? 3
      : parseInt(countWord, 10);
    const power = parseInt(tokenMatch[2], 10);
    const toughness = parseInt(tokenMatch[3], 10);
    const desc = tokenMatch[4].trim();

    return {
      effects: [{
        type: "createToken",
        token: {
          name: desc.split(" ").pop() ?? desc,
          colors: [],
          cardTypes: ["Creature"],
          subtypes: [desc.split(" ").pop() ?? desc],
          power, toughness,
          abilities: [],
          keywords: [],
        },
        count,
        controller: { type: "controller" },
      }],
      targets: [],
    };
  }

  // "tap target [type]"
  const tapMatch = text.match(/tap target ([\w\s]+)/i);
  if (tapMatch) {
    const types = inferTargetTypes(tapMatch[1]);
    return {
      effects: [{ type: "tap", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${tapMatch[1].trim()}`, types)],
    };
  }

  // "untap target [type]"
  const untapMatch = text.match(/untap target ([\w\s]+)/i);
  if (untapMatch) {
    const types = inferTargetTypes(untapMatch[1]);
    return {
      effects: [{ type: "untap", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${untapMatch[1].trim()}`, types)],
    };
  }

  // "target player discards a card" / "target player discards N cards"
  const targetDiscardMatch = text.match(/target (player|opponent) discards? (\d+|a) cards?/i);
  if (targetDiscardMatch) {
    const count = targetDiscardMatch[2] === "a" ? 1 : parseInt(targetDiscardMatch[2], 10);
    return {
      effects: [{ type: "discardCards", count, player: { type: "targetPlayer", targetRef: { targetRequirementId: "parsed_t1" } } }],
      targets: [{
        id: "parsed_t1",
        description: `target ${targetDiscardMatch[1]}`,
        count: { exactly: 1 },
        targetTypes: ["player"],
        filter: null,
        controller: targetDiscardMatch[1] === "opponent" ? "opponent" : "any",
      }],
    };
  }

  // "draw N card(s)" / "draws N card(s)"
  const drawMatch = text.match(/draws? (\d+|a) cards?/i);
  if (drawMatch) {
    const count = drawMatch[1] === "a" ? 1 : parseInt(drawMatch[1], 10);
    return {
      effects: [{ type: "drawCards", count, player: { type: "controller" } }],
      targets: [],
    };
  }

  // "you draw a card"
  if (/you draw a card/i.test(text)) {
    return {
      effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
      targets: [],
    };
  }

  // "each opponent loses N life"
  const opponentLoseLifeMatch = text.match(/each opponent loses (\d+) life/i);
  if (opponentLoseLifeMatch) {
    return {
      effects: [{ type: "loseLife", amount: parseInt(opponentLoseLifeMatch[1], 10), player: { type: "controller" } }],
      targets: [],
    };
  }

  // "target [type] gets +N/+N until end of turn"
  const ptMatch = text.match(/target ([\w\s]+) gets ([+-]\d+)\/([+-]\d+) until end of turn/i);
  if (ptMatch) {
    const types = inferTargetTypes(ptMatch[1]);
    return {
      effects: [{ type: "modifyPT", power: parseInt(ptMatch[2], 10), toughness: parseInt(ptMatch[3], 10), target: { targetRequirementId: "parsed_t1" }, duration: "endOfTurn" }],
      targets: [makeTarget("parsed_t1", `target ${ptMatch[1].trim()}`, types)],
    };
  }

  // "~ gets +N/+N until end of turn" (self)
  const selfPtMatch = text.match(/~ gets ([+-]\d+)\/([+-]\d+) until end of turn/i);
  if (selfPtMatch) {
    return {
      effects: [{ type: "modifyPT", power: parseInt(selfPtMatch[1], 10), toughness: parseInt(selfPtMatch[2], 10), target: { targetRequirementId: "self" }, duration: "endOfTurn" }],
      targets: [],
    };
  }

  // "target creature gains [keyword] until end of turn"
  const grantKeywordMatch = text.match(/target ([\w\s]+) gains ([\w\s]+) until end of turn/i);
  if (grantKeywordMatch) {
    const types = inferTargetTypes(grantKeywordMatch[1]);
    return {
      effects: [{ type: "custom", resolveFunction: `grant_${grantKeywordMatch[2].trim().toLowerCase()}` }],
      targets: [makeTarget("parsed_t1", `target ${grantKeywordMatch[1].trim()}`, types)],
    };
  }

  // "you gain N life"
  const gainLifeMatch = text.match(/you gain (\d+) life/i);
  if (gainLifeMatch) {
    return {
      effects: [{ type: "gainLife", amount: parseInt(gainLifeMatch[1], 10), player: { type: "controller" } }],
      targets: [],
    };
  }

  // "target player gains N life"
  const targetGainLifeMatch = text.match(/target (player|opponent) gains (\d+) life/i);
  if (targetGainLifeMatch) {
    return {
      effects: [{ type: "gainLife", amount: parseInt(targetGainLifeMatch[2], 10), player: { type: "targetPlayer", targetRef: { targetRequirementId: "parsed_t1" } } }],
      targets: [{
        id: "parsed_t1",
        description: `target ${targetGainLifeMatch[1]}`,
        count: { exactly: 1 },
        targetTypes: ["player"],
        filter: null,
        controller: targetGainLifeMatch[1] === "opponent" ? "opponent" : "any",
      }],
    };
  }

  // "you lose N life"
  const loseLifeMatch = text.match(/you lose (\d+) life/i);
  if (loseLifeMatch) {
    return {
      effects: [{ type: "loseLife", amount: parseInt(loseLifeMatch[1], 10), player: { type: "controller" } }],
      targets: [],
    };
  }

  // "scry N" (approximated — look at top N, reorder)
  const scryMatch = text.match(/scry (\d+)/i);
  if (scryMatch) {
    return {
      effects: [{ type: "custom", resolveFunction: `scry_${scryMatch[1]}` }],
      targets: [],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferTargetTypes(desc: string): readonly string[] {
  const lower = desc.trim().toLowerCase();
  if (lower.includes("creature")) return ["creature"];
  if (lower.includes("artifact")) return ["artifact"];
  if (lower.includes("enchantment")) return ["enchantment"];
  if (lower.includes("land")) return ["land"];
  if (lower.includes("planeswalker")) return ["planeswalker"];
  if (lower.includes("player")) return ["player"];
  if (lower.includes("permanent")) return ["permanent"];
  return ["permanent"];
}

function makeTarget(
  id: string, description: string, targetTypes: readonly string[],
): TargetRequirement {
  return {
    id,
    description,
    count: { exactly: 1 },
    targetTypes: targetTypes as any,
    filter: null,
    controller: "any",
  };
}

// ---------------------------------------------------------------------------
// Keyword line detection (skip lines that are just keyword names)
// ---------------------------------------------------------------------------

const KEYWORD_NAMES = new Set([
  "flying", "trample", "deathtouch", "lifelink", "vigilance", "haste",
  "first strike", "double strike", "reach", "hexproof", "indestructible",
  "menace", "flash", "defender", "shroud", "intimidate", "protection",
  "prowess", "ward", "equip",
]);

function isKeywordLine(line: string): boolean {
  const lower = line.toLowerCase().replace(/[.,]$/, "").trim();
  // Check if the entire line is just keyword names separated by commas/newlines
  const parts = lower.split(/,\s*/);
  return parts.every((p) => KEYWORD_NAMES.has(p.trim()));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse oracle text into structured SpellAbility objects.
 *
 * Splits oracle text by newlines (each line is a separate ability in MTG),
 * then attempts to parse each line. Lines that can't be parsed are skipped
 * (those cards need manual overrides).
 */
export function parseOracleText(oracleText: string, cardData: CardData): SpellAbility[] {
  if (!oracleText) return [];

  const abilities: SpellAbility[] = [];
  const normalized = oracleText.replace(new RegExp(escapeRegExp(cardData.name), "gi"), "~");
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const suffix = i > 0 ? `_${i}` : "";

    // Skip lines that are just keyword names (handled by keyword registry)
    if (isKeywordLine(line)) continue;

    // Mana abilities (highest priority — don't use the stack)
    const mana = parseManaAbility(line);
    if (mana) {
      abilities.push({ ...mana, id: `parsed_mana${suffix}` });
      continue;
    }

    // Cycling
    const cycling = parseCycling(line);
    if (cycling) {
      abilities.push({ ...cycling, id: `parsed_cycling${suffix}` });
      continue;
    }

    // Triggers (When/Whenever/At)
    const trigger = parseTrigger(line, cardData);
    if (trigger) {
      abilities.push({ ...trigger, id: `parsed_trigger${suffix}` });
      continue;
    }

    // Activated abilities
    const activated = parseActivatedAbility(line, cardData);
    if (activated) {
      abilities.push({ ...activated, id: `parsed_activated${suffix}` });
      continue;
    }
  }

  return abilities;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
