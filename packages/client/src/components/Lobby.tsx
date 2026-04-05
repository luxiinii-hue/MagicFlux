import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { LobbyConnection } from '../state/connection';
import styles from './Lobby.module.css';

interface GameListEntry {
  readonly gameId: string;
  readonly format: string;
  readonly playerCount: number;
  readonly maxPlayers: number;
}

interface LobbyProps {
  readonly connection: LobbyConnection;
  readonly onStartMock: () => void;
  readonly connectionStatus: string;
  readonly validationErrors: readonly { message: string }[];
  readonly gameId: string | null;
}

const DEFAULT_DECKLIST = `4 Lightning Bolt
4 Shock
4 Goblin Guide
4 Monastery Swiftspear
4 Eidolon of the Great Revel
24 Mountain
4 Searing Blaze
4 Lava Spike
4 Rift Bolt
4 Skullcrack`;

export const Lobby: FC<LobbyProps> = ({
  connection,
  onStartMock,
  connectionStatus,
  validationErrors,
  gameId,
}) => {
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('magic-flux-name') ?? '');
  const [format, setFormat] = useState('standard');
  const [deckText, setDeckText] = useState(DEFAULT_DECKLIST);
  const [joinGameId, setJoinGameId] = useState('');
  const [activeGames, setActiveGames] = useState<GameListEntry[]>([]);

  // Poll for active games when connected
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    connection.onGameList((games) => {
      setActiveGames([...games]);
    });

    // Fetch immediately and then every 5 seconds
    connection.listGames();
    const interval = setInterval(() => connection.listGames(), 5000);
    return () => clearInterval(interval);
  }, [connection, connectionStatus]);

  const parseDecklistText = (text: string) => {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s*(\d+)?)?$/);
        if (!match) return null;
        return {
          count: parseInt(match[1], 10),
          cardName: match[2].trim(),
          cardDataId: null,
          setCode: match[3] ?? null,
          collectorNumber: match[4] ?? null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  };

  const handleCreate = () => {
    const entries = parseDecklistText(deckText);
    connection.createGame(format, 2, entries);
  };

  const handleJoin = () => {
    const entries = parseDecklistText(deckText);
    connection.joinGame(joinGameId, entries);
  };

  return (
    <div className={styles.lobby}>
      <div className={styles.title}>Magic Flux</div>
      <div className={styles.subtitle}>
        Connection: {connectionStatus}
        {gameId && <> | Game: {gameId}</>}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>Player</div>
        <div className={styles.field}>
          <span className={styles.label}>Your Name</span>
          <input
            className={styles.input}
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              localStorage.setItem('magic-flux-name', e.target.value);
            }}
            placeholder="Enter your name..."
          />
        </div>
      </div>

      <div className={styles.modeToggle}>
        <button className={styles.modeButton} onClick={onStartMock}>
          Play vs Mock AI
        </button>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>Create Game</div>
        <div className={styles.field}>
          <span className={styles.label}>Format</span>
          <select className={styles.select} value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="modern">Modern</option>
            <option value="commander">Commander</option>
          </select>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Decklist (paste Moxfield/MTGA format)</span>
          <textarea
            className={styles.textarea}
            value={deckText}
            onChange={(e) => setDeckText(e.target.value)}
            placeholder="4 Lightning Bolt&#10;4 Mountain&#10;..."
          />
        </div>
        {validationErrors.length > 0 && (
          <ul className={styles.validationList}>
            {validationErrors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        )}
        <div className={styles.buttonRow}>
          <button className={styles.button} onClick={handleCreate} disabled={connectionStatus !== 'connected'}>
            Create Game
          </button>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>Active Games</div>
        {activeGames.length === 0 ? (
          <div style={{ fontSize: 13, color: '#666' }}>
            {connectionStatus === 'connected' ? 'No games available — create one!' : 'Connect to see games'}
          </div>
        ) : (
          <ul className={styles.gameList}>
            {activeGames.map((game) => (
              <li key={game.gameId} className={styles.gameItem}>
                <div>
                  <div className={styles.gameInfo}>{game.gameId}</div>
                  <div className={styles.gameFormat}>
                    {game.format} — {game.playerCount}/{game.maxPlayers} players
                  </div>
                </div>
                <button
                  className={styles.button}
                  onClick={() => {
                    const entries = parseDecklistText(deckText);
                    connection.joinGame(game.gameId, entries);
                  }}
                  disabled={connectionStatus !== 'connected'}
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTitle}>Join by ID</div>
        <div className={styles.field}>
          <span className={styles.label}>Game ID</span>
          <input
            className={styles.input}
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value)}
            placeholder="Enter game ID..."
          />
        </div>
        <div className={styles.buttonRow}>
          <button
            className={styles.button}
            onClick={handleJoin}
            disabled={connectionStatus !== 'connected' || !joinGameId}
          >
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
};
