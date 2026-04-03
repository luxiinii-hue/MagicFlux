/**
 * Divination — {2}{U} Sorcery
 * Draw two cards.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function divinationOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "divination_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "drawCards",
          count: 2,
          player: { type: "controller" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}
