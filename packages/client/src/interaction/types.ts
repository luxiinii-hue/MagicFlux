import type { ResolvedTarget } from '@magic-flux/types';

export type InteractionMode = 'idle' | 'casting' | 'manualPay' | 'declareAttackers' | 'declareBlockers';

export interface IdleState { readonly mode: 'idle'; }

export interface CastingState {
  readonly mode: 'casting';
  readonly cardInstanceId: string;
  readonly selectedTargets: readonly ResolvedTarget[];
  readonly requiredTargetCount: number;
}

export interface ManualPayState {
  readonly mode: 'manualPay';
  readonly cardInstanceId: string;
  readonly selectedTargets: readonly ResolvedTarget[];
  readonly tappedLandIds: readonly string[];
}

export interface DeclareAttackersState {
  readonly mode: 'declareAttackers';
  readonly selectedAttackerIds: readonly string[];
}

export interface DeclareBlockersState {
  readonly mode: 'declareBlockers';
  readonly blockerAssignments: Readonly<Record<string, string>>; // blockerId → attackerId
  readonly pendingBlockerId: string | null;
}

export type InteractionState = IdleState | CastingState | ManualPayState | DeclareAttackersState | DeclareBlockersState;

export type InteractionAction =
  | { type: 'START_CASTING'; cardInstanceId: string; requiredTargetCount: number }
  | { type: 'START_MANUAL_PAY'; cardInstanceId: string; selectedTargets: readonly ResolvedTarget[] }
  | { type: 'SELECT_TARGET'; target: ResolvedTarget }
  | { type: 'DESELECT_TARGET'; targetId: string }
  | { type: 'TAP_LAND'; landInstanceId: string }
  | { type: 'UNTAP_LAND'; landInstanceId: string }
  | { type: 'ENTER_DECLARE_ATTACKERS' }
  | { type: 'TOGGLE_ATTACKER'; creatureInstanceId: string }
  | { type: 'ENTER_DECLARE_BLOCKERS' }
  | { type: 'START_ASSIGN_BLOCKER'; blockerInstanceId: string }
  | { type: 'ASSIGN_BLOCKER_TO_ATTACKER'; attackerInstanceId: string }
  | { type: 'UNASSIGN_BLOCKER'; blockerInstanceId: string }
  | { type: 'CANCEL' };

export const IDLE_STATE: IdleState = { mode: 'idle' };
