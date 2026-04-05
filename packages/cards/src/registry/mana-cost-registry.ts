/**
 * Mana cost registry — maps card names to their parsed ManaCost.
 *
 * This is the bridge between the cards package (which knows card costs)
 * and the server (which needs costs for casting enforcement).
 * Costs are registered alongside overrides and looked up by card name.
 */

import type { ManaCost } from "@magic-flux/types";
import { parseManaCost } from "../parser/cost-parser.js";

const costRegistry = new Map<string, ManaCost>();

/** Register a card's mana cost. Called during override registration. */
export function registerManaCost(name: string, manaCostString: string): void {
  costRegistry.set(name.toLowerCase(), parseManaCost(manaCostString));
}

/** Look up a card's mana cost by name (case-insensitive). */
export function getRegisteredManaCost(name: string): ManaCost | null {
  return costRegistry.get(name.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Register costs for all known cards
// ---------------------------------------------------------------------------

// Basic lands (no cost — they're played, not cast)
// No registration needed

// Phase 2 core instants/sorceries
registerManaCost("Lightning Bolt", "{R}");
registerManaCost("Counterspell", "{U}{U}");
registerManaCost("Giant Growth", "{G}");
registerManaCost("Shock", "{R}");
registerManaCost("Dark Ritual", "{B}");
registerManaCost("Doom Blade", "{1}{B}");
registerManaCost("Healing Salve", "{W}");
registerManaCost("Ancestral Recall", "{U}");
registerManaCost("Naturalize", "{1}{G}");
registerManaCost("Divination", "{2}{U}");

// Phase 3 creatures — keyword creatures
registerManaCost("Grizzly Bears", "{1}{G}");
registerManaCost("Serra Angel", "{3}{W}{W}");
registerManaCost("Llanowar Elves", "{G}");
registerManaCost("Goblin Guide", "{R}");
registerManaCost("Giant Spider", "{3}{G}");
registerManaCost("Air Elemental", "{3}{U}{U}");
registerManaCost("Vampire Nighthawk", "{1}{B}{B}");
registerManaCost("Monastery Swiftspear", "{R}");
registerManaCost("Savannah Lions", "{W}");
registerManaCost("Elvish Mystic", "{G}");

// Phase 3 creatures — advanced
registerManaCost("Wall of Omens", "{1}{W}");
registerManaCost("Mother of Runes", "{W}");
registerManaCost("Baneslayer Angel", "{3}{W}{W}");
registerManaCost("Snapcaster Mage", "{1}{U}");
registerManaCost("Delver of Secrets", "{U}");
registerManaCost("Man-o'-War", "{2}{U}");
registerManaCost("Nether Spirit", "{1}{B}{B}");
registerManaCost("Dark Confidant", "{1}{B}");
registerManaCost("Dread Shade", "{B}{B}{B}");
registerManaCost("Lightning Mauler", "{1}{R}");
registerManaCost("Ball Lightning", "{R}{R}{R}");
registerManaCost("Ember Hauler", "{R}{R}");
registerManaCost("Tarmogoyf", "{1}{G}");
registerManaCost("Sylvan Caryatid", "{1}{G}");
registerManaCost("Leatherback Baloth", "{G}{G}{G}");
registerManaCost("Kalonian Tusker", "{G}{G}");
registerManaCost("Courser of Kruphix", "{1}{G}{G}");
registerManaCost("Geist of Saint Traft", "{1}{W}{U}");
registerManaCost("Kitchen Finks", "{1}{G/W}{G/W}");
registerManaCost("Bloodbraid Elf", "{2}{R}{G}");

// Vanilla creatures
registerManaCost("Elvish Visionary", "{1}{G}");
registerManaCost("Flametongue Kavu", "{3}{R}");
registerManaCost("Acidic Slime", "{3}{G}{G}");
registerManaCost("Mulldrifter", "{4}{U}");
registerManaCost("Ravenous Chupacabra", "{2}{B}{B}");

// Enchantments/artifacts
registerManaCost("Oblivion Ring", "{2}{W}");
registerManaCost("Pacifism", "{1}{W}");
registerManaCost("Lightning Greaves", "{2}");
registerManaCost("Sol Ring", "{1}");
registerManaCost("Bonesplitter", "{1}");

// Sprint aggro
registerManaCost("Monastery Mentor", "{2}{W}");
registerManaCost("Young Pyromancer", "{1}{R}");
registerManaCost("Goblin Rabblemaster", "{2}{R}");
registerManaCost("Zurgo Bellstriker", "{R}");
registerManaCost("Figure of Destiny", "{R/W}");
registerManaCost("Ahn-Crop Crasher", "{2}{R}");
registerManaCost("Falkenrath Gorger", "{R}");
registerManaCost("Reckless Bushwhacker", "{1}{R}");
registerManaCost("Chain Lightning", "{R}");
registerManaCost("Lava Spike", "{R}");
registerManaCost("Rift Bolt", "{2}{R}");
registerManaCost("Skullcrack", "{1}{R}");
registerManaCost("Searing Blaze", "{R}{R}");
registerManaCost("Brimstone Volley", "{2}{R}");
registerManaCost("Stoke the Flames", "{2}{R}{R}");
registerManaCost("Exquisite Firecraft", "{1}{R}{R}");
registerManaCost("Thalia, Guardian of Thraben", "{1}{W}");
registerManaCost("Eidolon of the Great Revel", "{R}{R}");

// Sprint control
registerManaCost("Supreme Verdict", "{1}{W}{W}{U}");
registerManaCost("Damnation", "{2}{B}{B}");
registerManaCost("Cryptic Command", "{1}{U}{U}{U}");
registerManaCost("Force of Will", "{3}{U}{U}");
registerManaCost("Remand", "{1}{U}");
registerManaCost("Jace, the Mind Sculptor", "{2}{U}{U}");
registerManaCost("Liliana of the Veil", "{1}{B}{B}");
registerManaCost("Fact or Fiction", "{3}{U}");
registerManaCost("Dig Through Time", "{6}{U}{U}");
registerManaCost("Treasure Cruise", "{7}{U}");
registerManaCost("Lingering Souls", "{2}{W}");
registerManaCost("Collective Brutality", "{1}{B}");
registerManaCost("Detention Sphere", "{1}{W}{U}");
registerManaCost("Think Twice", "{1}{U}");
registerManaCost("Sphinx's Revelation", "{X}{W}{U}{U}");

// Sprint midrange
registerManaCost("Siege Rhino", "{1}{W}{B}{G}");
registerManaCost("Thragtusk", "{4}{G}");
registerManaCost("Restoration Angel", "{3}{W}");
registerManaCost("Scavenging Ooze", "{1}{G}");
registerManaCost("Tireless Tracker", "{2}{G}");
registerManaCost("Eternal Witness", "{1}{G}{G}");
registerManaCost("Voice of Resurgence", "{G}{W}");
registerManaCost("Walking Ballista", "{X}{X}");
registerManaCost("Hangarback Walker", "{X}{X}");
registerManaCost("Aether Vial", "{1}");
registerManaCost("Chromatic Star", "{1}");
registerManaCost("Rancor", "{G}");
registerManaCost("Expedition Map", "{1}");
registerManaCost("Cultivate", "{2}{G}");
registerManaCost("Farseek", "{1}{G}");
registerManaCost("Rampant Growth", "{1}{G}");
registerManaCost("Beast Within", "{2}{G}");
registerManaCost("Dismember", "{1}{B/P}{B/P}");

// Standard instants
registerManaCost("Swords to Plowshares", "{W}");
registerManaCost("Path to Exile", "{W}");
registerManaCost("Terminate", "{B}{R}");
registerManaCost("Murder", "{1}{B}{B}");
registerManaCost("Flame Slash", "{R}");
registerManaCost("Vindicate", "{1}{W}{B}");
registerManaCost("Maelstrom Pulse", "{1}{B}{G}");
registerManaCost("Abrupt Decay", "{B}{G}");
registerManaCost("Mana Leak", "{1}{U}");
registerManaCost("Negate", "{1}{U}");
registerManaCost("Spell Pierce", "{U}");
registerManaCost("Preordain", "{U}");
registerManaCost("Ponder", "{U}");
registerManaCost("Brainstorm", "{U}");
registerManaCost("Opt", "{U}");
registerManaCost("Consider", "{U}");
registerManaCost("Thoughtseize", "{B}");
registerManaCost("Duress", "{B}");
registerManaCost("Hymn to Tourach", "{B}{B}");
registerManaCost("Incinerate", "{1}{R}");
registerManaCost("Lightning Helix", "{R}{W}");
registerManaCost("Boros Charm", "{R}{W}");
registerManaCost("Collected Company", "{3}{G}");

// New effect cards
registerManaCost("Raise the Alarm", "{1}{W}");
registerManaCost("Dragon Fodder", "{1}{R}");
registerManaCost("Spectral Procession", "{2/W}{2/W}{2/W}");
registerManaCost("Sakura-Tribe Elder", "{1}{G}");
registerManaCost("Village Rites", "{B}");
registerManaCost("Viscera Seer", "{B}");
registerManaCost("Luminarch Aspirant", "{1}{W}");
registerManaCost("Champion of the Parish", "{W}");
registerManaCost("Fireball", "{X}{R}");
