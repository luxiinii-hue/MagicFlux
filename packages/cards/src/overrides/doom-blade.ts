/**
 * Doom Blade — {1}{B} Instant
 * Destroy target nonblack creature.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function doomBladeOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "doom_blade_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "destroy",
          target: { targetRequirementId: "target_nonblack_creature" },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Doom Blade's spell ability. */
export const doomBladeTargets = [
  {
    id: "target_nonblack_creature",
    description: "target nonblack creature",
    count: { exactly: 1 } as const,
    targetTypes: ["creature"] as const,
    filter: { colorsNot: ["B"] as const },
    controller: "any" as const,
  },
];
