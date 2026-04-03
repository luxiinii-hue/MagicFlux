# Magic Flux Client Phase C — Interaction Layer Design Spec

**Date:** 2026-04-03
**Owner:** UI/Renderer worker
**Package:** `Magic Flux/packages/client/`
**Depends on:** Phase A+B (complete), `@magic-flux/types` Phase 1-3 types (complete)

## Overview

Transform the static game display into an interactive, playable experience. A mock game loop simulates server responses so the full cast/combat/priority flow works without a real server. Animation system provides fluid card movement and visual feedback, with architecture prepared for Phase 5 polish (particles, screen shake).

## Interaction State Machine

All player interaction flows through a single state machine stored in the Zustand store.

### States

- **`idle`** — Default. Pass priority button active. Click card in hand to start casting. No special click behavior on battlefield.
- **`casting`** — Player clicked a castable card in hand. Legal targets highlighted with blue pulse. Click targets to select them. When all required targets chosen: auto-pay mana (or manual pay if toggled off) then dispatch `castSpell`. Targeting line drawn from source card to cursor.
- **`manualPay`** — Variant of casting entered via Shift+click or when auto-pay is OFF. Player must tap lands to generate mana before confirming the spell. Cast button enables when cost is met.
- **`declareAttackers`** — Entered when game reaches declare attackers step and player has priority. Click or drag creatures to toggle as attackers. Gold glow + 20px upward shift on selected attackers. Confirm button visible. Eligible creatures (untapped, no summoning sickness, not defender) get subtle green border pulse.
- **`declareBlockers`** — Entered when game reaches declare blockers step. Click your creature then click the attacker to assign a block, OR drag creature onto attacker. Arrow/line connects blocker to attacker. Drag to reassign — pick up a blocker and drop on a different attacker, or drop on empty space to unassign. Confirm button visible.

### Transitions

- **Escape / right-click** from any non-idle state → returns to `idle`, clears all selections.
- **Confirm** in attackers/blockers → dispatches action, returns to `idle`.
- **Auto-pay resolves** or **manual pay confirmed** in casting → dispatches `castSpell`, returns to `idle`.
- **Play land** (click land in hand when `playLand` is legal) → dispatches immediately, no intermediate state.
- **Pass priority** (button or spacebar) → dispatches `passPriority` from `idle`.

### Files

- `src/interaction/state-machine.ts` — State definitions, transition logic, action creators. Pure functions, no React.
- `src/interaction/targeting.ts` — Target validation against `TargetRequirement`. Computes legal targets from `ClientGameState` + `legalActions`.
- `src/interaction/combat-ui.ts` — Attacker/blocker selection logic. Tracks assignments as `Record<attackerId, blockerId[]>`.
- `src/interaction/mana-payment.ts` — Auto-pay algorithm (greedy: pay colored costs first from matching lands, generic costs from any remaining). Manual pay state tracking.
- `src/interaction/actions.ts` — Dispatches `PlayerAction` to the active `GameConnection`. Bridges interaction state machine → connection layer.

## Combat Interaction: Hybrid Click + Drag

### Declare Attackers

- Eligible creatures get green border pulse on entering the step.
- **Click** a creature to toggle it as an attacker. Gold glow + shift upward 20px.
- **Drag** a creature toward opponent side — snaps into attacker state on release if eligible.
- Click again to deselect. Creature returns to normal position.
- "Confirm Attackers" button in the PriorityBar area. Also confirmable via Enter key.
- "No Attackers" button to skip (equivalent to empty attacker set).

### Declare Blockers

- Attacking creatures shown shifted forward with gold glow on opponent's side.
- Eligible blockers (untapped creatures you control) get green border pulse.
- **Click** your creature, then **click** the attacker it blocks. Line/arrow appears connecting them.
- **Drag** your creature onto an attacker to assign the block. Drop on empty space to unassign.
- **Reassign:** Drag an already-assigned blocker off its current attacker onto a different one. The old assignment clears, new one forms. This is critical for the "shuffling blockers while thinking" experience.
- Multiple blockers can be assigned to one attacker (for menace, gang-blocking).
- "Confirm Blockers" button + Enter key.

### Visual Indicators

- Attack arrows: gold dashed line from attacker to defending player area.
- Block lines: red solid line from blocker to attacker.
- Damage preview: after blockers confirmed, before combat damage, show floating damage numbers on creatures that will take lethal (red text) or survivable damage (white text).

## Spell Casting: Smart Hybrid Auto-Pay

### Default Flow (auto-pay ON)

