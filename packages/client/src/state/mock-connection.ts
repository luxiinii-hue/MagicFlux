import type {
  ClientGameState, PlayerAction, GameEvent, CardInstance,
  Player, Zone, TurnState, ClientHandZone, ClientLibraryZone,
  ManaPool,
} from '@magic-flux/types';
import { Phase, Step, ZoneType } from '@magic-flux/types';
import type { GameConnection, PromptData } from './connection';
import {
  PLAINS_DATA, MOUNTAIN_DATA, SERRA_ANGEL_DATA,
  LIGHTNING_BOLT_DATA, GRIZZLY_BEARS_DATA,
  createMockCardInstance,
} from '../mocks/mock-cards';
import { MOCK_CARD_DATA_MAP } from '../mocks/mock-state';

type StateCallback = (state: ClientGameState) => void;
type LegalActionsCallback = (actions: PlayerAction[], prompt?: string) => void;
type EventCallback = (event: GameEvent, message: string) => void;
type PromptCallback = (prompt: PromptData) => void;
type ErrorCallback = (code: string, message: string) => void;

const PHASE_ORDER: { phase: Phase; step: Step | null }[] = [
  { phase: Phase.Beginning, step: Step.Untap },
  { phase: Phase.Beginning, step: Step.Upkeep },
  { phase: Phase.Beginning, step: Step.Draw },
  { phase: Phase.PreCombatMain, step: null },
  { phase: Phase.Combat, step: Step.BeginningOfCombat },
  { phase: Phase.Combat, step: Step.DeclareAttackers },
  { phase: Phase.Combat, step: Step.DeclareBlockers },
  { phase: Phase.Combat, step: Step.CombatDamage },
  { phase: Phase.Combat, step: Step.EndOfCombat },
  { phase: Phase.PostCombatMain, step: null },
  { phase: Phase.Ending, step: Step.EndStep },
  { phase: Phase.Ending, step: Step.Cleanup },
];

function landColor(cardDataId: string): 'W' | 'U' | 'B' | 'R' | 'G' | null {
  if (cardDataId.includes('plains') || cardDataId === PLAINS_DATA.id) return 'W';
  if (cardDataId.includes('island')) return 'U';
  if (cardDataId.includes('swamp')) return 'B';
  if (cardDataId.includes('mountain') || cardDataId === MOUNTAIN_DATA.id) return 'R';
  if (cardDataId.includes('forest')) return 'G';
  return null;
}

export class MockConnection implements GameConnection {
  private state: ClientGameState | null = null;
  private timestamp = 0;
  private stateCallbacks: StateCallback[] = [];
  private legalActionsCallbacks: LegalActionsCallback[] = [];
  private eventCallbacks: EventCallback[] = [];
  private promptCallbacks: PromptCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  connect(): void {
    this.state = this.buildInitialState();
    this.emit();
  }

  disconnect(): void {
    this.state = null;
  }

  sendAction(_gameId: string, action: PlayerAction): void {
    if (!this.state) return;

    switch (action.type) {
      case 'passPriority':
        this.handlePassPriority();
        break;
      case 'playLand':
        this.handlePlayLand(action.cardInstanceId);
        break;
      case 'castSpell':
        this.handleCastSpell(action.cardInstanceId);
        break;
      case 'declareAttackers':
        this.handleDeclareAttackers(action.attackerAssignments);
        break;
      case 'declareBlockers':
        this.handleDeclareBlockers();
        break;
      case 'activateAbility':
        this.handleActivateAbility(action.cardInstanceId);
        break;
      default:
        break;
    }

    this.emit();
  }

  onStateUpdate(cb: StateCallback): void { this.stateCallbacks.push(cb); }
  onLegalActions(cb: LegalActionsCallback): void { this.legalActionsCallbacks.push(cb); }
  onEvent(cb: EventCallback): void { this.eventCallbacks.push(cb); }
  onPrompt(cb: PromptCallback): void { this.promptCallbacks.push(cb); }
  onError(cb: ErrorCallback): void { this.errorCallbacks.push(cb); }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  private handlePassPriority(): void {
    if (!this.state) return;
    // Advance two phases: player passes, opponent auto-passes
    this.advancePhase();
    this.advancePhase();
  }

