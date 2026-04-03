import { describe, it, expect } from 'vitest';
import type { ResolvedTarget } from '@magic-flux/types';
import { interactionReducer } from '../../src/interaction/state-machine';
import type {
  InteractionState,
  CastingState,
  ManualPayState,
  DeclareAttackersState,
  DeclareBlockersState,
} from '../../src/interaction/types';
import { IDLE_STATE } from '../../src/interaction/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTarget(id: string, type: 'card' | 'player' = 'card'): ResolvedTarget {
  return { requirementId: `req-${id}`, targetId: id, targetType: type };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('interactionReducer', () => {
  // ---- Initial / idle state -----------------------------------------------

  it('starts in idle', () => {
    expect(IDLE_STATE).toEqual({ mode: 'idle' });
  });

  // ---- idle → casting -----------------------------------------------------

  it('transitions idle → casting on START_CASTING', () => {
    const next = interactionReducer(IDLE_STATE, {
      type: 'START_CASTING',
      cardInstanceId: 'card-1',
      requiredTargetCount: 2,
    });
    expect(next).toEqual({
      mode: 'casting',
      cardInstanceId: 'card-1',
      selectedTargets: [],
      requiredTargetCount: 2,
    });
  });

  // ---- casting: add / remove targets --------------------------------------

  describe('casting mode', () => {
    const castingBase: CastingState = {
      mode: 'casting',
      cardInstanceId: 'card-1',
      selectedTargets: [],
      requiredTargetCount: 2,
    };

    it('appends a target with SELECT_TARGET', () => {
      const target = makeTarget('creature-1');
      const next = interactionReducer(castingBase, {
        type: 'SELECT_TARGET',
        target,
      });
      expect(next.mode).toBe('casting');
      expect((next as CastingState).selectedTargets).toEqual([target]);
    });

    it('appends multiple targets in sequence', () => {
      const t1 = makeTarget('creature-1');
      const t2 = makeTarget('player-1', 'player');
      let state: InteractionState = castingBase;
      state = interactionReducer(state, { type: 'SELECT_TARGET', target: t1 });
      state = interactionReducer(state, { type: 'SELECT_TARGET', target: t2 });
      expect((state as CastingState).selectedTargets).toEqual([t1, t2]);
    });

    it('removes a target with DESELECT_TARGET', () => {
      const t1 = makeTarget('creature-1');
      const t2 = makeTarget('creature-2');
      const withTargets: CastingState = {
        ...castingBase,
        selectedTargets: [t1, t2],
      };
      const next = interactionReducer(withTargets, {
        type: 'DESELECT_TARGET',
        targetId: 'creature-1',
      });
      expect((next as CastingState).selectedTargets).toEqual([t2]);
    });

    it('transitions casting → manualPay on START_MANUAL_PAY', () => {
      const target = makeTarget('creature-1');
      const withTarget: CastingState = {
        ...castingBase,
        selectedTargets: [target],
      };
      const next = interactionReducer(withTarget, {
        type: 'START_MANUAL_PAY',
        cardInstanceId: 'card-1',
        selectedTargets: [target],
      });
      expect(next).toEqual({
        mode: 'manualPay',
        cardInstanceId: 'card-1',
        selectedTargets: [target],
        tappedLandIds: [],
      });
    });

    it('ignores non-applicable actions', () => {
      const next = interactionReducer(castingBase, {
        type: 'TAP_LAND',
        landInstanceId: 'land-1',
      });
      expect(next).toBe(castingBase);
    });
  });

  // ---- manualPay: tap / untap lands ---------------------------------------

  describe('manualPay mode', () => {
    const manualPayBase: ManualPayState = {
      mode: 'manualPay',
      cardInstanceId: 'card-1',
      selectedTargets: [makeTarget('creature-1')],
      tappedLandIds: [],
    };

    it('adds a land with TAP_LAND', () => {
      const next = interactionReducer(manualPayBase, {
        type: 'TAP_LAND',
        landInstanceId: 'land-1',
      });
      expect((next as ManualPayState).tappedLandIds).toEqual(['land-1']);
    });

    it('prevents duplicate tapped lands', () => {
      const withLand: ManualPayState = {
        ...manualPayBase,
        tappedLandIds: ['land-1'],
      };
      const next = interactionReducer(withLand, {
        type: 'TAP_LAND',
        landInstanceId: 'land-1',
      });
      // Should return the same reference — no change.
      expect(next).toBe(withLand);
      expect((next as ManualPayState).tappedLandIds).toEqual(['land-1']);
    });

    it('removes a land with UNTAP_LAND', () => {
      const withLands: ManualPayState = {
        ...manualPayBase,
        tappedLandIds: ['land-1', 'land-2'],
      };
      const next = interactionReducer(withLands, {
        type: 'UNTAP_LAND',
        landInstanceId: 'land-1',
      });
      expect((next as ManualPayState).tappedLandIds).toEqual(['land-2']);
    });

    it('ignores non-applicable actions', () => {
      const next = interactionReducer(manualPayBase, {
        type: 'TOGGLE_ATTACKER',
        creatureInstanceId: 'c-1',
      });
      expect(next).toBe(manualPayBase);
    });
  });

  // ---- CANCEL from any state → idle --------------------------------------

  describe('CANCEL', () => {
    it('returns to idle from casting', () => {
      const casting: CastingState = {
        mode: 'casting',
        cardInstanceId: 'card-1',
        selectedTargets: [makeTarget('x')],
        requiredTargetCount: 1,
      };
      expect(interactionReducer(casting, { type: 'CANCEL' })).toEqual(IDLE_STATE);
    });

    it('returns to idle from manualPay', () => {
      const paying: ManualPayState = {
        mode: 'manualPay',
        cardInstanceId: 'card-1',
        selectedTargets: [],
        tappedLandIds: ['land-1'],
      };
      expect(interactionReducer(paying, { type: 'CANCEL' })).toEqual(IDLE_STATE);
    });

    it('returns to idle from declareAttackers', () => {
      const attacking: DeclareAttackersState = {
        mode: 'declareAttackers',
        selectedAttackerIds: ['c-1'],
      };
      expect(interactionReducer(attacking, { type: 'CANCEL' })).toEqual(IDLE_STATE);
    });

    it('returns to idle from declareBlockers', () => {
      const blocking: DeclareBlockersState = {
        mode: 'declareBlockers',
        blockerAssignments: { 'b-1': 'a-1' },
        pendingBlockerId: null,
      };
      expect(interactionReducer(blocking, { type: 'CANCEL' })).toEqual(IDLE_STATE);
    });

    it('stays idle when already idle', () => {
      expect(interactionReducer(IDLE_STATE, { type: 'CANCEL' })).toEqual(IDLE_STATE);
    });
  });

  // ---- idle → declareAttackers, toggling ----------------------------------

  describe('declareAttackers mode', () => {
    it('enters declareAttackers from idle', () => {
      const next = interactionReducer(IDLE_STATE, {
        type: 'ENTER_DECLARE_ATTACKERS',
      });
      expect(next).toEqual({
        mode: 'declareAttackers',
        selectedAttackerIds: [],
      });
    });

    it('toggles an attacker ON', () => {
      const base: DeclareAttackersState = {
        mode: 'declareAttackers',
        selectedAttackerIds: [],
      };
      const next = interactionReducer(base, {
        type: 'TOGGLE_ATTACKER',
        creatureInstanceId: 'c-1',
      });
      expect((next as DeclareAttackersState).selectedAttackerIds).toEqual(['c-1']);
    });

    it('toggles an attacker OFF', () => {
      const base: DeclareAttackersState = {
        mode: 'declareAttackers',
        selectedAttackerIds: ['c-1', 'c-2'],
      };
      const next = interactionReducer(base, {
        type: 'TOGGLE_ATTACKER',
        creatureInstanceId: 'c-1',
      });
      expect((next as DeclareAttackersState).selectedAttackerIds).toEqual(['c-2']);
    });

    it('ignores non-applicable actions', () => {
      const base: DeclareAttackersState = {
        mode: 'declareAttackers',
        selectedAttackerIds: ['c-1'],
      };
      const next = interactionReducer(base, {
        type: 'SELECT_TARGET',
        target: makeTarget('x'),
      });
      expect(next).toBe(base);
    });
  });

  // ---- idle → declareBlockers, two-click assignment -----------------------

  describe('declareBlockers mode', () => {
    it('enters declareBlockers from idle', () => {
      const next = interactionReducer(IDLE_STATE, {
        type: 'ENTER_DECLARE_BLOCKERS',
      });
      expect(next).toEqual({
        mode: 'declareBlockers',
        blockerAssignments: {},
        pendingBlockerId: null,
      });
    });

    it('sets pendingBlockerId on START_ASSIGN_BLOCKER', () => {
      const base: DeclareBlockersState = {
        mode: 'declareBlockers',
        blockerAssignments: {},
        pendingBlockerId: null,
      };
      const next = interactionReducer(base, {
        type: 'START_ASSIGN_BLOCKER',
        blockerInstanceId: 'b-1',
      });
      expect((next as DeclareBlockersState).pendingBlockerId).toBe('b-1');
    });

    it('assigns blocker to attacker with two-click flow', () => {
      let state: InteractionState = {
        mode: 'declareBlockers',
        blockerAssignments: {},
        pendingBlockerId: null,
      };
      // Click 1: select the blocker.
      state = interactionReducer(state, {
        type: 'START_ASSIGN_BLOCKER',
        blockerInstanceId: 'b-1',
      });
      // Click 2: select the attacker.
      state = interactionReducer(state, {
        type: 'ASSIGN_BLOCKER_TO_ATTACKER',
        attackerInstanceId: 'a-1',
      });
      const s = state as DeclareBlockersState;
      expect(s.blockerAssignments).toEqual({ 'b-1': 'a-1' });
      expect(s.pendingBlockerId).toBeNull();
    });

    it('reassigns a blocker to a different attacker', () => {
      let state: InteractionState = {
        mode: 'declareBlockers',
        blockerAssignments: { 'b-1': 'a-1' },
        pendingBlockerId: null,
      };
      // Select the same blocker again.
      state = interactionReducer(state, {
        type: 'START_ASSIGN_BLOCKER',
        blockerInstanceId: 'b-1',
      });
      // Assign to a different attacker.
      state = interactionReducer(state, {
        type: 'ASSIGN_BLOCKER_TO_ATTACKER',
        attackerInstanceId: 'a-2',
      });
      expect((state as DeclareBlockersState).blockerAssignments).toEqual({
        'b-1': 'a-2',
      });
    });

    it('unassigns a blocker', () => {
      const base: DeclareBlockersState = {
        mode: 'declareBlockers',
        blockerAssignments: { 'b-1': 'a-1', 'b-2': 'a-2' },
        pendingBlockerId: null,
      };
      const next = interactionReducer(base, {
        type: 'UNASSIGN_BLOCKER',
        blockerInstanceId: 'b-1',
      });
      expect((next as DeclareBlockersState).blockerAssignments).toEqual({
        'b-2': 'a-2',
      });
    });

    it('clears pendingBlockerId when unassigning the pending blocker', () => {
      const base: DeclareBlockersState = {
        mode: 'declareBlockers',
        blockerAssignments: { 'b-1': 'a-1' },
        pendingBlockerId: 'b-1',
      };
      const next = interactionReducer(base, {
        type: 'UNASSIGN_BLOCKER',
        blockerInstanceId: 'b-1',
      });
      const s = next as DeclareBlockersState;
      expect(s.blockerAssignments).toEqual({});
      expect(s.pendingBlockerId).toBeNull();
    });

    it('ignores ASSIGN_BLOCKER_TO_ATTACKER when no pending blocker', () => {
      const base: DeclareBlockersState = {
        mode: 'declareBlockers',
        blockerAssignments: {},
        pendingBlockerId: null,
      };
      const next = interactionReducer(base, {
        type: 'ASSIGN_BLOCKER_TO_ATTACKER',
        attackerInstanceId: 'a-1',
      });
      expect(next).toBe(base);
    });

    it('ignores non-applicable actions', () => {
      const base: DeclareBlockersState = {
        mode: 'declareBlockers',
        blockerAssignments: {},
        pendingBlockerId: null,
      };
      const next = interactionReducer(base, {
        type: 'TAP_LAND',
        landInstanceId: 'land-1',
      });
      expect(next).toBe(base);
    });
  });

  // ---- Non-applicable actions on idle -------------------------------------

  describe('non-applicable actions in idle', () => {
    it('ignores SELECT_TARGET in idle', () => {
      const next = interactionReducer(IDLE_STATE, {
        type: 'SELECT_TARGET',
        target: makeTarget('x'),
      });
      expect(next).toEqual(IDLE_STATE);
    });

    it('ignores TOGGLE_ATTACKER in idle', () => {
      const next = interactionReducer(IDLE_STATE, {
        type: 'TOGGLE_ATTACKER',
        creatureInstanceId: 'c-1',
      });
      expect(next).toEqual(IDLE_STATE);
    });

    it('ignores TAP_LAND in idle', () => {
      const next = interactionReducer(IDLE_STATE, {
        type: 'TAP_LAND',
        landInstanceId: 'land-1',
      });
      expect(next).toEqual(IDLE_STATE);
    });
  });
});