1. Player clicks a castable card in hand (identified by matching `cardInstanceId` in `legalActions` where `type === 'castSpell'`).
2. If the spell has targets: legal targets highlighted with blue pulse, rest of board dims slightly. Targeting line follows cursor. Click target(s) to select.
3. If the spell has no targets: skip to step 4.
4. Auto-pay algorithm selects lands to tap. Mana deducted from pool. Spell dispatched as `castSpell` action.

### Manual Pay Override

- **Global toggle:** Settings panel toggle "Auto-pay mana: ON/OFF". Persisted to `localStorage`. Shown in a settings gear menu on the top bar.
- **Per-spell override:** Hold Shift when clicking a card to enter manual pay mode regardless of toggle.
- **Manual flow:** After target selection (or immediately for no-target spells), enter `manualPay` state. Player clicks lands to tap them. Mana pool updates live. "Cast" button enables when cost is met. "Cancel" button returns to idle.

### Floating Mana

If the player taps lands manually before clicking a card in hand (generating floating mana), those mana are in the pool already. Auto-pay uses pool mana first, only tapping additional lands if needed.

### Auto-Pay Algorithm

Greedy approach, sufficient for basic and most multi-color mana bases:
1. Check mana already in pool. Assign pool mana to colored costs first (exact color match).
2. For remaining colored costs, find untapped lands that produce that color. Tap them.
3. For generic costs, tap any remaining untapped lands.
4. If cost cannot be met, don't dispatch (button stays disabled — this shouldn't happen since `legalActions` already validated castability).

### Play Land

Single click on a playable land in hand. No targets, no mana, no intermediate state. Dispatches `playLand` immediately. Card animates from hand to battlefield.

## Animation System

### Architecture

```
AnimationProvider (React context at App level)
├── CardPositionRegistry — tracks DOM positions of all card elements
├── useCardPosition(instanceId) — ref callback, registers element position
├── useAnimateTransition(instanceId) — FLIP animation on zone change
├── AnimationOverlay — absolutely positioned layer for lines/arrows/floating text
│    ├── Targeting lines (dashed, source card → cursor)
│    ├── Attack arrows (gold, attacker → defending player)
│    ├── Block lines (red, blocker → attacker)
│    ├── Floating damage numbers ("-3" floats up and fades)
│    └── [Future: particle emitters, screen shake hook]
└── useAnimationSettings() — reads speed preference from localStorage
```

### FLIP Card Movement

When `ClientGameState` updates and a card changes zones:
1. **First:** Before React re-renders, snapshot the card's current DOM rect from the registry.
2. **Last:** After re-render, get the card's new DOM rect.
3. **Invert:** Apply CSS transform to position card at its old location.
4. **Play:** Transition the transform to `none` over 300ms ease-out. Card visually slides to its new home.

### Specific Animations

| Event | Animation | Duration |
|---|---|---|
| Card: hand → battlefield | Slide from hand position to battlefield slot | 300ms ease-out |
| Card: hand → stack | Slide to stack sidebar, slight scale-up | 250ms ease-out |
| Card: stack → battlefield | Slide from stack to battlefield | 300ms ease-out |
| Card: stack → graveyard | Fade out + 10px downward drift | 250ms ease-out |
| Card: battlefield → graveyard | Fade to 0 opacity + slight shrink | 200ms ease-out |
| Creature declared attacker | Shift 20px toward opponent | 200ms ease-out |
| Creature takes damage | Red flash overlay (0.15s), floating "-N" text rises 40px and fades over 800ms | 800ms |
| Life total change | Number animates (counts up/down), flash red/green | 400ms |
| Phase advance | Phase indicator highlight slides | 200ms |
| Mana added to pool | Mana symbol briefly scales up 1.3x | 150ms |

### Animation Speed Setting

- **Normal:** Durations as specified above.
- **Fast:** All durations halved.
- **Off:** All durations set to 0 (instant transitions, no visual animation).

Stored in `localStorage`, readable via `useAnimationSettings()` hook.

### Level 3 Preparation (not implemented now)

The `AnimationOverlay` component accepts an `effects` prop: `Array<{ type: string, position: {x, y}, config: unknown }>`. For Level 2, only line/arrow/floating-text effect types are handled. The architecture allows adding:
- `screenShake` — applies CSS transform oscillation on the game board container
- `particles` — renders to a canvas sublayer in AnimationOverlay
- `cardFlip` — 3D CSS rotation on CardView

These are documented in `plan-client.md` as Phase 5 work items so they aren't forgotten.

## Mock Game Loop

### MockConnection

Implements the `GameConnection` interface. Maintains an internal `ClientGameState` and processes player actions by producing new states and events.