  private handlePlayLand(cardInstanceId: string): void {
    if (!this.state) return;
    const card = this.state.cardInstances[cardInstanceId];
    if (!card) return;

    this.moveCard(cardInstanceId, `player:player-1:hand`, 'battlefield', ZoneType.Battlefield);

    const players = this.state.players.map((p) =>
      p.id === 'player-1' ? { ...p, landsPlayedThisTurn: p.landsPlayedThisTurn + 1 } : p
    );
    this.state = { ...this.state, players };
    this.emitEvent('cardEnteredZone', `You play ${this.cardName(cardInstanceId)}`);
  }

  private handleCastSpell(cardInstanceId: string): void {
    if (!this.state) return;
    const card = this.state.cardInstances[cardInstanceId];
    if (!card) return;

    const data = MOCK_CARD_DATA_MAP[card.cardDataId];
    const isCreature = data?.cardTypes.includes('Creature');

    // Deduct mana from pool if cost exists
    if (data?.parsedManaCost) {
      const players = this.state.players.map((p) => {
        if (p.id !== 'player-1') return p;
        const pool = { ...p.manaPool };
        for (const sym of data.parsedManaCost!.symbols) {
          if (sym.type === 'colored' && pool[sym.color] > 0) {
            pool[sym.color]--;
          } else if (sym.type === 'generic') {
            let remaining = sym.amount;
            for (const c of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
              const use = Math.min(pool[c], remaining);
              pool[c] -= use;
              remaining -= use;
            }
          }
        }
        return { ...p, manaPool: pool };
      });
      this.state = { ...this.state, players };
    }

    this.emitEvent('spellCast', `You cast ${this.cardName(cardInstanceId)}`);

    if (isCreature) {
      // Creature: move to battlefield with summoning sickness
      this.moveCard(cardInstanceId, `player:player-1:hand`, 'battlefield', ZoneType.Battlefield);
      const cardInstances = { ...this.state.cardInstances };
      const c = cardInstances[cardInstanceId];
      if (c) {
        cardInstances[cardInstanceId] = {
          ...c,
          summoningSickness: true,
          modifiedPower: data?.power ? parseInt(data.power, 10) : null,
          modifiedToughness: data?.toughness ? parseInt(data.toughness, 10) : null,
        };
        this.state = { ...this.state, cardInstances };
      }
      this.emitEvent('cardEnteredZone', `${data?.name ?? 'Creature'} enters the battlefield`);
    } else {
      // Instant/sorcery: resolve and move to graveyard
      this.moveCard(cardInstanceId, `player:player-1:hand`, `player:player-1:graveyard`, ZoneType.Graveyard);
      this.emitEvent('stackItemResolved', `${data?.name ?? 'Spell'} resolves`);
    }
  }

  private handleActivateAbility(cardInstanceId: string): void {
    if (!this.state) return;
    const card = this.state.cardInstances[cardInstanceId];
    if (!card) return;

    const cardInstances = { ...this.state.cardInstances };
    cardInstances[cardInstanceId] = { ...card, tapped: true };

    const color = landColor(card.cardDataId);
    if (color) {
      const players = this.state.players.map((p) => {
        if (p.id !== card.controller) return p;
        const pool = { ...p.manaPool };
        pool[color] = pool[color] + 1;
        return { ...p, manaPool: pool };
      });
      this.state = { ...this.state, cardInstances, players };
      this.emitEvent('manaAdded', `You tap ${this.cardName(cardInstanceId)} for {${color}}`);
    } else {
      this.state = { ...this.state, cardInstances };
    }
  }

