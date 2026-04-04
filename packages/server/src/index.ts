/**
 * @magic-flux/server — Game Coordinator entry point.
 *
 * Creates and starts the WebSocket server. The server coordinates
 * game sessions, routing player actions to the engine and broadcasting
 * results to clients.
 */

// Game session
export { GameSession } from "./game-session/session.js";
export type { PlayerConnection, SessionStatus } from "./game-session/session.js";
export { filterStateForPlayer } from "./game-session/state-filter.js";
export { formatEventLog } from "./game-session/event-log.js";

// WebSocket
export { createMagicFluxServer } from "./websocket/server.js";
export type { MagicFluxServer, MagicFluxServerOptions } from "./websocket/server.js";
export { handleClientMessage } from "./websocket/handlers.js";
export type { ConnectedClient } from "./websocket/handlers.js";

// Protocol types — import from @magic-flux/types directly.
// Server re-exports only server-specific types, not shared protocol types.

// Lobby
export { Lobby } from "./lobby/lobby.js";
export type { GameListEntry } from "./lobby/lobby.js";
