/**
 * Dark Ritual — {B} Instant
 * Add {B}{B}{B}.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function darkRitualOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "dark_ritual_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "addMana",
          mana: { W: 0, U: 0, B: 3, R: 0, G: 0, C: 0 },
          player: { type: "controller" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}