  private handleDeclareAttackers(assignments: Readonly<Record<string, string>>): void {
    if (!this.state) return;
    const attackerIds = Object.keys(assignments);
    if (attackerIds.length === 0) {
      // Skip combat
      this.emitEvent('attackersDeclared', 'No attackers declared');
      this.advancePhase(); // skip to post-combat
      this.advancePhase();
      this.advancePhase();
      return;
    }

    // Tap attackers
    const cardInstances = { ...this.state.cardInstances };
    for (const id of attackerIds) {
      const card = cardInstances[id];
      if (card) cardInstances[id] = { ...card, tapped: true };
    }

    const combatState = {
      attackers: Object.fromEntries(
        attackerIds.map((id) => [id, {
          attackTarget: assignments[id],
          blocked: false,
          blockers: [] as readonly string[],
          dealtFirstStrikeDamage: false,
        }])
      ),
      blockers: {},
      damageAssignmentOrders: {},
    };

    this.state = { ...this.state, cardInstances, combatState };
    this.emitEvent('attackersDeclared', `You attack with ${attackerIds.length} creature(s)`);

    // Simulate opponent auto-blocking then combat damage after a delay
    setTimeout(() => {
      this.resolveAutoBlockAndDamage(attackerIds);
      this.emit();
    }, 600);
  }

  private handleDeclareBlockers(): void {
    // Handled in resolveAutoBlockAndDamage
  }

  // ---------------------------------------------------------------------------
  // Combat resolution
  // ---------------------------------------------------------------------------

  private resolveAutoBlockAndDamage(attackerIds: string[]): void {
    if (!this.state) return;

    // Opponent auto-blocks: assign biggest blocker to biggest attacker
    const bf = this.state.zones['battlefield'];
    if (!bf || !('cardInstanceIds' in bf) || !bf.cardInstanceIds) return;

    const opponentCreatures = bf.cardInstanceIds
      .map((id) => this.state!.cardInstances[id])
      .filter((c): c is CardInstance =>
        c !== undefined && c.controller === 'player-2' && !c.tapped && c.modifiedPower !== null
      )
      .sort((a, b) => (b.modifiedPower ?? 0) - (a.modifiedPower ?? 0));

    const cardInstances = { ...this.state.cardInstances };
    let totalDamageToOpponent = 0;

    // Sort attackers by power descending for blocking assignment
    const sortedAttackerIds = [...attackerIds].sort((a, b) => {
      const ca = this.state!.cardInstances[a];
      const cb = this.state!.cardInstances[b];
      return (cb?.modifiedPower ?? 0) - (ca?.modifiedPower ?? 0);
    });

    const blockerUsed = new Set<string>();
    const blockAssignments: Record<string, string> = {}; // attacker → blocker

    for (const attackerId of sortedAttackerIds) {
      const blocker = opponentCreatures.find((c) => !blockerUsed.has(c.instanceId));
      if (blocker) {
        blockerUsed.add(blocker.instanceId);
        blockAssignments[attackerId] = blocker.instanceId;
      }
    }

    // Resolve combat damage
    for (const attackerId of attackerIds) {
      const attacker = cardInstances[attackerId];
      if (!attacker) continue;

      const blockerId = blockAssignments[attackerId];
      if (blockerId) {
        // Blocked — creatures fight
        const blocker = cardInstances[blockerId];
        if (!blocker) continue;

        const attackerPower = attacker.modifiedPower ?? 0;
        const blockerPower = blocker.modifiedPower ?? 0;
        const attackerToughness = attacker.modifiedToughness ?? 0;
        const blockerToughness = blocker.modifiedToughness ?? 0;

        // Blocker takes damage from attacker
        if (attackerPower >= blockerToughness) {
          // Blocker dies — move to graveyard
          this.emitEvent('damageDealt', `${this.cardName(attackerId)} deals ${attackerPower} to ${this.cardName(blockerId)}`);
          this.moveCardDirect(cardInstances, blockerId, ZoneType.Graveyard, 'player-2');
          this.emitEvent('cardDestroyed', `${this.cardName(blockerId)} is destroyed`);
        }

        // Attacker takes damage from blocker
        if (blockerPower >= attackerToughness) {
          this.emitEvent('damageDealt', `${this.cardName(blockerId)} deals ${blockerPower} to ${this.cardName(attackerId)}`);
          this.moveCardDirect(cardInstances, attackerId, ZoneType.Graveyard, 'player-1');
          this.emitEvent('cardDestroyed', `${this.cardName(attackerId)} is destroyed`);
        }
      } else {
        // Unblocked — damage to opponent
        const power = attacker.modifiedPower ?? 0;
        totalDamageToOpponent += power;
      }
    }

    // Apply damage to opponent
    if (totalDamageToOpponent > 0) {
      const players = this.state.players.map((p) =>
        p.id === 'player-2' ? { ...p, life: p.life - totalDamageToOpponent } : p
      );
      this.state = { ...this.state, players, cardInstances, combatState: null };
      this.emitEvent('lifeChanged', `Bob takes ${totalDamageToOpponent} combat damage (life: ${this.state.players.find((p) => p.id === 'player-2')?.life})`);
    } else {
      this.state = { ...this.state, cardInstances, combatState: null };
    }

    // Check for game over
    const opponent = this.state.players.find((p) => p.id === 'player-2');
    if (opponent && opponent.life <= 0) {
      this.state = { ...this.state, gameOver: true, winners: ['player-1'], losers: ['player-2'] };
      this.emitEvent('gameOver', 'You win!');
    }
  }

