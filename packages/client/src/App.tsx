import { useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import { useGameStore } from './state/game-store';
import { MockConnection } from './state/mock-connection';
import { WebSocketConnection } from './state/websocket-connection';
import { MOCK_CARD_DATA_MAP } from './mocks/mock-state';
import { AnimationProvider } from './animation/AnimationProvider';
import { AnimationOverlay } from './animation/AnimationOverlay';
import { GameBoard } from './components/GameBoard';
import { PhaseIndicator } from './components/PhaseIndicator';
import { StackDisplay } from './components/StackDisplay';
import { GameLog } from './components/GameLog';
import { PriorityBar } from './components/PriorityBar';
import { SettingsPanel } from './components/SettingsPanel';
import { Lobby } from './components/Lobby';
import { isPlayableLand, isCastableCard } from './interaction/targeting';
import type { GameConnection, LobbyConnection } from './state/connection';
import styles from './App.module.css';

type AppScreen = 'lobby' | 'game';

const SERVER_URL = 'ws://localhost:3001';

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

  const [screen, setScreen] = useState<AppScreen>('lobby');
  const [showSettings, setShowSettings] = useState(false);
  const [wsConn, setWsConn] = useState<WebSocketConnection | null>(null);
  const [validationErrors, setValidationErrors] = useState<readonly { message: string }[]>([]);
  const [lobbyGameId, setLobbyGameId] = useState<string | null>(null);

  // Wire callbacks shared by both connection types
  const wireGameCallbacks = useCallback((conn: GameConnection) => {
    conn.onStateUpdate((state) => {
      setGameState(state);
      if (!viewingPlayerId) {
        setViewingPlayerId(state.players[0]?.id ?? null);
      }
    });
    conn.onLegalActions((actions) => setLegalActions([...actions]));
    conn.onEvent((event, message) => addLogEntry(event, message));
    conn.onPrompt(() => {});
    conn.onError((code, msg) => console.error(`Game error: ${code} - ${msg}`));
    if (conn.onGameOver) {
      conn.onGameOver((winners, losers, reason) => {
        addLogEntry(
          { type: 'gameOver', winnerIds: winners, timestamp: Date.now() } as any,
          `Game Over: ${reason}`
        );
      });
    }
  }, [setGameState, setLegalActions, addLogEntry, setViewingPlayerId, viewingPlayerId]);

  // Initialize WebSocket connection on mount (for lobby)
  useEffect(() => {
    const conn = new WebSocketConnection({ url: SERVER_URL });
    conn.onStatusChange((status) => {
      setConnectionStatus(status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected');
    });
    conn.onDeckValidation((valid, errors) => {
      setValidationErrors(valid ? [] : errors);
    });
    conn.onGameCreated((gameId) => {
      setLobbyGameId(gameId);
    });
    conn.onGameStarting((gameId, players) => {
      // Game is starting — wire game callbacks and switch to game screen
      wireGameCallbacks(conn);
      setConnection(conn);
      setViewingPlayerId(players[0]?.id ?? null);
      setScreen('game');
    });
    setWsConn(conn);
    conn.connect();

    return () => conn.disconnect();
  }, [wireGameCallbacks, setConnectionStatus, setConnection, setViewingPlayerId]);

  // Start mock game
  const handleStartMock = useCallback(() => {
    if (wsConn) wsConn.disconnect();

    const mock = new MockConnection();
    wireGameCallbacks(mock);
    setConnection(mock);
    setConnectionStatus('mock');
    mock.connect();
    setScreen('game');
  }, [wsConn, wireGameCallbacks, setConnection, setConnectionStatus]);

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

  // ---------------------------------------------------------------------------
  // Lobby screen
  // ---------------------------------------------------------------------------

  if (screen === 'lobby') {
    return (
      <Lobby
        connection={wsConn as unknown as LobbyConnection ?? { createGame: () => {}, joinGame: () => {}, leaveGame: () => {}, listGames: () => {}, onGameCreated: () => {}, onGameStarting: () => {}, onGameList: () => {}, onDeckValidation: () => {} }}
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

  const handleCardClick = (instanceId: string) => {
    const card = gameState.cardInstances[instanceId];
    if (!card) return;

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

    if (interaction.mode === 'idle' && card.zone === 'Battlefield' && card.controller === viewingPlayerId && !card.tapped) {
      const tapAction = legalActions.find(
        (a) => a.type === 'activateAbility' && a.cardInstanceId === instanceId
      );
      if (tapAction) {
        sendAction(tapAction);
        return;
      }
    }

    if (selectedCards.includes(instanceId)) {
      deselectCard(instanceId);
    } else {
      selectCard(instanceId);
    }
  };

  const handlePassPriority = () => {
    sendAction({ type: 'passPriority' });
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
