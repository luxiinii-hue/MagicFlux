/**
 * Basic land overrides — Plains, Island, Swamp, Mountain, Forest.
 *
 * Each basic land has a single mana ability: "{T}: Add {color}."
 * These are mana abilities (resolve immediately, don't use the stack).
 */

import type { SpellAbility, ManaColor } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

function makeLandManaAbility(landName: string, color: ManaColor): SpellAbility[] {
  const mana = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  mana[color] = 1;

  return [
    {
      type: "mana",
      id: `${landName.toLowerCase()}_tap`,
      sourceCardInstanceId: null,
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
      effects: [
        {
          type: "addMana",
          mana: { ...mana },
          player: { type: "controller" },
        },
      ],
      zones: [ZoneType.Battlefield],
    },
  ];
}

export function plainsOverride(): SpellAbility[] {
  return makeLandManaAbility("Plains", "W");
}

export function islandOverride(): SpellAbility[] {
  return makeLandManaAbility("Island", "U");
}

export function swampOverride(): SpellAbility[] {
  return makeLandManaAbility("Swamp", "B");
}

export function mountainOverride(): SpellAbility[] {
  return makeLandManaAbility("Mountain", "R");
}

export function forestOverride(): SpellAbility[] {
  return makeLandManaAbility("Forest", "G");
}