  /** Move a card directly in the cardInstances record (for combat resolution). */
  private moveCardDirect(
    cardInstances: Record<string, CardInstance>,
    instanceId: string,
    toZone: ZoneType,
    ownerId: string,
  ): void {
    if (!this.state) return;
    const card = cardInstances[instanceId];
    if (!card) return;
    cardInstances[instanceId] = { ...card, zone: toZone, zoneOwnerId: ownerId };

    // Update zone arrays
    const zones = { ...this.state.zones };
    // Remove from battlefield
    const bf = zones['battlefield'];
    if (bf && 'cardInstanceIds' in bf && bf.cardInstanceIds) {
      zones['battlefield'] = { ...bf, cardInstanceIds: bf.cardInstanceIds.filter((id) => id !== instanceId) } as Zone;
    }
    // Add to graveyard
    const gyKey = `player:${ownerId}:graveyard`;
    const gy = zones[gyKey];
    if (gy && 'cardInstanceIds' in gy) {
      zones[gyKey] = { ...gy, cardInstanceIds: [...(gy.cardInstanceIds ?? []), instanceId] } as Zone;
    }
    this.state = { ...this.state, zones, cardInstances };
  }

  // ---------------------------------------------------------------------------
  // Phase advancement
  // ---------------------------------------------------------------------------

  private advancePhase(): void {
    if (!this.state) return;
    const ts = this.state.turnState;
    const currentIdx = PHASE_ORDER.findIndex(
      (p) => p.phase === ts.phase && p.step === ts.step
    );
    const nextIdx = (currentIdx + 1) % PHASE_ORDER.length;
    const next = PHASE_ORDER[nextIdx];

    let turnNumber = this.state.turnNumber;
    let activePlayerId = this.state.activePlayerId;

    // New turn if we wrapped
    if (nextIdx === 0) {
      turnNumber++;
      activePlayerId = activePlayerId === 'player-1' ? 'player-2' : 'player-1';
      this.untapAll(activePlayerId);
      this.emitEvent('turnBegan', `Turn ${turnNumber} — ${activePlayerId === 'player-1' ? 'Alice' : 'Bob'}'s turn`);

      // If opponent's turn, auto-play it quickly
      if (activePlayerId === 'player-2') {
        this.simulateOpponentTurn(turnNumber);
        return;
      }
    }

    // Empty mana pools on phase change
    const players = this.state.players.map((p) => ({
      ...p,
      manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      ...(nextIdx === 0 && p.id === activePlayerId ? { landsPlayedThisTurn: 0 } : {}),
    }));

    const turnState: TurnState = {
      turnNumber,
      activePlayerId,
      phase: next.phase,
      step: next.step,
      hasDeclaredAttackers: false,
      hasDeclaredBlockers: false,
      priorityPassedWithoutAction: [],
    };

    this.state = {
      ...this.state,
      players,
      turnState,
      turnNumber,
      activePlayerId,
      priorityPlayerId: 'player-1',
    };

    this.emitEvent('phaseChanged', `${next.phase}${next.step ? ` — ${next.step}` : ''}`);
  }

