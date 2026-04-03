/**
 * Ancestral Recall — {U} Instant
 * Target player draws 3 cards.
 */

import type { SpellAbility } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

export function ancestralRecallOverride(): SpellAbility[] {
  return [
    {
      type: "spell",
      id: "ancestral_recall_spell",
      sourceCardInstanceId: null,
      effects: [
        {
          type: "drawCards",
          count: 3,
          player: { type: "targetPlayer", targetRef: { targetRequirementId: "target_player" } },
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    },
  ];
}

/** Target requirements for Ancestral Recall's spell ability. */
export const ancestralRecallTargets = [
  {
    id: "target_player",
    description: "target player",
    count: { exactly: 1 } as const,
    targetTypes: ["player"] as const,
    filter: null,
    controller: "any" as const,
  },
];
