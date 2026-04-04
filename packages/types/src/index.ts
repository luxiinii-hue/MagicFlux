/**
 * @magic-flux/types -- Shared type definitions for Magic Flux.
 *
 * This package contains ONLY TypeScript type definitions, interfaces, enums,
 * and compile-time constants. Zero runtime code (other than enum values and
 * constants that are erased or inlined by the compiler).
 *
 * All other packages import from here. This is a leaf dependency.
 */

// Mana types
export type { ManaColor, ManaPool, ManaSymbol, ManaCost } from "./mana.js";

// Zone types
export { ZoneType } from "./zones.js";
export type { ZoneVisibility, Zone } from "./zones.js";

// Turn structure
export { Phase, Step } from "./turn.js";
export type { TurnState } from "./turn.js";

// Player
export type { Player } from "./player.js";

// Card types
export type {
  Supertype,
  CardTypeName,
  CardLayout,
  FormatLegality,
  CardFace,
  CardData,
  CastingChoices,
  LinkedEffect,
  CardInstance,
  TokenDefinition,
  DecklistEntry,
  Decklist,
  DeckValidationError,
  DeckValidationWarning,
  DeckValidationResult,
} from "./card.js";

// Abilities and effects
export type {
  AbilityType,
  AbilityTiming,
  CostFilter,
  ActivationCost,
  AdditionalCost,
  TargetType,
  TargetCount,
  TargetController,
  TargetRequirement,
  ResolvedTarget,
  TargetRef,
  PlayerRef,
  StackItemRef,
  NumberOrExpression,
  Duration,
  Effect,
  TriggerCondition,
  SpellAbilitySpell,
  SpellAbilityActivated,
  SpellAbilityTriggered,
  SpellAbilityStatic,
  SpellAbilityMana,
  SpellAbility,
  ContinuousEffectDefinition,
  ComparisonOp,
  Comparison,
  CardSelector,
  CardFilter,
  Condition,
} from "./abilities.js";

// Events
export type {
  CardEnteredZoneEvent,
  CardLeftZoneEvent,
  LifeChangedEvent,
  ManaAddedEvent,
  PhaseChangedEvent,
  TurnBeganEvent,
  SpellCastEvent,
  AbilityActivatedEvent,
  AbilityTriggeredEvent,
  StackItemResolvedEvent,
  StackItemCounteredEvent,
  DamageDealtEvent,
  CombatDamageDealtEvent,
  AttackersDeclaredEvent,
  BlockersDeclaredEvent,
  CardTappedEvent,
  CardUntappedEvent,
  CardDestroyedEvent,
  TokenCreatedEvent,
  CounterAddedEvent,
  CounterRemovedEvent,
  PlayerLostEvent,
  GameOverEvent,
  GameEvent,
} from "./events.js";

// Player actions
export type {
  PassPriorityAction,
  PlayLandAction,
  CastSpellAction,
  ActivateAbilityAction,
  DeclareAttackersAction,
  DeclareBlockersAction,
  AssignDamageOrderAction,
  AssignCombatDamageAction,
  MakeChoiceAction,
  ConcedeAction,
  PlayerAction,
} from "./actions.js";

// Stack types
export type {
  StackItem,
  ManaAbilityActivation,
  ManaPaymentPlan,
  DamageAssignment,
} from "./stack.js";

// Game state and related types
export type {
  PlayerConfig,
  GameConfig,
  AttackerInfo,
  BlockerInfo,
  CombatState,
  ContinuousEffect,
  ExtraTurn,
  TurnFlags,
  GameState,
  GameStatus,
  EngineError,
  ActionResult,
  ClientLibraryZone,
  ClientHandZone,
  ClientGameState,
} from "./game-state.js";
export type { GameFormat } from "./game-state.js";

// WebSocket message types
export type {
  StateUpdateMessage,
  LegalActionsMessage,
  PromptMessage,
  GameEventMessage,
  GameErrorMessage,
  GameOverMessage,
  GameCreatedMessage,
  GameStartingMessage,
  LobbyGameListMessage,
  DeckValidationMessage,
  ServerMessage,
  GameActionMessage,
  PromptResponseMessage,
  CreateGameMessage,
  JoinGameMessage,
  LeaveGameMessage,
  ListGamesMessage,
  ClientMessage,
} from "./messages.js";

// Constants
export {
  MAX_HAND_SIZE,
  STARTING_LIFE_STANDARD,
  STARTING_LIFE_COMMANDER,
  STARTING_HAND_SIZE,
  LETHAL_POISON_COUNTERS,
  LETHAL_COMMANDER_DAMAGE,
  DEFAULT_LANDS_PER_TURN,
} from "./game-state.js";
