import { useEffect, useState, useRef, useCallback } from 'react';
import type { FC } from 'react';
import { useGameStore } from './state/game-store';
import { MockConnection } from './state/mock-connection';
import { WebSocketConnection } from './state/websocket-connection';
import { MOCK_CARD_DATA_MAP } from './mocks/mock-state';
import { buildCardDataMap } from './rendering/card-data-cache';
import { AnimationProvider } from './animation/AnimationProvider';
import { AnimationOverlay } from './animation/AnimationOverlay';
import { GameBoard } from './components/GameBoard';
import { PhaseIndicator } from './components/PhaseIndicator';
import { StackDisplay } from './components/StackDisplay';
import { GameLog } from './components/GameLog';
import { PriorityBar } from './components/PriorityBar';
import { SettingsPanel } from './components/SettingsPanel';
import { Lobby } from './components/Lobby';
import { CardHover } from './components/CardHover';
import { MulliganScreen } from './components/MulliganScreen';
import { WaitingScene } from './components/WaitingScene';
import { PromptOverlay } from './components/PromptOverlay';
import { CombatPanel } from './components/CombatPanel';
import { TargetingOverlay } from './components/TargetingOverlay';
import { TriggerToast } from './components/TriggerToast';
import { isPlayableLand, isCastableCard } from './interaction/targeting';
import type { CardInstance, ClientGameState, TargetRequirement } from '@magic-flux/types';

/** Check if a card is a valid target for a given requirement. */
function isValidTargetForRequirement(
  card: CardInstance,
  instanceId: string,
  req: TargetRequirement,
  gameState: ClientGameState,
  viewingPlayerId: string,
  cardDataMap: Readonly<Record<string, import('./rendering/card-data-cache').CardData>>,
): boolean {
  // Check target types
  const cardData = cardDataMap[card.cardDataId];
  const isCreature = card.modifiedPower !== null || (cardData && cardData.typeLine.toLowerCase().includes('creature'));
  const isPlaneswalker = card.currentLoyalty !== null || (cardData && cardData.typeLine.toLowerCase().includes('planeswalker'));
  const isEnchantment = cardData && cardData.typeLine.toLowerCase().includes('enchantment');
  const isArtifact = cardData && cardData.typeLine.toLowerCase().includes('artifact');
  const isLand = cardData && cardData.typeLine.toLowerCase().includes('land');

  const targetTypes = req.targetTypes as readonly string[];
  const matchesType =
    (targetTypes.includes('creature') && isCreature && card.zone === 'Battlefield') ||
    (targetTypes.includes('permanent') && card.zone === 'Battlefield') ||
    (targetTypes.includes('planeswalker') && isPlaneswalker && card.zone === 'Battlefield') ||
    (targetTypes.includes('enchantment') && isEnchantment && card.zone === 'Battlefield') ||
    (targetTypes.includes('artifact') && isArtifact && card.zone === 'Battlefield') ||
    (targetTypes.includes('land') && isLand && card.zone === 'Battlefield');
  if (!matchesType) return false;

  // Check controller restriction
  if (req.controller === 'opponent' && card.controller === viewingPlayerId) return false;
  if (req.controller === 'you' && card.controller !== viewingPlayerId) return false;

  return true;
}
import type { GameConnection, LobbyConnection } from './state/connection';
import styles from './App.module.css';

type AppScreen = 'lobby' | 'game';

// In production (served by the game server), connect to the same host.
// In development (Vite dev server), connect to localhost:3001.
const SERVER_URL = import.meta.env.DEV
  ? 'ws://localhost:3001'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

/** Wire game-phase callbacks onto a connection. Uses store.getState() to
 *  avoid stale closures — safe to call once per connection lifetime. */
function wireGameCallbacks(conn: GameConnection): void {
  const store = useGameStore;

  conn.onStateUpdate((state) => {
    store.getState().setGameState(state);
    if (!store.getState().viewingPlayerId) {
      store.getState().setViewingPlayerId(state.players[0]?.id ?? null);
    }
  });
  conn.onLegalActions((actions, _prompt, targetRequirements) => {
    store.getState().setLegalActions([...actions], targetRequirements as Record<string, readonly import('@magic-flux/types').TargetRequirement[]> | undefined);
  });
  conn.onEvent((event, message) => store.getState().addLogEntry(event, message));
  conn.onPrompt((prompt) => {
    store.getState().setPrompt(prompt);
  });
  conn.onError((code, msg) => console.error(`Game error: ${code} - ${msg}`));
  if (conn.onGameOver) {
    conn.onGameOver((winners, losers, reason) => {
      store.getState().addLogEntry(
        { type: 'gameOver', winnerIds: winners, timestamp: Date.now() } as any,
        `Game Over: ${reason}`
      );
    });
  }
}

