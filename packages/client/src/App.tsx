import { useEffect } from 'react';
import type { FC } from 'react';
import { useGameStore } from './state/game-store';
import { createMockGameState, createMockLegalActions, createMockGameLog, MOCK_CARD_DATA_MAP } from './mocks/mock-state';
import { GameBoard } from './components/GameBoard';
import { PhaseIndicator } from './components/PhaseIndicator';
import { StackDisplay } from './components/StackDisplay';
import { GameLog } from './components/GameLog';
import { PriorityBar } from './components/PriorityBar';
import styles from './App.module.css';

export const App: FC = () => {
  const gameState = useGameStore((s) => s.gameState);
  const gameLog = useGameStore((s) => s.gameLog);
  const selectedCards = useGameStore((s) => s.selectedCards);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const viewingPlayerId = useGameStore((s) => s.viewingPlayerId);
  const setGameState = useGameStore((s) => s.setGameState);
  const setLegalActions = useGameStore((s) => s.setLegalActions);
  const addLogEntry = useGameStore((s) => s.addLogEntry);
  const setConnectionStatus = useGameStore((s) => s.setConnectionStatus);
  const setViewingPlayerId = useGameStore((s) => s.setViewingPlayerId);
  const selectCard = useGameStore((s) => s.selectCard);
  const deselectCard = useGameStore((s) => s.deselectCard);

  useEffect(() => {
    const mockState = createMockGameState();
    setGameState(mockState);
    setLegalActions(createMockLegalActions());
    setConnectionStatus('mock');
    setViewingPlayerId(mockState.players[0].id);

    for (const entry of createMockGameLog()) {
      addLogEntry(entry.event, entry.message);
    }
  }, [setGameState, setLegalActions, setConnectionStatus, setViewingPlayerId, addLogEntry]);

  if (!gameState || !viewingPlayerId) {
    return <div className={styles.loading}>Loading game...</div>;
  }

  const activePlayer = gameState.players.find((p) => p.id === gameState.activePlayerId);
  const hasPriority = gameState.priorityPlayerId === viewingPlayerId;

  const instanceToCardDataId: Record<string, string> = {};
  for (const [id, card] of Object.entries(gameState.cardInstances)) {
    instanceToCardDataId[id] = card.cardDataId;
  }

  const playerNames: Record<string, string> = {};
  for (const p of gameState.players) {
    playerNames[p.id] = p.name;
  }

  const stackItems = gameState.stack
    .map((id) => gameState.stackItems[id])
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  const handleCardClick = (instanceId: string) => {
    if (selectedCards.includes(instanceId)) {
      deselectCard(instanceId);
    } else {
      selectCard(instanceId);
    }
  };

  const handlePassPriority = () => {
    console.debug('Pass priority');
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
    <div className={styles.app}>
      <div className={styles.topBar}>
        <span>Game: {gameState.gameId}</span>
        <span>Turn {gameState.turnNumber}</span>
        <span>Format: {gameState.format}</span>
        <span>Status: {connectionStatus}</span>
      </div>

      <div className={styles.mainArea}>
        <div className={styles.boardArea}>
          <GameBoard
            gameState={gameState}
            cardDataMap={MOCK_CARD_DATA_MAP}
            viewingPlayerId={viewingPlayerId}
            selectedCards={selectedCards}
            onCardClick={handleCardClick}
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
    </div>
  );
};
