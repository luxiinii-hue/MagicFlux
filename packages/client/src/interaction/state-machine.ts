import type { InteractionState, InteractionAction } from './types';
import { IDLE_STATE } from './types';

export function interactionReducer(
  state: InteractionState,
  action: InteractionAction,
): InteractionState {
  // CANCEL always returns to idle, regardless of current state.
  if (action.type === 'CANCEL') {
    return IDLE_STATE;
  }

  switch (state.mode) {
    case 'idle':
      return reduceIdle(action);

    case 'casting':
      return reduceCasting(state, action);

    case 'manualPay':
      return reduceManualPay(state, action);

    case 'declareAttackers':
      return reduceDeclareAttackers(state, action);

    case 'declareBlockers':
      return reduceDeclareBlockers(state, action);
  }
}

function reduceIdle(action: InteractionAction): InteractionState {
  switch (action.type) {
    case 'START_CASTING':
      return {
        mode: 'casting',
        cardInstanceId: action.cardInstanceId,
        selectedTargets: [],
        requiredTargetCount: action.requiredTargetCount,
      };

    case 'ENTER_DECLARE_ATTACKERS':
      return {
        mode: 'declareAttackers',
        selectedAttackerIds: [],
      };

    case 'ENTER_DECLARE_BLOCKERS':
      return {
        mode: 'declareBlockers',
        blockerAssignments: {},
        pendingBlockerId: null,
      };

    default:
      return IDLE_STATE;
  }
}

function reduceCasting(
  state: InteractionState & { mode: 'casting' },
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case 'SELECT_TARGET':
      return {
        ...state,
        selectedTargets: [...state.selectedTargets, action.target],
      };

    case 'DESELECT_TARGET':
      return {
        ...state,
        selectedTargets: state.selectedTargets.filter(
          (t) => t.targetId !== action.targetId,
        ),
      };

    case 'START_MANUAL_PAY':
      return {
        mode: 'manualPay',
        cardInstanceId: state.cardInstanceId,
        selectedTargets: state.selectedTargets,
        tappedLandIds: [],
      };

    default:
      return state;
  }
}

function reduceManualPay(
  state: InteractionState & { mode: 'manualPay' },
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case 'TAP_LAND':
      // No duplicates.
      if (state.tappedLandIds.includes(action.landInstanceId)) {
        return state;
      }
      return {
        ...state,
        tappedLandIds: [...state.tappedLandIds, action.landInstanceId],
      };

    case 'UNTAP_LAND':
      return {
        ...state,
        tappedLandIds: state.tappedLandIds.filter(
          (id) => id !== action.landInstanceId,
        ),
      };

    default:
      return state;
  }
}

function reduceDeclareAttackers(
  state: InteractionState & { mode: 'declareAttackers' },
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case 'TOGGLE_ATTACKER': {
      const id = action.creatureInstanceId;
      const isSelected = state.selectedAttackerIds.includes(id);
      return {
        ...state,
        selectedAttackerIds: isSelected
          ? state.selectedAttackerIds.filter((aid) => aid !== id)
          : [...state.selectedAttackerIds, id],
      };
    }

    default:
      return state;
  }
}

function reduceDeclareBlockers(
  state: InteractionState & { mode: 'declareBlockers' },
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case 'START_ASSIGN_BLOCKER':
      return {
        ...state,
        pendingBlockerId: action.blockerInstanceId,
      };

    case 'ASSIGN_BLOCKER_TO_ATTACKER': {
      if (state.pendingBlockerId === null) {
        return state;
      }
      return {
        ...state,
        blockerAssignments: {
          ...state.blockerAssignments,
          [state.pendingBlockerId]: action.attackerInstanceId,
        },
        pendingBlockerId: null,
      };
    }

    case 'UNASSIGN_BLOCKER': {
      const { [action.blockerInstanceId]: _, ...rest } = state.blockerAssignments;
      return {
        ...state,
        blockerAssignments: rest,
        // Clear pendingBlockerId if the unassigned blocker was the pending one.
        pendingBlockerId:
          state.pendingBlockerId === action.blockerInstanceId
            ? null
            : state.pendingBlockerId,
      };
    }

    default:
      return state;
  }
}