  private simulateOpponentTurn(turnNumber: number): void {
    if (!this.state) return;

    // Skip straight to player 1's next turn
    const players = this.state.players.map((p) => ({
      ...p,
      manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      ...(p.id === 'player-1' ? { landsPlayedThisTurn: 0 } : {}),
    }));

    this.untapAll('player-1');

    const turnState: TurnState = {
      turnNumber: turnNumber + 1,
      activePlayerId: 'player-1',
      phase: Phase.PreCombatMain,
      step: null,
      hasDeclaredAttackers: false,
      hasDeclaredBlockers: false,
      priorityPassedWithoutAction: [],
    };

    this.state = {
      ...this.state,
      players,
      turnState,
      turnNumber: turnNumber + 1,
      activePlayerId: 'player-1',
      priorityPlayerId: 'player-1',
    };

    this.emitEvent('turnBegan', `Turn ${turnNumber + 1} — Alice's turn`);
    this.emitEvent('phaseChanged', 'PreCombatMain');
  }

  private untapAll(playerId: string): void {
    if (!this.state) return;
    const cardInstances = { ...this.state.cardInstances };
    for (const [id, card] of Object.entries(cardInstances)) {
      if (card.controller === playerId && card.tapped) {
        cardInstances[id] = { ...card, tapped: false, summoningSickness: false };
      }
    }
    this.state = { ...this.state, cardInstances };
  }

  // ---------------------------------------------------------------------------
  // Zone manipulation
  // ---------------------------------------------------------------------------

  private moveCard(instanceId: string, fromZoneKey: string, toZoneKey: string, toZoneType: ZoneType): void {
    if (!this.state) return;
    const zones = { ...this.state.zones };

    // Remove from source
    const from = zones[fromZoneKey];
    if (from && 'cardInstanceIds' in from && from.cardInstanceIds) {
      if ('cardCount' in from) {
        zones[fromZoneKey] = {
          ...from,
          cardInstanceIds: from.cardInstanceIds.filter((id) => id !== instanceId),
          cardCount: (from as ClientHandZone).cardCount - 1,
        } as ClientHandZone;
      } else {
        zones[fromZoneKey] = {
          ...from,
          cardInstanceIds: from.cardInstanceIds.filter((id) => id !== instanceId),
        } as Zone;
      }
    }

    // Add to target
    const to = zones[toZoneKey];
    if (to && 'cardInstanceIds' in to) {
      zones[toZoneKey] = {
        ...to,
        cardInstanceIds: [...(to.cardInstanceIds ?? []), instanceId],
      } as Zone;
    }

    // Update card zone
    const cardInstances = { ...this.state.cardInstances };
    const card = cardInstances[instanceId];
    if (card) {
      cardInstances[instanceId] = {
        ...card,
        zone: toZoneType,
        zoneOwnerId: toZoneType === ZoneType.Battlefield ? null : card.zoneOwnerId,
      };
    }

    this.state = { ...this.state, zones, cardInstances };
  }

  private cardName(instanceId: string): string {
    const card = this.state?.cardInstances[instanceId];
    if (!card) return 'Unknown';
    const data = MOCK_CARD_DATA_MAP[card.cardDataId];
    return data?.name ?? 'Unknown';
  }

  // ---------------------------------------------------------------------------
  // Event emission
  // ---------------------------------------------------------------------------

  private emitEvent(type: string, message: string): void {
    this.timestamp++;
    const event = { type, timestamp: this.timestamp } as unknown as GameEvent;
    for (const cb of this.eventCallbacks) cb(event, message);
  }

  private emit(): void {
    if (!this.state) return;
    for (const cb of this.stateCallbacks) cb(this.state);
    for (const cb of this.legalActionsCallbacks) cb(this.computeLegalActions());
  }

