import type {
  ClientGameState, PlayerAction, GameEvent, DecklistEntry,
  ServerMessage, ClientMessage,
} from '@magic-flux/types';
import type { GameConnection, LobbyConnection, PromptData } from './connection';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface WebSocketConnectionOptions {
  readonly url: string;
  readonly reconnectDelayMs?: number;
  readonly maxReconnectAttempts?: number;
}

/**
 * Real WebSocket connection to the Magic Flux server.
 * Implements both GameConnection and LobbyConnection interfaces.
 * Auto-reconnects with exponential backoff on disconnect.
 */
export class WebSocketConnection implements GameConnection, LobbyConnection {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly baseReconnectDelay: number;
  private readonly maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ConnectionStatus = 'disconnected';

  // Game callbacks
  private stateCallbacks: ((state: ClientGameState) => void)[] = [];
  private legalActionsCallbacks: ((actions: readonly PlayerAction[], prompt?: string) => void)[] = [];
  private eventCallbacks: ((event: GameEvent, message: string) => void)[] = [];
  private promptCallbacks: ((prompt: PromptData) => void)[] = [];
  private errorCallbacks: ((code: string, message: string) => void)[] = [];
  private gameOverCallbacks: ((winners: readonly string[], losers: readonly string[], reason: string) => void)[] = [];

  // Lobby callbacks
  private gameCreatedCallbacks: ((gameId: string, format: string) => void)[] = [];
  private gameStartingCallbacks: ((gameId: string, players: readonly { id: string; name: string }[]) => void)[] = [];
  private gameListCallbacks: ((games: readonly { gameId: string; format: string; playerCount: number; maxPlayers: number }[]) => void)[] = [];
  private deckValidationCallbacks: ((valid: boolean, errors: readonly { message: string }[]) => void)[] = [];

  // Status callback
  private statusCallbacks: ((status: ConnectionStatus) => void)[] = [];

  constructor(options: WebSocketConnectionOptions) {
    this.url = options.url;
    this.baseReconnectDelay = options.reconnectDelayMs ?? 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  }

  // ---------------------------------------------------------------------------
  // GameConnection interface
  // ---------------------------------------------------------------------------

  connect(): void {
    if (this.ws) return;
    this.setStatus('connecting');

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        this.handleServerMessage(message);
      } catch {
        console.error('Failed to parse server message');
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.setStatus('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, so reconnect happens there
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  sendAction(gameId: string, action: PlayerAction): void {
    this.send({ type: 'game:action', payload: { gameId, action } });
  }

  onStateUpdate(cb: (state: ClientGameState) => void): void { this.stateCallbacks.push(cb); }
  onLegalActions(cb: (actions: readonly PlayerAction[], prompt?: string) => void): void { this.legalActionsCallbacks.push(cb); }
  onEvent(cb: (event: GameEvent, message: string) => void): void { this.eventCallbacks.push(cb); }
  onPrompt(cb: (prompt: PromptData) => void): void { this.promptCallbacks.push(cb); }
  onError(cb: (code: string, message: string) => void): void { this.errorCallbacks.push(cb); }
  onGameOver(cb: (winners: readonly string[], losers: readonly string[], reason: string) => void): void { this.gameOverCallbacks.push(cb); }

  // ---------------------------------------------------------------------------
  // LobbyConnection interface
  // ---------------------------------------------------------------------------

  createGame(format: string, maxPlayers: number, decklist: readonly DecklistEntry[]): void {
    this.send({ type: 'lobby:createGame', payload: { format, maxPlayers, decklist } });
  }

  joinGame(gameId: string, decklist: readonly DecklistEntry[]): void {
    this.send({ type: 'lobby:joinGame', payload: { gameId, decklist } });
  }

  leaveGame(gameId: string): void {
    this.send({ type: 'lobby:leaveGame', payload: { gameId } });
  }

  listGames(): void {
    this.send({ type: 'lobby:listGames', payload: {} });
  }

  onGameCreated(cb: (gameId: string, format: string) => void): void { this.gameCreatedCallbacks.push(cb); }
  onGameStarting(cb: (gameId: string, players: readonly { id: string; name: string }[]) => void): void { this.gameStartingCallbacks.push(cb); }
  onGameList(cb: (games: readonly { gameId: string; format: string; playerCount: number; maxPlayers: number }[]) => void): void { this.gameListCallbacks.push(cb); }
  onDeckValidation(cb: (valid: boolean, errors: readonly { message: string }[]) => void): void { this.deckValidationCallbacks.push(cb); }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  onStatusChange(cb: (status: ConnectionStatus) => void): void { this.statusCallbacks.push(cb); }

  getStatus(): ConnectionStatus { return this.status; }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const cb of this.statusCallbacks) cb(status);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'game:stateUpdate':
        for (const cb of this.stateCallbacks) cb(message.payload.gameState);
        break;
      case 'game:legalActions':
        for (const cb of this.legalActionsCallbacks) cb(message.payload.actions, message.payload.prompt);
        break;
      case 'game:event':
        for (const cb of this.eventCallbacks) cb(message.payload.event, message.payload.logMessage);
        break;
      case 'game:prompt':
        for (const cb of this.promptCallbacks) cb(message.payload);
        break;
      case 'game:error':
        for (const cb of this.errorCallbacks) cb(message.payload.code, message.payload.message);
        break;
      case 'game:over':
        for (const cb of this.gameOverCallbacks) cb(message.payload.winners, message.payload.losers, message.payload.reason);
        break;
      case 'lobby:gameCreated':
        for (const cb of this.gameCreatedCallbacks) cb(message.payload.gameId, message.payload.format);
        break;
      case 'lobby:gameStarting':
        for (const cb of this.gameStartingCallbacks) cb(message.payload.gameId, message.payload.players);
        break;
      case 'lobby:gameList':
        for (const cb of this.gameListCallbacks) cb(message.payload.games);
        break;
      case 'lobby:deckValidation':
        for (const cb of this.deckValidationCallbacks) cb(message.payload.valid, message.payload.errors);
        break;
    }
  }
}
