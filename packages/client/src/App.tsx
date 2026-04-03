import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useGameStore } from './state/game-store';
import { MockConnection } from './state/mock-connection';
import { MOCK_CARD_DATA_MAP } from './mocks/mock-state';
import { AnimationProvider } from './animation/AnimationProvider';
import { AnimationOverlay } from './animation/AnimationOverlay';
import { GameBoard } from './components/GameBoard';
import { PhaseIndicator } from './components/PhaseIndicator';
import { StackDisplay } from './components/StackDisplay';
import { GameLog } from './components/GameLog';
import { PriorityBar } from './components/PriorityBar';
import { SettingsPanel } from './components/SettingsPanel';
import { isPlayableLand, isCastableCard } from './interaction/targeting';
import styles from './App.module.css';

export const App: FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const legalActions = useGameStore((s) => s.legalActions);
  const gameLog = useGameStore((s) => s.gameLog);
  const selectedCards = useGameStore((s) => s.selectedCards);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const viewingPlayerId = useGameStore((s) => s.viewingPlayerId);
  const interaction = useGameStore((s) => s.interaction);
  const settings = useGameStore((s) => s.settings);
  const setGameState = useGameStore((s) => s.setGameState);
  const setLegalActions = useGameStore((s) => s.setLegalActions);
  const addLogEntry = useGameStore((s) => s.addLogEntry);
  const setConnectionStatus = useGameStore((s) => s.setConnectionStatus);
  const setViewingPlayerId = useGameStore((s) => s.setViewingPlayerId);
  const setConnection = useGameStore((s) => s.setConnection);
  const sendAction = useGameStore((s) => s.sendAction);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const dispatchInteraction = useGameStore((s) => s.dispatchInteraction);
  const selectCard = useGameStore((s) => s.selectCard);
  const deselectCard = useGameStore((s) => s.deselectCard);

  const [showSettings, setShowSettings] = useState(false);

  // Initialize MockConnection
  useEffect(() => {
    const conn = new MockConnection();
    conn.onStateUpdate((state) => {
      setGameState(state);
      setViewingPlayerId(state.players[0].id);
    });
    conn.onLegalActions((actions) => setLegalActions(actions));
    conn.onEvent((event, message) => addLogEntry(event, message));
    conn.onPrompt(() => {});
    conn.onError((code, msg) => console.error(`Game error: ${code} - ${msg}`));

    setConnection(conn);
    setConnectionStatus('mock');
    conn.connect();

    return () => conn.disconnect();
  }, [setGameState, setLegalActions, addLogEntry, setConnectionStatus, setViewingPlayerId, setConnection]);

  // Escape key cancels current interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && interaction.mode !== 'idle') {
        dispatchInteraction({ type: 'CANCEL' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interaction.mode, dispatchInteraction]);

  if (!gameState || !viewingPlayerId) {
    return <div className={styles.loading}>Loading game...</div>;
  }

  const activePlayer = gameState.players.find((p) => p.id === gameState.activePlayerId);
  const hasPriority = gameState.priorityPlayerId === viewingPlayerId;

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

  // Card click handler — context-aware based on interaction mode
  const handleCardClick = (instanceId: string) => {
    const card = gameState.cardInstances[instanceId];
    if (!card) return;

    // In idle mode: check if clicking a card in hand to play/cast
    if (interaction.mode === 'idle' && card.zone === 'Hand' && card.controller === viewingPlayerId) {
      if (isPlayableLand(instanceId, legalActions)) {
        sendAction({ type: 'playLand', cardInstanceId: instanceId });
        return;
      }
      if (isCastableCard(instanceId, legalActions)) {
        sendAction({ type: 'castSpell', cardInstanceId: instanceId });
        return;
      }
    }

    // In idle mode: check if clicking a land on battlefield to tap for mana
    if (interaction.mode === 'idle' && card.zone === 'Battlefield' && card.controller === viewingPlayerId && !card.tapped) {
      const tapAction = legalActions.find(
        (a) => a.type === 'activateAbility' && a.cardInstanceId === instanceId
      );
      if (tapAction) {
        sendAction(tapAction);
        return;
      }
    }

    // Fallback: toggle selection
    if (selectedCards.includes(instanceId)) {
      deselectCard(instanceId);
    } else {
      selectCard(instanceId);
    }
  };

  const handlePassPriority = () => {
    sendAction({ type: 'passPriority' });
  };

  // Right-click cancels interaction
  const handleContextMenu = (e: React.MouseEvent) => {
    if (interaction.mode !== 'idle') {
      e.preventDefault();
      dispatchInteraction({ type: 'CANCEL' });
    }
  };

  const priorityPlayerName = gameState.priorityPlayerId
    ? playerNames[gameState.priorityPlayerId] ?? 'Unknown'
    : null;

  const statusText = hasPriority
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
              cardDataMap={MOCK_CARD_DATA_MAP}
              viewingPlayerId={viewingPlayerId}
              selectedCards={selectedCards}
              onCardClick={handleCardClick}
              legalActions={legalActions}
            />
          </div>

          <div className={styles.sidebar}>
            <PhaseIndicator
              phase={gameState.turnState.phase}
              step={gameState.turnState.step}
              turnNumber={gameState.turnNumber}
              activePlayerName={activePlayer?.name ?? 'Unknown'}
            />
            <StackDisplay
              items={stackItems}
              cardDataMap={MOCK_CARD_DATA_MAP}
              instanceToCardDataId={instanceToCardDataId}
              playerNames={playerNames}
            />
            <GameLog entries={gameLog} />
          </div>
        </div>

        <PriorityBar
          hasPriority={hasPriority}
          onPassPriority={handlePassPriority}
          statusText={statusText}
        />

        <AnimationOverlay />
      </div>
    </AnimationProvider>
  );
};