  private computeLegalActions(): PlayerAction[] {
    if (!this.state) return [];
    if (this.state.gameOver) return [];

    const actions: PlayerAction[] = [{ type: 'passPriority' }];
    const p1 = this.state.players.find((p) => p.id === 'player-1');
    if (!p1) return actions;

    const isMainPhase = this.state.turnState.phase === Phase.PreCombatMain ||
      this.state.turnState.phase === Phase.PostCombatMain;

    // Playable lands
    if (isMainPhase && p1.landsPlayedThisTurn < p1.maxLandsPerTurn) {
      const hand = this.state.zones['player:player-1:hand'];
      if (hand && 'cardInstanceIds' in hand && hand.cardInstanceIds) {
        for (const id of hand.cardInstanceIds) {
          const card = this.state.cardInstances[id];
          if (!card) continue;
          const data = MOCK_CARD_DATA_MAP[card.cardDataId];
          if (data?.cardTypes.includes('Land')) {
            actions.push({ type: 'playLand', cardInstanceId: id });
          }
        }
      }
    }

    // Castable spells (simplified: any non-land in hand during main phase with enough mana)
    if (isMainPhase) {
      const hand = this.state.zones['player:player-1:hand'];
      if (hand && 'cardInstanceIds' in hand && hand.cardInstanceIds) {
        for (const id of hand.cardInstanceIds) {
          const card = this.state.cardInstances[id];
          if (!card) continue;
          const data = MOCK_CARD_DATA_MAP[card.cardDataId];
          if (!data || data.cardTypes.includes('Land')) continue;
          // Simplified mana check: just check total pool >= cmc
          const totalPool = p1.manaPool.W + p1.manaPool.U + p1.manaPool.B + p1.manaPool.R + p1.manaPool.G + p1.manaPool.C;
          if (totalPool >= data.cmc) {
            actions.push({ type: 'castSpell', cardInstanceId: id });
          }
        }
      }
    }

    // Mana abilities (tap untapped lands)
    const bf = this.state.zones['battlefield'];
    if (bf && 'cardInstanceIds' in bf && bf.cardInstanceIds) {
      for (const id of bf.cardInstanceIds) {
        const card = this.state.cardInstances[id];
        if (!card || card.controller !== 'player-1' || card.tapped) continue;
        const data = MOCK_CARD_DATA_MAP[card.cardDataId];
        if (data?.cardTypes.includes('Land')) {
          actions.push({ type: 'activateAbility', cardInstanceId: id, abilityId: 'tap-for-mana' });
        }
      }
    }

    // Declare attackers (during combat, main phase has already ended)
    if (this.state.turnState.phase === Phase.Combat &&
        this.state.turnState.step === Step.DeclareAttackers &&
        this.state.activePlayerId === 'player-1') {
      actions.push({
        type: 'declareAttackers',
        attackerAssignments: {},
      });
    }

    return actions;
  }

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  private buildInitialState(): ClientGameState {
    const p1 = 'player-1';
    const p2 = 'player-2';
    const cardInstances: Record<string, CardInstance> = {};

    // P1 battlefield: 3 Plains, Serra Angel
    const p1Lands = ['p1-plains-1', 'p1-plains-2', 'p1-plains-3'].map((id) =>
      createMockCardInstance(PLAINS_DATA.id, id, p1, ZoneType.Battlefield)
    );
    const angel = createMockCardInstance(SERRA_ANGEL_DATA.id, 'p1-angel', p1, ZoneType.Battlefield, {
      modifiedPower: 4, modifiedToughness: 4,
    });

    // P1 hand: 2 Plains + Lightning Bolt
    const p1Hand = [
      createMockCardInstance(PLAINS_DATA.id, 'p1-plains-hand-1', p1, ZoneType.Hand, { zoneOwnerId: p1 }),
      createMockCardInstance(PLAINS_DATA.id, 'p1-plains-hand-2', p1, ZoneType.Hand, { zoneOwnerId: p1 }),
      createMockCardInstance(LIGHTNING_BOLT_DATA.id, 'p1-bolt-hand', p1, ZoneType.Hand, { zoneOwnerId: p1 }),
    ];

    // P2 battlefield: 2 Mountains, Grizzly Bears
    const p2Lands = [
      createMockCardInstance(MOUNTAIN_DATA.id, 'p2-mountain-1', p2, ZoneType.Battlefield),
      createMockCardInstance(MOUNTAIN_DATA.id, 'p2-mountain-2', p2, ZoneType.Battlefield),
    ];
    const bears = createMockCardInstance(GRIZZLY_BEARS_DATA.id, 'p2-bears', p2, ZoneType.Battlefield, {
      modifiedPower: 2, modifiedToughness: 2,
    });

    for (const c of [...p1Lands, angel, ...p1Hand, ...p2Lands, bears]) {
      cardInstances[c.instanceId] = c;
    }

    const players: Player[] = [
      {
        id: p1, name: 'Alice', life: 20, poisonCounters: 0,
        manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        hasLost: false, hasConceded: false, commanderDamageReceived: {},
        commanderId: null, commanderTax: 0, energyCounters: 0,
        experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1,
        drewFromEmptyLibrary: false,
      },
      {
        id: p2, name: 'Bob', life: 20, poisonCounters: 0,
        manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        hasLost: false, hasConceded: false, commanderDamageReceived: {},
        commanderId: null, commanderTax: 0, energyCounters: 0,
        experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1,
        drewFromEmptyLibrary: false,
      },
    ];

    const bfIds = [...p1Lands.map((c) => c.instanceId), angel.instanceId, ...p2Lands.map((c) => c.instanceId), bears.instanceId];

    const zones: Record<string, Zone | ClientLibraryZone | ClientHandZone> = {
      battlefield: { key: 'battlefield', type: ZoneType.Battlefield, ownerId: null, cardInstanceIds: bfIds, visibility: 'public' },
      [`player:${p1}:hand`]: { key: `player:${p1}:hand`, type: 'Hand' as const, ownerId: p1, cardInstanceIds: p1Hand.map((c) => c.instanceId), cardCount: p1Hand.length } satisfies ClientHandZone,
      [`player:${p2}:hand`]: { key: `player:${p2}:hand`, type: 'Hand' as const, ownerId: p2, cardInstanceIds: null, cardCount: 3 } satisfies ClientHandZone,
      [`player:${p1}:library`]: { key: `player:${p1}:library`, type: 'Library' as const, ownerId: p1, cardCount: 50 } satisfies ClientLibraryZone,
      [`player:${p2}:library`]: { key: `player:${p2}:library`, type: 'Library' as const, ownerId: p2, cardCount: 50 } satisfies ClientLibraryZone,
      [`player:${p1}:graveyard`]: { key: `player:${p1}:graveyard`, type: ZoneType.Graveyard, ownerId: p1, cardInstanceIds: [], visibility: 'public' },
      [`player:${p2}:graveyard`]: { key: `player:${p2}:graveyard`, type: ZoneType.Graveyard, ownerId: p2, cardInstanceIds: [], visibility: 'public' },
      exile: { key: 'exile', type: ZoneType.Exile, ownerId: null, cardInstanceIds: [], visibility: 'public' },
      stack: { key: 'stack', type: ZoneType.Stack, ownerId: null, cardInstanceIds: [], visibility: 'public' },
    };

    return {
      gameId: 'mock-game-001', players, cardInstances, zones,
      turnState: {
        turnNumber: 1, activePlayerId: p1, phase: Phase.PreCombatMain, step: null,
        hasDeclaredAttackers: false, hasDeclaredBlockers: false, priorityPassedWithoutAction: [],
      },
      activePlayerId: p1, priorityPlayerId: p1,
      stack: [], stackItems: {}, turnNumber: 1,
      gameOver: false, winners: [], losers: [],
      continuousEffects: [], combatState: null, format: 'standard',
    };
  }
}
