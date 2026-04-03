/**
 * Lobby — game creation, joining, and listing.
 *
 * Manages the lifecycle of game sessions from creation through start.
 * Once a game starts, the session handles all game logic.
 */

import type { GameFormat, DecklistEntry } from "@magic-flux/types";
import { GameSession, type PlayerConnection } from "../game-session/session.js";

let nextGameId = 1;

function generateGameId(): string {
  return `game_${nextGameId++}`;
}

export interface GameListEntry {
  readonly gameId: string;
  readonly format: string;
  readonly creatorName: string;
  readonly playerCount: number;
  readonly maxPlayers: number;
}

export class Lobby {
  private readonly sessions = new Map<string, GameSession>();

  createGame(
    format: GameFormat,
    maxPlayers: number,
    creatorId: string,
    creatorName: string,
    decklist: readonly DecklistEntry[],
    connection: PlayerConnection
  ): GameSession {
    const gameId = generateGameId();
    const session = new GameSession(gameId, format, maxPlayers);
    session.addPlayer(creatorId, creatorName, decklist, connection);
    this.sessions.set(gameId, session);
    return session;
  }

  joinGame(
    gameId: string,
    playerId: string,
    playerName: string,
    decklist: readonly DecklistEntry[],
    connection: PlayerConnection
  ): GameSession | null {
    const session = this.sessions.get(gameId);
    if (!session) return null;
    if (!session.addPlayer(playerId, playerName, decklist, connection)) return null;
    return session;
  }

  leaveGame(gameId: string, playerId: string): boolean {
    const session = this.sessions.get(gameId);
    if (!session) return false;
    const removed = session.removePlayer(playerId);

    // Clean up empty sessions
    if (removed && session.getPlayerCount() === 0) {
      this.sessions.delete(gameId);
    }
    return removed;
  }

  getSession(gameId: string): GameSession | undefined {
    return this.sessions.get(gameId);
  }

  listGames(): GameListEntry[] {
    const games: GameListEntry[] = [];
    for (const session of this.sessions.values()) {
      if (session.getStatus() === "waiting") {
        games.push({
          gameId: session.gameId,
          format: session.format,
          creatorName: session.getCreatorName(),
          playerCount: session.getPlayerCount(),
          maxPlayers: session.maxPlayers,
        });
      }
    }
    return games;
  }

  removeSession(gameId: string): void {
    this.sessions.delete(gameId);
  }
}
