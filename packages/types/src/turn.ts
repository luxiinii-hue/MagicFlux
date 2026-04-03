/**
 * Turn structure types for Magic: The Gathering.
 *
 * Phase/Step progression:
 * 1. Beginning Phase: Untap -> Upkeep -> Draw
 * 2. Pre-combat Main Phase (no steps)
 * 3. Combat Phase: BeginningOfCombat -> DeclareAttackers -> DeclareBlockers
 *    -> [FirstStrikeDamage] -> CombatDamage -> EndOfCombat
 * 4. Post-combat Main Phase (no steps)
 * 5. Ending Phase: EndStep -> Cleanup
 *
 * Main phases have no steps -- they are a single priority window.
 * FirstStrikeDamage only exists when a creature with first/double strike is in combat.
 */

/** The five turn phases. */
export enum Phase {
  Beginning = "Beginning",
  PreCombatMain = "PreCombatMain",
  Combat = "Combat",
  PostCombatMain = "PostCombatMain",
  Ending = "Ending",
}

/** Steps within phases. Not all phases have steps (main phases do not). */
export enum Step {
  // Beginning phase
  Untap = "Untap",
  Upkeep = "Upkeep",
  Draw = "Draw",

  // Combat phase
  BeginningOfCombat = "BeginningOfCombat",
  DeclareAttackers = "DeclareAttackers",
  DeclareBlockers = "DeclareBlockers",
  FirstStrikeDamage = "FirstStrikeDamage",
  CombatDamage = "CombatDamage",
  EndOfCombat = "EndOfCombat",

  // Ending phase
  EndStep = "EndStep",
  Cleanup = "Cleanup",
}

/**
 * Tracks the current position within the turn.
 */
export interface TurnState {
  /** 1-indexed turn number. */
  readonly turnNumber: number;
  /** Whose turn it is. */
  readonly activePlayerId: string;
  /** Current phase. */
  readonly phase: Phase;
  /** Current step, or null for main phases. */
  readonly step: Step | null;
  /** Prevents re-declaring attackers within the same combat. */
  readonly hasDeclaredAttackers: boolean;
  /** Prevents re-declaring blockers within the same combat. */
  readonly hasDeclaredBlockers: boolean;
  /**
   * Player IDs who have passed priority without acting since the last game
   * action. When this array's length equals the number of active players,
   * the top of the stack resolves (if non-empty) or the game advances.
   */
  readonly priorityPassedWithoutAction: readonly string[];
}