### Simulated Flows

| Action | Mock behavior |
|---|---|
| `playLand` | Move card from hand to battlefield zone. Set `landsPlayedThisTurn++`. Emit `cardEnteredZone` event. Update legal actions. |
| `activateAbility` (land tap) | Set card `tapped: true`. Add appropriate mana color to pool. Emit `manaAdded`. |
| `passPriority` | Advance phase/step. Emit `phaseChanged`. At beginning of turn: untap all, draw a card, emit `turnBegan`. |
| `castSpell` | Deduct mana from pool. Move card to stack (emit `spellCast`). After 500ms delay: "resolve" — move to battlefield (permanents) or graveyard (instants/sorceries). Emit `stackItemResolved`. |
| `declareAttackers` | Set `combatState` with attacker assignments. Advance to blockers step. Simulate opponent auto-blocking. |
| `declareBlockers` | Apply combat damage based on power/toughness. Kill creatures with lethal damage (move to graveyard). Reduce defending player life for unblocked damage. Emit damage events. |

### Opponent Auto-Pilot

The mock opponent (player 2) automatically:
- Passes priority immediately when they receive it
- Plays a land if they have one (on their turn, main phase)
- Blocks with their biggest creature if attacked (assigns to biggest attacker)
- Never casts spells (keeps it simple)

### Turn Structure

Full phase cycling: Untap → Upkeep → Draw → Main 1 → Combat → Main 2 → End → Cleanup → next turn. Skip empty combat (no attackers declared = jump to Main 2). Opponent turns auto-play in ~1 second.

### Mock Library

Each player starts with a pre-built hand and a "library" of 50 card IDs. Drawing adds the top card to the hand zone and creates its `CardInstance` in the state. Library count decrements.

## Card Hover & Context

- **Hover zoom:** 200ms delay, then show Scryfall `large` image as floating panel. Position flips left/right to stay on screen. Toggle in settings.
- **Castable indicator:** Bottom-edge glow on cards in hand that match a `castSpell` legal action. Green tint for playable lands.
- **Right-click context:** "View card" opens a modal with full card image + oracle text. Disabled during targeting/combat modes (right-click = cancel).

## Settings (localStorage)

- `autoPayMana`: boolean, default `true`
- `cardHoverZoom`: boolean, default `true`
- `animationSpeed`: `"normal" | "fast" | "off"`, default `"normal"`

Accessible via a gear icon in the top bar. Small dropdown panel, not a full page.

## Testing Strategy

- **State machine:** Unit tests for each transition (idle → casting → idle, etc.). Pure logic, no React.
- **Targeting:** Unit tests for legal target computation given mock state + legal actions.
- **Combat UI:** Unit tests for attacker/blocker assignment logic.
- **Auto-pay:** Unit tests for mana payment algorithm with various land configurations.
- **MockConnection:** Integration tests — dispatch action, verify resulting state + events.
- **Components:** React Testing Library tests for interaction components (click card → mode changes, confirm button appears, etc.).
- **Animation:** Minimal — test that AnimationProvider renders without errors, useCardPosition returns a ref. Visual animation correctness is verified manually in the dev server.

## File Summary

### New files
- `src/interaction/state-machine.ts`
- `src/interaction/targeting.ts`
- `src/interaction/combat-ui.ts`
- `src/interaction/mana-payment.ts`
- `src/interaction/actions.ts`
- `src/state/mock-connection.ts`
- `src/animation/AnimationProvider.tsx`
- `src/animation/AnimationOverlay.tsx`
- `src/animation/useCardPosition.ts`
- `src/animation/useAnimateTransition.ts`
- `src/animation/useAnimationSettings.ts`
- `src/animation/types.ts`
- `src/components/CardHover.tsx` + CSS module
- `src/components/SettingsPanel.tsx` + CSS module
- `src/components/ConfirmBar.tsx` + CSS module (replaces PriorityBar during combat/targeting)

### Modified files
- `src/state/game-store.ts` — expanded interaction state, settings, animation triggers
- `src/components/CardView.tsx` — castable glow, hover handlers, drag support
- `src/components/Battlefield.tsx` — drag drop zones, attacker shift
- `src/components/Hand.tsx` — castable indicators, click-to-cast initiation
- `src/components/GameBoard.tsx` — AnimationOverlay integration, drag context
- `src/components/PriorityBar.tsx` — context-aware (shows confirm during combat)
- `src/App.tsx` — AnimationProvider wrapper, settings panel, mock connection init
- `src/mocks/mock-state.ts` — expanded mock data for interactive scenarios
