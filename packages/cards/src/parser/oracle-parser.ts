/**
 * Oracle text parser v3.
 *
 * Converts oracle text patterns into structured SpellAbility objects.
 * Target: 80%+ of common card templates handled automatically.
 *
 * v3 additions over v2:
 * - Modal spells ("Choose one —" / "Choose two —")
 * - Board wipes ("Destroy all [type]")
 * - "Each" effects ("Each player/opponent [effect]")
 * - Landfall triggers ("Whenever a land enters the battlefield under your control")
 * - Non-self creature triggers ("Whenever a creature [enters/dies]")
 * - Sacrifice non-self costs ("Sacrifice a creature: [effect]")
 * - Search/tutor ("Search your library for [type]")
 * - Mill ("Mill N cards" / "put top N cards into graveyard")
 * - Treasure/token shorthand ("Create a Treasure token")
 * - "Can't be blocked" / evasion text
 * - "Prevent all combat damage"
 * - Play from zones ("You may play/cast [cards] from [zone]")
 * - Multi-ability splitting (abilities separated by newlines, not just one per line)
 * - Linked ability pairs (ETB exile + LTB return)
 */

import type {
  SpellAbility,
  Effect,
  TargetRequirement,
  CardData,
  ManaPool,
  CardFilter,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { parseManaCost } from "./cost-parser.js";

// ---------------------------------------------------------------------------
// Mana ability parsing
// ---------------------------------------------------------------------------

const MANA_ABILITY_REGEX = /^\{T\}: Add (\{[WUBRGC]\}(?:\{[WUBRGC]\})*)\.?$/i;
const MANA_ANY_COLOR_REGEX = /^\{T\}: Add one mana of any color\.?$/i;
const MANA_TWO_ANY_REGEX = /^\{T\}: Add two mana of any one color\.?$/i;

function parseManaAbility(text: string): SpellAbility | null {
  if (MANA_ANY_COLOR_REGEX.test(text)) {
    return makeManaAbility({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 });
  }
  if (MANA_TWO_ANY_REGEX.test(text)) {
    return makeManaAbility({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 });
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
// Trigger parsing — all "When/Whenever/At" patterns
// ---------------------------------------------------------------------------

interface TriggerParse {
  eventType: string | readonly string[];
  self: boolean;
  filter: CardFilter | null;
  optional: boolean;
}

function parseTriggerLine(text: string): { trigger: TriggerParse; effectText: string } | null {
  // ETB self: "When ~ enters the battlefield, [effect]"
  const etbSelf = text.match(/^When (?:~|this creature|this permanent) enters the battlefield,?\s*(.+)$/i);
  if (etbSelf) return { trigger: { eventType: "cardEnteredZone", self: true, filter: null, optional: false }, effectText: stripTrailingDot(etbSelf[1]) };

  // ETB optional: "When ~ enters the battlefield, you may [effect]"
  const etbOptional = text.match(/^When (?:~|this creature|this permanent) enters the battlefield, you may\s+(.+)$/i);
  if (etbOptional) return { trigger: { eventType: "cardEnteredZone", self: true, filter: null, optional: true }, effectText: stripTrailingDot(etbOptional[1]) };

  // Dies self: "When ~ dies, [effect]"
  const diesSelf = text.match(/^When (?:~|this creature) dies,?\s*(.+)$/i);
  if (diesSelf) return { trigger: { eventType: "cardDestroyed", self: true, filter: null, optional: false }, effectText: stripTrailingDot(diesSelf[1]) };

  // LTB self: "When ~ leaves the battlefield, [effect]"
  const ltbSelf = text.match(/^When (?:~|this) leaves the battlefield,?\s*(.+)$/i);
  if (ltbSelf) return { trigger: { eventType: "cardLeftZone", self: true, filter: null, optional: false }, effectText: stripTrailingDot(ltbSelf[1]) };

  // Attacks self: "Whenever ~ attacks, [effect]"
  const attacksSelf = text.match(/^Whenever ~ attacks,?\s*(.+)$/i);
  if (attacksSelf) return { trigger: { eventType: "attackersDeclared", self: true, filter: null, optional: false }, effectText: stripTrailingDot(attacksSelf[1]) };

  // Blocks self: "Whenever ~ blocks, [effect]"
  const blocksSelf = text.match(/^Whenever ~ blocks,?\s*(.+)$/i);
  if (blocksSelf) return { trigger: { eventType: "blockersDeclared", self: true, filter: null, optional: false }, effectText: stripTrailingDot(blocksSelf[1]) };

  // Combat damage to player: "Whenever ~ deals combat damage to a player, [effect]"
  const combatDmg = text.match(/^Whenever ~ deals combat damage to a player,?\s*(.+)$/i);
  if (combatDmg) return { trigger: { eventType: "damageDealt", self: true, filter: null, optional: false }, effectText: stripTrailingDot(combatDmg[1]) };

  // Non-self creature ETB: "Whenever a creature enters the battlefield [under your control], [effect]"
  const creatureEtb = text.match(/^Whenever a ([\w\s]+?) enters the battlefield(?: under your control)?,?\s*(.+)$/i);
  if (creatureEtb) {
    const typeFilter = inferCardFilter(creatureEtb[1]);
    return { trigger: { eventType: "cardEnteredZone", self: false, filter: typeFilter, optional: false }, effectText: stripTrailingDot(creatureEtb[2]) };
  }

  // Non-self creature dies: "Whenever a creature [you control] dies, [effect]"
  const creatureDies = text.match(/^Whenever a ([\w\s]+?)(?: you control)? dies,?\s*(.+)$/i);
  if (creatureDies) {
    const typeFilter = inferCardFilter(creatureDies[1]);
    return { trigger: { eventType: "cardDestroyed", self: false, filter: typeFilter, optional: false }, effectText: stripTrailingDot(creatureDies[2]) };
  }

  // Landfall: "Whenever a land enters the battlefield under your control, [effect]"
  const landfall = text.match(/^Whenever a land enters the battlefield under your control,?\s*(.+)$/i);
  if (landfall) return { trigger: { eventType: "cardEnteredZone", self: false, filter: { cardTypes: ["Land"] }, optional: false }, effectText: stripTrailingDot(landfall[1]) };

  // Cast trigger: "Whenever you cast a/an [type] spell, [effect]"
  const castTrigger = text.match(/^Whenever you cast a(?:n)? ([\w\s]+?) spell,?\s*(.+)$/i);
  if (castTrigger) {
    return { trigger: { eventType: "spellCast", self: false, filter: inferCardFilter(castTrigger[1]), optional: false }, effectText: stripTrailingDot(castTrigger[2]) };
  }

  // Whenever opponent casts: "Whenever an opponent casts a spell, [effect]"
  const opponentCast = text.match(/^Whenever an opponent casts a spell,?\s*(.+)$/i);
  if (opponentCast) return { trigger: { eventType: "spellCast", self: false, filter: null, optional: false }, effectText: stripTrailingDot(opponentCast[1]) };

  // Whenever you gain life: "Whenever you gain life, [effect]"
  const gainLifeTrigger = text.match(/^Whenever you gain life,?\s*(.+)$/i);
  if (gainLifeTrigger) return { trigger: { eventType: "lifeChanged", self: false, filter: null, optional: false }, effectText: stripTrailingDot(gainLifeTrigger[1]) };

  // Beginning of step: "At the beginning of your upkeep/end step/draw step, [effect]"
  const beginStep = text.match(/^At the beginning of (?:your |each (?:player's )?)(upkeep|end step|draw step|combat),?\s*(.+)$/i);
  if (beginStep) return { trigger: { eventType: "phaseChanged", self: false, filter: null, optional: false }, effectText: stripTrailingDot(beginStep[2]) };

  // Damage dealt to self: "Whenever ~ is dealt damage, [effect]"
  const damagedSelf = text.match(/^Whenever ~ is dealt damage,?\s*(.+)$/i);
  if (damagedSelf) return { trigger: { eventType: "damageDealt", self: true, filter: null, optional: false }, effectText: stripTrailingDot(damagedSelf[1]) };

  // Whenever you discard: "Whenever you discard a card, [effect]"
  const discardTrigger = text.match(/^Whenever you discard a card,?\s*(.+)$/i);
  if (discardTrigger) return { trigger: { eventType: "cardLeftZone", self: false, filter: null, optional: false }, effectText: stripTrailingDot(discardTrigger[1]) };

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
      optional: result.trigger.optional,
      interveningIf: null,
    },
    targets: parsed.targets,
  };
}

// ---------------------------------------------------------------------------
// Modal spell parsing: "Choose one —" / "Choose two —"
// ---------------------------------------------------------------------------

function parseModalSpell(lines: string[], startIdx: number, cardData: CardData): { ability: SpellAbility; linesConsumed: number } | null {
  const line = lines[startIdx];
  const modalMatch = line.match(/^Choose (one|two|three|four)(?: or (?:more|both))?\s*[—–-]\s*$/i);
  if (!modalMatch) return null;

  const modes: Effect[][] = [];
  const allTargets: TargetRequirement[] = [];
  let idx = startIdx + 1;

  while (idx < lines.length) {
    const modeLine = lines[idx].replace(/^[•·*]\s*/, "").trim();
    if (!modeLine || /^Choose /i.test(modeLine)) break;

    const parsed = parseEffectText(modeLine, cardData);
    if (parsed) {
      modes.push(parsed.effects);
      // Deduplicate targets by id
      for (const t of parsed.targets) {
        if (!allTargets.some((at) => at.id === t.id)) {
          allTargets.push(t);
        }
      }
    } else {
      modes.push([{ type: "custom", resolveFunction: `modal_unparsed_${idx}` }]);
    }
    idx++;
  }

  if (modes.length === 0) return null;

  return {
    ability: {
      type: "spell",
      id: "parsed_modal",
      sourceCardInstanceId: null,
      effects: [{ type: "playerChoice", choices: modes.map((m) => m.length === 1 ? m[0] : { type: "composite" as const, effects: m }), player: { type: "controller" } }],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
    linesConsumed: idx - startIdx,
  };
}

// ---------------------------------------------------------------------------
// Activated ability parsing
// ---------------------------------------------------------------------------

const ACTIVATED_REGEX = /^(\{[^}]+\}(?:\{[^}]+\})*(?:,\s*\{T\})?(?:,\s*[Ss]acrifice (?:~|a [\w\s]+))?): (.+)$/;

function parseActivatedAbility(text: string, cardData: CardData): SpellAbility | null {
  const match = text.match(ACTIVATED_REGEX);
  if (!match) return null;

  const costStr = match[1];
  const effectText = match[2].replace(/\.$/, "");

  // Skip mana abilities (already handled)
  if (/^Add \{[WUBRGC]\}/i.test(effectText)) return null;
  if (/^Add one mana of any color/i.test(effectText)) return null;
  if (/^Add two mana/i.test(effectText)) return null;

  const tapSelf = costStr.includes("{T}");
  const sacrificeSelfMatch = /[Ss]acrifice ~/i.test(costStr);
  const sacrificeOtherMatch = costStr.match(/[Ss]acrifice a ([\w\s]+)/i);

  const manaCostStr = costStr
    .replace(/,?\s*\{T\}/, "")
    .replace(/,?\s*[Ss]acrifice ~/, "")
    .replace(/,?\s*[Ss]acrifice a [\w\s]+/, "")
    .trim();
  const manaCost = manaCostStr ? parseManaCost(manaCostStr) : null;

  const parsed = parseEffectText(effectText, cardData);
  if (!parsed) return null;

  let sacrifice: import("@magic-flux/types").CostFilter | null = null;
  if (sacrificeSelfMatch) {
    sacrifice = { self: true, description: "Sacrifice this permanent" };
  } else if (sacrificeOtherMatch) {
    const sacType = sacrificeOtherMatch[1].trim();
    sacrifice = { self: false, description: `Sacrifice a ${sacType}`, cardTypes: inferCardTypesFromText(sacType) as import("@magic-flux/types").CardTypeName[] };
  }

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
      sacrifice,
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

// Cycling: "Cycling {Cost}"
function parseCycling(text: string): SpellAbility | null {
  const match = text.match(/^Cycling (\{[^}]+\}(?:\{[^}]+\})*)$/i);
  if (!match) return null;

  return {
    type: "activated",
    id: "parsed_cycling",
    sourceCardInstanceId: null,
    effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
    zones: [ZoneType.Hand],
    cost: {
      manaCost: parseManaCost(match[1]),
      tapSelf: false, untapSelf: false, sacrifice: null,
      discard: { self: true, description: "Discard this card" },
      payLife: null, exileSelf: false, exileFromGraveyard: null,
      removeCounters: null, additionalCosts: [],
    },
    timing: "instant",
    targets: [],
    activationRestrictions: [],
  };
}

// ---------------------------------------------------------------------------
// Effect text parsing — v3 expansion
// ---------------------------------------------------------------------------

interface ParsedEffect {
  effects: Effect[];
  targets: TargetRequirement[];
}

function parseEffectText(text: string, _cardData: CardData): ParsedEffect | null {
  // --- Damage ---
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

  // --- Board wipes: "Destroy all [type]" ---
  const destroyAllMatch = text.match(/^destroy all ([\w\s]+)/i);
  if (destroyAllMatch) {
    return {
      effects: [{ type: "custom", resolveFunction: `destroy_all_${destroyAllMatch[1].trim().toLowerCase().replace(/\s+/g, "_")}` }],
      targets: [],
    };
  }

  // --- "Exile all [type]" ---
  const exileAllMatch = text.match(/^exile all ([\w\s]+)/i);
  if (exileAllMatch) {
    return {
      effects: [{ type: "custom", resolveFunction: `exile_all_${exileAllMatch[1].trim().toLowerCase().replace(/\s+/g, "_")}` }],
      targets: [],
    };
  }

  // --- Bounce: "return target [type] to its owner's hand" ---
  const bounceMatch = text.match(/return target ([\w\s]+) to its owner'?s hand/i);
  if (bounceMatch) {
    const types = inferTargetTypes(bounceMatch[1]);
    return {
      effects: [{ type: "bounce", target: { targetRequirementId: "parsed_t1" }, to: ZoneType.Hand }],
      targets: [makeTarget("parsed_t1", `target ${bounceMatch[1].trim()}`, types)],
    };
  }

  // --- "Return all [type] to their owners' hands" ---
  const bounceAllMatch = text.match(/return all ([\w\s]+) to their owners'? hands?/i);
  if (bounceAllMatch) {
    return {
      effects: [{ type: "custom", resolveFunction: `bounce_all_${bounceAllMatch[1].trim().toLowerCase().replace(/\s+/g, "_")}` }],
      targets: [],
    };
  }

  // --- Exile target ---
  const exileTargetMatch = text.match(/exile target ([\w\s]+)/i);
  if (exileTargetMatch) {
    const types = inferTargetTypes(exileTargetMatch[1]);
    return {
      effects: [{ type: "exile", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${exileTargetMatch[1].trim()}`, types)],
    };
  }

  // --- Destroy target ---
  const destroyMatch = text.match(/destroy target ([\w\s]+)/i);
  if (destroyMatch) {
    const types = inferTargetTypes(destroyMatch[1]);
    return {
      effects: [{ type: "destroy", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${destroyMatch[1].trim()}`, types)],
    };
  }

  // --- Counters: "put N +1/+1 counters on target [type]" ---
  const counterTargetMatch = text.match(/put (\d+|a) \+1\/\+1 counters? on target ([\w\s]+)/i);
  if (counterTargetMatch) {
    const count = counterTargetMatch[1] === "a" ? 1 : parseInt(counterTargetMatch[1], 10);
    const types = inferTargetTypes(counterTargetMatch[2]);
    return {
      effects: [{ type: "addCounters", counterType: "+1/+1", count, target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${counterTargetMatch[2].trim()}`, types)],
    };
  }

  // --- Counters on self ---
  const selfCounterMatch = text.match(/put (\d+|a) \+1\/\+1 counters? on ~/i);
  if (selfCounterMatch) {
    const count = selfCounterMatch[1] === "a" ? 1 : parseInt(selfCounterMatch[1], 10);
    return {
      effects: [{ type: "addCounters", counterType: "+1/+1", count, target: { targetRequirementId: "self" } }],
      targets: [],
    };
  }

  // --- Token creation: "create N N/N [desc] creature token(s)" ---
  const tokenMatch = text.match(/create (\d+|a|an|two|three|four) (\d+)\/(\d+) ([\w\s]+?) creature tokens?/i);
  if (tokenMatch) {
    const count = wordToNumber(tokenMatch[1]);
    const power = parseInt(tokenMatch[2], 10);
    const toughness = parseInt(tokenMatch[3], 10);
    const desc = tokenMatch[4].trim();
    const tokenName = desc.split(" ").pop() ?? desc;

    return {
      effects: [{
        type: "createToken",
        token: { name: tokenName, colors: [], cardTypes: ["Creature"], subtypes: [tokenName], power, toughness, abilities: [], keywords: [] },
        count, controller: { type: "controller" },
      }],
      targets: [],
    };
  }

  // --- Treasure token: "create a Treasure token" / "create N Treasure tokens" ---
  const treasureMatch = text.match(/create (\d+|a|an|two|three) Treasure tokens?/i);
  if (treasureMatch) {
    const count = wordToNumber(treasureMatch[1]);
    return {
      effects: [{
        type: "createToken",
        token: { name: "Treasure", colors: [], cardTypes: ["Artifact"], subtypes: ["Treasure"], power: null, toughness: null, abilities: [], keywords: [] },
        count, controller: { type: "controller" },
      }],
      targets: [],
    };
  }

  // --- Tap/untap target ---
  const tapMatch = text.match(/^tap target ([\w\s]+)/i);
  if (tapMatch) {
    return {
      effects: [{ type: "tap", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${tapMatch[1].trim()}`, inferTargetTypes(tapMatch[1]))],
    };
  }
  const untapMatch = text.match(/^untap target ([\w\s]+)/i);
  if (untapMatch) {
    return {
      effects: [{ type: "untap", target: { targetRequirementId: "parsed_t1" } }],
      targets: [makeTarget("parsed_t1", `target ${untapMatch[1].trim()}`, inferTargetTypes(untapMatch[1]))],
    };
  }

  // --- Target player discard ---
  const targetDiscardMatch = text.match(/target (player|opponent) discards? (\d+|a) cards?/i);
  if (targetDiscardMatch) {
    const count = targetDiscardMatch[2] === "a" ? 1 : parseInt(targetDiscardMatch[2], 10);
    return {
      effects: [{ type: "discardCards", count, player: { type: "targetPlayer", targetRef: { targetRequirementId: "parsed_t1" } } }],
      targets: [{ id: "parsed_t1", description: `target ${targetDiscardMatch[1]}`, count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: targetDiscardMatch[1] === "opponent" ? "opponent" : "any" }],
    };
  }

  // --- Draw cards ---
  const drawMatch = text.match(/draws? (\d+|a) cards?/i);
  if (drawMatch) {
    const count = drawMatch[1] === "a" ? 1 : parseInt(drawMatch[1], 10);
    return { effects: [{ type: "drawCards", count, player: { type: "controller" } }], targets: [] };
  }
  if (/you draw a card/i.test(text)) {
    return { effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }], targets: [] };
  }

  // --- "Each player draws N cards" ---
  const eachDrawMatch = text.match(/each player draws? (\d+|a) cards?/i);
  if (eachDrawMatch) {
    const count = eachDrawMatch[1] === "a" ? 1 : parseInt(eachDrawMatch[1], 10);
    return { effects: [{ type: "custom", resolveFunction: `each_player_draw_${count}` }], targets: [] };
  }

  // --- "Each opponent loses N life" ---
  const opponentLoseLifeMatch = text.match(/each opponent loses (\d+) life/i);
  if (opponentLoseLifeMatch) {
    return { effects: [{ type: "loseLife", amount: parseInt(opponentLoseLifeMatch[1], 10), player: { type: "controller" } }], targets: [] };
  }

  // --- "Each opponent discards a card" ---
  const eachDiscardMatch = text.match(/each opponent discards? (\d+|a) cards?/i);
  if (eachDiscardMatch) {
    const count = eachDiscardMatch[1] === "a" ? 1 : parseInt(eachDiscardMatch[1], 10);
    return { effects: [{ type: "custom", resolveFunction: `each_opponent_discard_${count}` }], targets: [] };
  }

  // --- P/T modification: "target [type] gets +N/+N until end of turn" ---
  const ptMatch = text.match(/target ([\w\s]+) gets ([+-]\d+)\/([+-]\d+) until end of turn/i);
  if (ptMatch) {
    const types = inferTargetTypes(ptMatch[1]);
    return {
      effects: [{ type: "modifyPT", power: parseInt(ptMatch[2], 10), toughness: parseInt(ptMatch[3], 10), target: { targetRequirementId: "parsed_t1" }, duration: "endOfTurn" }],
      targets: [makeTarget("parsed_t1", `target ${ptMatch[1].trim()}`, types)],
    };
  }

  // --- Self P/T: "~ gets +N/+N until end of turn" ---
  const selfPtMatch = text.match(/~ gets ([+-]\d+)\/([+-]\d+) until end of turn/i);
  if (selfPtMatch) {
    return {
      effects: [{ type: "modifyPT", power: parseInt(selfPtMatch[1], 10), toughness: parseInt(selfPtMatch[2], 10), target: { targetRequirementId: "self" }, duration: "endOfTurn" }],
      targets: [],
    };
  }

  // --- Grant keyword: "target creature gains [keyword] until end of turn" ---
  const grantKeywordMatch = text.match(/target ([\w\s]+) gains ([\w\s]+) until end of turn/i);
  if (grantKeywordMatch) {
    return {
      effects: [{ type: "custom", resolveFunction: `grant_${grantKeywordMatch[2].trim().toLowerCase()}` }],
      targets: [makeTarget("parsed_t1", `target ${grantKeywordMatch[1].trim()}`, inferTargetTypes(grantKeywordMatch[1]))],
    };
  }

  // --- "Gain N life" ---
  const gainLifeMatch = text.match(/(?:you )?gain (\d+) life/i);
  if (gainLifeMatch) {
    return { effects: [{ type: "gainLife", amount: parseInt(gainLifeMatch[1], 10), player: { type: "controller" } }], targets: [] };
  }

  // --- "Target player gains N life" ---
  const targetGainLifeMatch = text.match(/target (player|opponent) gains (\d+) life/i);
  if (targetGainLifeMatch) {
    return {
      effects: [{ type: "gainLife", amount: parseInt(targetGainLifeMatch[2], 10), player: { type: "targetPlayer", targetRef: { targetRequirementId: "parsed_t1" } } }],
      targets: [{ id: "parsed_t1", description: `target ${targetGainLifeMatch[1]}`, count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: targetGainLifeMatch[1] === "opponent" ? "opponent" : "any" }],
    };
  }

  // --- "Lose N life" ---
  const loseLifeMatch = text.match(/you lose (\d+) life/i);
  if (loseLifeMatch) {
    return { effects: [{ type: "loseLife", amount: parseInt(loseLifeMatch[1], 10), player: { type: "controller" } }], targets: [] };
  }

  // --- Search: "Search your library for a [type] card" ---
  const searchMatch = text.match(/search your library for a(?:n)? ([\w\s]+?) card/i);
  if (searchMatch) {
    const filter = inferCardFilter(searchMatch[1]);
    return {
      effects: [{ type: "search", zone: ZoneType.Library, filter, player: { type: "controller" }, then: { type: "custom", resolveFunction: "search_put_in_hand" } }],
      targets: [],
    };
  }

  // --- Mill: "mill N cards" / "put the top N cards of your/their library into your/their graveyard" ---
  const millMatch = text.match(/mill (\d+) cards?/i);
  if (millMatch) {
    return { effects: [{ type: "custom", resolveFunction: `mill_${millMatch[1]}` }], targets: [] };
  }
  const millAltMatch = text.match(/put the top (\d+) cards? of (?:your|their) library into (?:your|their) graveyard/i);
  if (millAltMatch) {
    return { effects: [{ type: "custom", resolveFunction: `mill_${millAltMatch[1]}` }], targets: [] };
  }

  // --- "Target player mills N cards" ---
  const targetMillMatch = text.match(/target (player|opponent) mills? (\d+) cards?/i);
  if (targetMillMatch) {
    return {
      effects: [{ type: "custom", resolveFunction: `target_mill_${targetMillMatch[2]}` }],
      targets: [{ id: "parsed_t1", description: `target ${targetMillMatch[1]}`, count: { exactly: 1 }, targetTypes: ["player"], filter: null, controller: targetMillMatch[1] === "opponent" ? "opponent" : "any" }],
    };
  }

  // --- Scry ---
  const scryMatch = text.match(/scry (\d+)/i);
  if (scryMatch) {
    return { effects: [{ type: "custom", resolveFunction: `scry_${scryMatch[1]}` }], targets: [] };
  }

  // --- "Prevent all combat damage" ---
  if (/prevent all combat damage/i.test(text)) {
    return { effects: [{ type: "custom", resolveFunction: "prevent_all_combat_damage" }], targets: [] };
  }

  // --- "Prevent the next N damage" ---
  const preventMatch = text.match(/prevent the next (\d+) damage/i);
  if (preventMatch) {
    return {
      effects: [{ type: "preventDamage", amount: parseInt(preventMatch[1], 10), target: { targetRequirementId: "parsed_t1" }, duration: "endOfTurn" }],
      targets: [makeTarget("parsed_t1", "any target", ["creature", "planeswalker", "player"])],
    };
  }

  // --- Counter spell ---
  const counterMatch = text.match(/counter target ([\w\s]+)/i);
  if (counterMatch) {
    return {
      effects: [{ type: "counter", target: { targetRequirementId: "parsed_t1" } }],
      targets: [{ id: "parsed_t1", description: `target ${counterMatch[1].trim()}`, count: { exactly: 1 }, targetTypes: ["spell"], filter: null, controller: "any" }],
    };
  }

  // --- "Sacrifice a [type]" (as an effect, not a cost) ---
  const sacEffectMatch = text.match(/sacrifice a ([\w\s]+)/i);
  if (sacEffectMatch) {
    const sacType = sacEffectMatch[1].trim();
    return {
      effects: [{ type: "sacrifice", filter: { cardTypes: inferCardTypesFromText(sacType) as any }, player: { type: "controller" }, count: 1 }],
      targets: [],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Static ability line detection
// ---------------------------------------------------------------------------

const KEYWORD_NAMES = new Set([
  "flying", "trample", "deathtouch", "lifelink", "vigilance", "haste",
  "first strike", "double strike", "reach", "hexproof", "indestructible",
  "menace", "flash", "defender", "shroud", "intimidate", "protection",
  "prowess", "ward", "equip", "convoke", "delve", "cascade", "storm",
  "flashback", "kicker", "cycling", "regenerate", "morph", "unearth",
]);

function isKeywordLine(line: string): boolean {
  const lower = line.toLowerCase().replace(/[.,]$/, "").trim();
  const parts = lower.split(/,\s*/);
  return parts.every((p) => KEYWORD_NAMES.has(p.trim()));
}

// Static abilities that are just text descriptions (not keyword names)
function parseStaticAbilityLine(text: string): SpellAbility | null {
  // "~ can't be blocked" / "~ is unblockable"
  if (/~? ?can'?t be blocked/i.test(text) || /is unblockable/i.test(text)) {
    return {
      type: "static", id: "parsed_unblockable", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "cantBeBlocked", affectedFilter: { self: true }, modification: {} },
      condition: null, layer: 6,
    };
  }

  // "~ can't attack" / "~ can't block"
  if (/~? ?can'?t attack/i.test(text)) {
    return {
      type: "static", id: "parsed_cant_attack", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "cantAttack", affectedFilter: { self: true }, modification: {} },
      condition: null, layer: 6,
    };
  }

  // "Other [type] you control get +N/+N" (anthem)
  const anthemMatch = text.match(/other ([\w\s]+?) you control get ([+-]\d+)\/([+-]\d+)/i);
  if (anthemMatch) {
    const filter = inferCardFilter(anthemMatch[1]);
    return {
      type: "static", id: "parsed_anthem", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "modifyPT", affectedFilter: filter, modification: { power: parseInt(anthemMatch[2], 10), toughness: parseInt(anthemMatch[3], 10) } },
      condition: null, layer: 7,
    };
  }

  // "Other [type] you control have [keyword]"
  const grantKeywordAllMatch = text.match(/other ([\w\s]+?) you control have ([\w\s]+)/i);
  if (grantKeywordAllMatch) {
    const filter = inferCardFilter(grantKeywordAllMatch[1]);
    const keyword = grantKeywordAllMatch[2].trim();
    return {
      type: "static", id: "parsed_grant_all", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "grantKeyword", affectedFilter: filter, modification: { keywords: [keyword] } },
      condition: null, layer: 6,
    };
  }

  // "Noncreature spells cost {N} more" / "Spells your opponents cast cost {N} more"
  const taxMatch = text.match(/([\w\s]+?) spells (?:your opponents cast )?cost \{(\d+)\} more/i);
  if (taxMatch) {
    return {
      type: "static", id: "parsed_tax", sourceCardInstanceId: null, effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: { effectType: "costIncrease", affectedFilter: inferCardFilter(taxMatch[1]), modification: { genericIncrease: parseInt(taxMatch[2], 10) } },
      condition: null, layer: 6,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Linked ability pairs
// ---------------------------------------------------------------------------

/**
 * Detect linked ETB exile + LTB return pattern (Oblivion Ring, Banisher Priest, etc.)
 * "When ~ enters the battlefield, exile target [type]."
 * "When ~ leaves the battlefield, return the exiled card to the battlefield."
 *
 * Returns two SpellAbility objects linked by the card's linkedEffects.
 */
function parseLinkedExileReturn(lines: string[], cardData: CardData): SpellAbility[] | null {
  const etbLine = lines.find((l) => /enters the battlefield.*exile target/i.test(l));
  const ltbLine = lines.find((l) => /leaves the battlefield.*return/i.test(l));

  if (!etbLine || !ltbLine) return null;

  const etbMatch = etbLine.match(/exile target ([\w\s]+)/i);
  if (!etbMatch) return null;

  const types = inferTargetTypes(etbMatch[1]);

  return [
    {
      type: "triggered", id: "parsed_linked_etb", sourceCardInstanceId: null,
      effects: [{ type: "exile", target: { targetRequirementId: "linked_t1" } }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardEnteredZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [makeTarget("linked_t1", `target ${etbMatch[1].trim()}`, types)],
    },
    {
      type: "triggered", id: "parsed_linked_ltb", sourceCardInstanceId: null,
      effects: [{ type: "custom", resolveFunction: "oblivion_ring_return" }],
      zones: [ZoneType.Battlefield],
      triggerCondition: { eventType: "cardLeftZone", filter: null, self: true, optional: false, interveningIf: null },
      targets: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripTrailingDot(s: string): string {
  return s.replace(/\.$/, "").trim();
}

function wordToNumber(w: string): number {
  if (w === "a" || w === "an") return 1;
  if (w === "two") return 2;
  if (w === "three") return 3;
  if (w === "four") return 4;
  return parseInt(w, 10) || 1;
}

function inferTargetTypes(desc: string): readonly string[] {
  const lower = desc.trim().toLowerCase();
  if (lower.includes("creature")) return ["creature"];
  if (lower.includes("artifact")) return ["artifact"];
  if (lower.includes("enchantment")) return ["enchantment"];
  if (lower.includes("land")) return ["land"];
  if (lower.includes("planeswalker")) return ["planeswalker"];
  if (lower.includes("player")) return ["player"];
  if (lower.includes("spell")) return ["spell"];
  if (lower.includes("permanent")) return ["permanent"];
  return ["permanent"];
}

function inferCardTypesFromText(desc: string): string[] {
  const lower = desc.toLowerCase();
  if (lower.includes("creature")) return ["Creature"];
  if (lower.includes("artifact")) return ["Artifact"];
  if (lower.includes("enchantment")) return ["Enchantment"];
  if (lower.includes("land")) return ["Land"];
  return ["Creature"]; // default
}

function inferCardFilter(desc: string): CardFilter {
  const types = inferCardTypesFromText(desc);
  return { cardTypes: types as any };
}

function makeTarget(id: string, description: string, targetTypes: readonly string[]): TargetRequirement {
  return { id, description, count: { exactly: 1 }, targetTypes: targetTypes as any, filter: null, controller: "any" };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse oracle text into structured SpellAbility objects.
 *
 * v3: Handles multi-ability cards, modal spells, linked ability pairs,
 * static abilities, and a wide range of trigger/effect patterns.
 *
 * Multi-ability cards: Each newline-separated block is parsed independently.
 * The engine must handle multiple triggered abilities from the same source
 * firing from different events — each gets its own StackItem via
 * checkTriggeredAbilities (APNAP ordering, one StackItem per trigger).
 */
export function parseOracleText(oracleText: string, cardData: CardData): SpellAbility[] {
  if (!oracleText) return [];

  const abilities: SpellAbility[] = [];
  const normalized = oracleText.replace(new RegExp(escapeRegExp(cardData.name), "gi"), "~");
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);

  // First: check for linked ability pairs (ETB exile + LTB return)
  const linked = parseLinkedExileReturn(lines, cardData);
  if (linked) {
    let idx = 0;
    for (const ability of linked) {
      abilities.push({ ...ability, id: `${ability.id}_${idx}` });
      idx++;
    }
    // Don't double-parse the linked lines — but other lines may have additional abilities
    // We'll still parse non-linked lines below
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const suffix = i > 0 ? `_${i}` : "";

    // Skip keyword-only lines
    if (isKeywordLine(line)) continue;

    // Skip lines already handled by linked pair detection
    if (linked && (/enters the battlefield.*exile target/i.test(line) || /leaves the battlefield.*return/i.test(line))) continue;

    // Modal spells: "Choose one —"
    const modal = parseModalSpell(lines, i, cardData);
    if (modal) {
      abilities.push({ ...modal.ability, id: `parsed_modal${suffix}` });
      i += modal.linesConsumed - 1; // skip consumed lines
      continue;
    }

    // Mana abilities
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

    // Static abilities (anthems, can't be blocked, cost increase)
    const staticAbility = parseStaticAbilityLine(line);
    if (staticAbility) {
      abilities.push({ ...staticAbility, id: `parsed_static${suffix}` });
      continue;
    }

    // Activated abilities
    const activated = parseActivatedAbility(line, cardData);
    if (activated) {
      abilities.push({ ...activated, id: `parsed_activated${suffix}` });
      continue;
    }

    // Fallback: try parsing as a raw effect (for spell oracle text like "Destroy all creatures")
    const rawEffect = parseEffectText(line, cardData);
    if (rawEffect) {
      abilities.push({
        type: "spell" as const,
        id: `parsed_spell_effect${suffix}`,
        sourceCardInstanceId: null,
        effects: rawEffect.effects,
        zones: [ZoneType.Hand, ZoneType.Stack],
      });
      continue;
    }
  }

  return abilities;
}