export const App: FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const legalActions = useGameStore((s) => s.legalActions);
  const gameLog = useGameStore((s) => s.gameLog);
  const selectedCards = useGameStore((s) => s.selectedCards);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const viewingPlayerId = useGameStore((s) => s.viewingPlayerId);
  const interaction = useGameStore((s) => s.interaction);
  const settings = useGameStore((s) => s.settings);
  const prompt = useGameStore((s) => s.prompt);
  const sendAction = useGameStore((s) => s.sendAction);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const dispatchInteraction = useGameStore((s) => s.dispatchInteraction);
  const selectCard = useGameStore((s) => s.selectCard);
  const deselectCard = useGameStore((s) => s.deselectCard);

  const [screen, setScreen] = useState<AppScreen>('lobby');
  const [showSettings, setShowSettings] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [validationErrors, setValidationErrors] = useState<readonly { message: string }[]>([]);
  const [lobbyGameId, setLobbyGameId] = useState<string | null>(null);
  // Targeting state: tracks multi-target selection for spells
  const [castingCardId, setCastingCardId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<import('@magic-flux/types').ResolvedTarget[]>([]);
  const targetRequirements = useGameStore((s) => s.targetRequirements);

  // Which requirement index we're currently selecting for
  const castingReqIndex = castingCardId ? selectedTargets.length : 0;
  const castingAllReqs = castingCardId ? (targetRequirements[castingCardId] ?? []) : [];
  const currentReq = castingAllReqs[castingReqIndex] ?? null;

  // Stable ref for the WebSocket connection — created once, never torn down by re-renders
  const wsConnRef = useRef<WebSocketConnection | null>(null);

  // Initialize WebSocket connection once on mount
  useEffect(() => {
    const conn = new WebSocketConnection({ url: SERVER_URL });

    conn.onStatusChange((status) => {
      useGameStore.getState().setConnectionStatus(
        status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'
      );
    });
    conn.onDeckValidation((valid, errors) => {
      setValidationErrors(valid ? [] : errors);
    });
    conn.onGameCreated((gameId) => {
      setLobbyGameId(gameId);
    });
    conn.onGameStarting((_gameId, players) => {
      wireGameCallbacks(conn);
      useGameStore.getState().setConnection(conn);
      useGameStore.getState().setViewingPlayerId(players[0]?.id ?? null);
      setScreen('game');
    });

    wsConnRef.current = conn;
    conn.connect();

    return () => conn.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — connection lives for the app lifetime

  // Start mock game
  const handleStartMock = useCallback(() => {
    if (wsConnRef.current) wsConnRef.current.disconnect();

    const mock = new MockConnection();
    wireGameCallbacks(mock);
    useGameStore.getState().setConnection(mock);
    useGameStore.getState().setConnectionStatus('mock');
    mock.connect();
    setScreen('game');
  }, []);

  // Track whether we've already handled combat this turn (prevent double-entry)
  const combatHandledRef = useRef<{ attackers: boolean; blockers: boolean }>({ attackers: false, blockers: false });

  // Reset combat tracking when turn changes
  useEffect(() => {
    if (gameState) {
      const { phase } = gameState.turnState;
      if (phase !== 'Combat') {
        combatHandledRef.current = { attackers: false, blockers: false };
      }
    }
  }, [gameState?.turnState.phase]);

  // Auto-enter combat modes — only once per combat phase
  useEffect(() => {
    if (!gameState || interaction.mode !== 'idle') return;

    const hasDeclareAttackersAction = legalActions.some((a) => a.type === 'declareAttackers');
    const hasDeclareBlockersAction = legalActions.some((a) => a.type === 'declareBlockers');

    if (hasDeclareAttackersAction && !combatHandledRef.current.attackers) {
      // Only show attackers panel if we have creatures that can attack
      const hasAttackableCreatures = Object.values(gameState.cardInstances).some((c) =>
        c.controller === viewingPlayerId && c.zone === 'Battlefield' && !c.tapped &&
        (c.modifiedPower !== null || c.basePower !== null)
      );

      combatHandledRef.current.attackers = true;
      if (hasAttackableCreatures) {
        dispatchInteraction({ type: 'ENTER_DECLARE_ATTACKERS' });
      }
      // No creatures to attack with — auto-pass will handle it
    } else if (hasDeclareBlockersAction && !combatHandledRef.current.blockers) {
      // Only show blockers panel if there are attackers AND we have creatures to block with
      const hasAttackers = gameState.combatState &&
        Object.keys(gameState.combatState.attackers ?? {}).length > 0;
      const hasOurCreatures = Object.values(gameState.cardInstances).some((c) =>
        c.controller === viewingPlayerId && c.zone === 'Battlefield' && !c.tapped &&
        (c.modifiedPower !== null || c.basePower !== null)
      );

      combatHandledRef.current.blockers = true;
      if (hasAttackers && hasOurCreatures) {
        dispatchInteraction({ type: 'ENTER_DECLARE_BLOCKERS' });
      }
      // If no attackers or no creatures to block with, skip — auto-pass will handle it
    }
  }, [legalActions, interaction.mode, gameState, dispatchInteraction]);

  // Keyboard shortcuts: Escape cancels interaction, F2 toggles auto-pass
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (castingCardId) {
          setCastingCardId(null);
          setSelectedTargets([]);
        } else if (interaction.mode !== 'idle') {
          dispatchInteraction({ type: 'CANCEL' });
        }
      }
      if (e.key === 'F2') {
        e.preventDefault();
        const s = useGameStore.getState().settings;
        useGameStore.getState().updateSettings({ ...s, autoPassPriority: !s.autoPassPriority });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interaction.mode, dispatchInteraction]);

  // ---------------------------------------------------------------------------
  // Lobby screen
  // ---------------------------------------------------------------------------

  if (screen === 'lobby') {
    return (
      <Lobby
        connection={wsConnRef.current as unknown as LobbyConnection ?? { createGame: () => {}, joinGame: () => {}, leaveGame: () => {}, listGames: () => {}, onGameCreated: () => {}, onGameStarting: () => {}, onGameList: () => {}, onDeckValidation: () => {} }}
        onStartMock={handleStartMock}
        connectionStatus={connectionStatus}
        validationErrors={validationErrors}
        gameId={lobbyGameId}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Game screen
  // ---------------------------------------------------------------------------

  if (!gameState || !viewingPlayerId) {
    return <div className={styles.loading}>Loading game...</div>;
  }

  // ---------------------------------------------------------------------------
  // Mulligan screen — shown when server sends a mulligan or bottom prompt
  // ---------------------------------------------------------------------------

  const isMulliganPrompt = prompt?.promptId?.startsWith('mulligan_');
  const isBottomPrompt = prompt?.promptId?.startsWith('bottom_');

  if (isMulliganPrompt || isBottomPrompt) {
    // Get the player's hand cards
    const handZone = gameState.zones[`player:${viewingPlayerId}:hand`];
    const handCards: import('@magic-flux/types').CardInstance[] = [];
    if (handZone && 'cardInstanceIds' in handZone && handZone.cardInstanceIds) {
      for (const id of handZone.cardInstanceIds) {
        const card = gameState.cardInstances[id];
        if (card) handCards.push(card);
      }
    }

    const mulliganOpts = prompt?.options as { type: string; mulliganCount?: number; count?: number } | undefined;
    const mulliganCount = mulliganOpts?.mulliganCount ?? 0;
    const putOnBottomCount = mulliganOpts?.count ?? 0;

    // Build card data map for mulligan cards
    const mulliganCardDataMap = buildCardDataMap(gameState.cardInstances, MOCK_CARD_DATA_MAP);

    return (
      <>
        <MulliganScreen
          cards={handCards}
          cardDataMap={mulliganCardDataMap}
          mulliganCount={mulliganCount}
          phase={isMulliganPrompt ? 'decide' : 'putOnBottom'}
          putOnBottomCount={putOnBottomCount}
          opponentStatus="Waiting for opponent..."
          onKeep={() => {
            useGameStore.getState().sendPromptResponse(prompt!.promptId, 'keep');
          }}
          onMulligan={() => {
            useGameStore.getState().sendPromptResponse(prompt!.promptId, 'mulligan');
          }}
          onPutOnBottom={(cardIds) => {
            useGameStore.getState().sendPromptResponse(prompt!.promptId, cardIds);
          }}
        />
        <CardHover enabled={settings.cardHoverZoom} />
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Waiting for opponent (mulligan done, game not started yet)
  // ---------------------------------------------------------------------------

  if (!prompt && !gameState.priorityPlayerId && !gameState.gameOver) {
    return <WaitingScene message="Waiting for opponent to finish mulliganing" />;
  }

  const activePlayer = gameState.players.find((p) => p.id === gameState.activePlayerId);
  const hasPriority = gameState.priorityPlayerId === viewingPlayerId;

  // Build card data map: static mock data + dynamic Scryfall lookups for real cards
  const cardDataMap = buildCardDataMap(gameState.cardInstances, MOCK_CARD_DATA_MAP);

  const instanceToCardDataId: Record<string, string> = {};
  for (const card of Object.values(gameState.cardInstances)) {
    instanceToCardDataId[card.instanceId] = card.cardDataId;
  }

  const playerNames: Record<string, string> = {};
  for (const p of gameState.players) {
    playerNames[p.id] = p.name;
  }

  const stackItems = gameState.stack
    .map((id) => gameState.stackItems[id])
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const handleCardClick = (instanceId: string) => {
    const card = gameState.cardInstances[instanceId];
    if (!card) return;

    // If we're in targeting mode, clicking selects a target for the current requirement
    if (castingCardId && currentReq) {
      const isValidTarget = isValidTargetForRequirement(card, instanceId, currentReq, gameState, viewingPlayerId, cardDataMap);
      if (isValidTarget) {
        const newTarget: import('@magic-flux/types').ResolvedTarget = {
          requirementId: currentReq.id,
          targetId: instanceId,
          targetType: 'card',
        };
        const allTargets = [...selectedTargets, newTarget];

        if (allTargets.length >= castingAllReqs.length) {
          // All targets selected — cast the spell
          sendAction({ type: 'castSpell', cardInstanceId: castingCardId, targets: allTargets });
          setCastingCardId(null);
          setSelectedTargets([]);
        } else {
          // More targets needed — advance to next requirement
          setSelectedTargets(allTargets);
        }
        return;
      }
      return; // Invalid target — do nothing
    }

    // Helper: is this card a creature?
    const isCreatureCard = card.modifiedPower !== null
      || card.basePower !== null
      || cardDataMap[card.cardDataId]?.typeLine?.toLowerCase().includes('creature');

    // Combat: declare attackers — toggle creatures as attackers
    if (interaction.mode === 'declareAttackers' && card.zone === 'Battlefield' && card.controller === viewingPlayerId) {
      if (isCreatureCard && !card.tapped) {
        // Allow haste creatures (summoningSickness doesn't prevent if they have haste)
        dispatchInteraction({ type: 'TOGGLE_ATTACKER', creatureInstanceId: instanceId });
        return;
      }
    }

    // Combat: declare blockers — select blocker then assign to attacker
    if (interaction.mode === 'declareBlockers') {
      if (card.zone === 'Battlefield' && card.controller === viewingPlayerId && isCreatureCard && !card.tapped) {
        dispatchInteraction({ type: 'START_ASSIGN_BLOCKER', blockerInstanceId: instanceId });
        return;
      }
      if (card.zone === 'Battlefield' && card.controller !== viewingPlayerId && isCreatureCard) {
        dispatchInteraction({ type: 'ASSIGN_BLOCKER_TO_ATTACKER', attackerInstanceId: instanceId });
        return;
      }
    }

    // Normal idle mode
    if (interaction.mode === 'idle' && card.zone === 'Hand' && card.controller === viewingPlayerId) {
      if (isPlayableLand(instanceId, legalActions)) {
        sendAction({ type: 'playLand', cardInstanceId: instanceId });
        return;
      }
      if (isCastableCard(instanceId, legalActions)) {
        const reqs = targetRequirements[instanceId];
        if (reqs && reqs.length > 0) {
          // Spell needs targets — enter targeting mode
          setCastingCardId(instanceId);
          return;
        }
        // No targets needed — cast immediately
        sendAction({ type: 'castSpell', cardInstanceId: instanceId });
        return;
      }
    }

    if (interaction.mode === 'idle' && card.zone === 'Battlefield' && card.controller === viewingPlayerId && !card.tapped) {
      const tapAction = legalActions.find(
        (a) => a.type === 'activateAbility' && a.cardInstanceId === instanceId
      );
      if (tapAction) {
        sendAction(tapAction);
        return;
      }
    }

    // No action matched — do nothing (removed generic yellow-select that was confusing)
  };

  // Handle clicking on a player (for "any target" spells like Shock)
  const handlePlayerClick = (playerId: string) => {
    if (!castingCardId || !currentReq) return;
    if (!currentReq.targetTypes.includes('player' as any)) return;
    const newTarget: import('@magic-flux/types').ResolvedTarget = {
      requirementId: currentReq.id,
      targetId: playerId,
      targetType: 'player',
    };
    const allTargets = [...selectedTargets, newTarget];

    if (allTargets.length >= castingAllReqs.length) {
      sendAction({ type: 'castSpell', cardInstanceId: castingCardId, targets: allTargets });
      setCastingCardId(null);
      setSelectedTargets([]);
    } else {
      setSelectedTargets(allTargets);
    }
  };

  const handlePassPriority = () => {
    sendAction({ type: 'passPriority' });
  };

  const handleConfirmAttackers = () => {
    if (interaction.mode !== 'declareAttackers') return;
    const attackerAssignments: Record<string, string> = {};
    const defendingPlayer = gameState.players.find((p) => p.id !== gameState.activePlayerId);
    if (defendingPlayer) {
      for (const id of interaction.selectedAttackerIds) {
        attackerAssignments[id] = defendingPlayer.id;
      }
    }
    sendAction({ type: 'declareAttackers', attackerAssignments });
    dispatchInteraction({ type: 'CANCEL' });
  };

  const handleConfirmBlockers = () => {
    if (interaction.mode !== 'declareBlockers') return;
    sendAction({ type: 'declareBlockers', blockerAssignments: interaction.blockerAssignments });
    dispatchInteraction({ type: 'CANCEL' });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (interaction.mode !== 'idle') {
      e.preventDefault();
      dispatchInteraction({ type: 'CANCEL' });
    }
  };

  const priorityPlayerName = gameState.priorityPlayerId
    ? playerNames[gameState.priorityPlayerId] ?? 'Unknown'
    : null;

  const castingCard = castingCardId ? gameState.cardInstances[castingCardId] : null;

  // Compute valid target card IDs for highlighting during targeting (uses currentReq)
  const targetableCardIds: string[] = [];
  if (castingCardId && currentReq) {
    for (const [instanceId, card] of Object.entries(gameState.cardInstances)) {
      if (isValidTargetForRequirement(card, instanceId, currentReq, gameState, viewingPlayerId, cardDataMap)) {
        targetableCardIds.push(instanceId);
      }
    }
  }

  const targetProgress = castingCardId && castingAllReqs.length > 1
    ? ` (${castingReqIndex + 1}/${castingAllReqs.length})`
    : '';

  const statusText = castingCardId
    ? `${currentReq?.description ?? 'Select a target'}${targetProgress} — ${castingCard?.cardDataId ?? 'spell'} (Esc to cancel)`
    : hasPriority
      ? 'Your priority — take an action or pass'
      : priorityPlayerName
        ? `Waiting for ${priorityPlayerName}`
        : 'No priority';

  return (
    <AnimationProvider>
      <div className={styles.app} onContextMenu={handleContextMenu}>
        <div className={styles.topBar}>
          <span>Game: {gameState.gameId}</span>
          <span>Turn {gameState.turnNumber}</span>
          <span>Format: {gameState.format}</span>
          <span>Status: {connectionStatus}</span>
          <button
            style={{ background: 'none', border: '1px solid #555', color: '#aaa', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', marginLeft: 4 }}
            onClick={() => { setScreen('lobby'); }}
          >
            Leave
          </button>
          <span style={{ marginLeft: 'auto', position: 'relative' }}>
            <button
              style={{ background: 'none', border: '1px solid #555', color: '#aaa', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
              onClick={() => setShowSettings(!showSettings)}
            >
              Settings
            </button>
            {showSettings && (
              <SettingsPanel settings={settings} onUpdate={updateSettings} />
            )}
          </span>
        </div>

        <div className={styles.mainArea}>
          <div className={styles.boardArea}>
            <GameBoard
              gameState={gameState}
              cardDataMap={cardDataMap}
              viewingPlayerId={viewingPlayerId}
              selectedCards={selectedCards}
              highlightedCards={targetableCardIds}
              onCardClick={handleCardClick}
              onPlayerClick={handlePlayerClick}
              targetablePlayerIds={castingCardId && currentReq?.targetTypes.includes('player' as any) ? gameState.players.map(p => p.id) : []}
              targetableCardIds={targetableCardIds}
              attackingCardIds={[
                ...(interaction.mode === 'declareAttackers' ? interaction.selectedAttackerIds : []),
                ...(gameState.combatState ? Object.keys(gameState.combatState.attackers) : []),
              ]}
              blockingCardIds={
                interaction.mode === 'declareBlockers'
                  ? Object.keys(interaction.blockerAssignments)
                  : (gameState.combatState ? Object.keys(gameState.combatState.blockers) : [])
              }
              pendingBlockerId={interaction.mode === 'declareBlockers' ? interaction.pendingBlockerId : null}
              legalActions={legalActions}
            />
          </div>

          <div className={styles.sidebar}>
            <PhaseIndicator
              phase={gameState.turnState.phase}
              step={gameState.turnState.step}
              turnNumber={Math.ceil(gameState.turnNumber / gameState.players.length)}
              activePlayerName={activePlayer?.name ?? 'Unknown'}
            />
            <StackDisplay
              items={stackItems}
              cardDataMap={cardDataMap}
              instanceToCardDataId={instanceToCardDataId}
              playerNames={playerNames}
              gameState={gameState}
            />
            <div className={styles.logHeader}>
              <span>Game Log</span>
              <button
                className={styles.logToggle}
                onClick={() => setShowLog(!showLog)}
              >
                {showLog ? 'Hide' : 'Show'}
              </button>
            </div>
            {showLog && <GameLog entries={gameLog} gameState={gameState} cardDataMap={cardDataMap} />}
          </div>
        </div>

        <PriorityBar
          hasPriority={hasPriority}
          onPassPriority={handlePassPriority}
          statusText={statusText}
          autoPass={settings.autoPassPriority}
          onToggleAutoPass={() => updateSettings({ ...settings, autoPassPriority: !settings.autoPassPriority })}
          gameState={gameState}
          viewingPlayerId={viewingPlayerId}
          legalActions={legalActions}
          autoPassConfig={settings.autoPassConfig}
        />

        {castingCardId && currentReq && (
          <TargetingOverlay
            castingCardName={castingCard?.cardDataId ?? 'Spell'}
            currentReq={currentReq}
            totalReqs={castingAllReqs.length}
            currentReqIndex={castingReqIndex}
            selectedTargets={selectedTargets}
            visualMode={settings.targetingVisuals}
            hasValidTargets={targetableCardIds.length > 0 || (currentReq?.targetTypes.includes('player' as any) ?? false)}
            onCancel={() => { setCastingCardId(null); setSelectedTargets([]); }}
          />
        )}

        {(interaction.mode === 'declareAttackers' || interaction.mode === 'declareBlockers') && (
          <CombatPanel
            mode={interaction.mode}
            gameState={gameState}
            cardDataMap={cardDataMap}
            viewingPlayerId={viewingPlayerId}
            selectedAttackerIds={interaction.mode === 'declareAttackers' ? interaction.selectedAttackerIds : []}
            blockerAssignments={interaction.mode === 'declareBlockers' ? interaction.blockerAssignments : {}}
            pendingBlockerId={interaction.mode === 'declareBlockers' ? interaction.pendingBlockerId : null}
            onConfirmAttackers={handleConfirmAttackers}
            onConfirmBlockers={handleConfirmBlockers}
            onCancel={() => {
              dispatchInteraction({ type: 'CANCEL' });
              sendAction({ type: 'passPriority' });
            }}
          />
        )}

        <AnimationOverlay />
        <TriggerToast gameLog={gameLog} gameState={gameState} cardDataMap={cardDataMap} />
        <CardHover enabled={settings.cardHoverZoom} />
        {prompt && !prompt.promptId.startsWith('mulligan_') && !prompt.promptId.startsWith('bottom_') && (
          <PromptOverlay
            prompt={prompt}
            cardInstances={gameState.cardInstances}
            cardDataMap={cardDataMap}
            onRespond={(promptId, selection) => {
              useGameStore.getState().sendPromptResponse(promptId, selection);
            }}
          />
        )}
      </div>
    </AnimationProvider>
  );
};
