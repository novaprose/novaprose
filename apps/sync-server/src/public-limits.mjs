// Limits for public (demo) rooms.
//
// Public rooms are open to everyone without a token, so the server caps them: only the listed sites may
// open them (the Origin header), only so many rooms and people at once, and a room can't grow without
// bound. That keeps the demo from becoming free hosting for other sites. Rooms that need a token aren't
// limited here: whoever issues the tokens decides who gets in.

/** The defaults. createSyncServer({ publicLimits }) overrides any of them. */
export const PUBLIC_LIMITS = Object.freeze({
  /** Sites allowed to open public rooms, as Origin header values. Empty: any site. */
  origins: [],
  /** Public rooms open at the same time. */
  maxRooms: 50,
  /** People in one public room. */
  maxRoomConnections: 25,
  /** Public-room connections from one network address. */
  maxConnectionsPerAddress: 20,
  /** One incoming message, in bytes. */
  maxMessageBytes: 512 * 1024,
  /** All edits made in one room while it is open, in bytes. */
  maxRoomBytes: 2 * 1024 * 1024,
  /** How long a room that broke a size limit stays closed, in minutes. */
  closedMinutes: 60,
});

/**
 * Refusal reasons. In onAuthenticate the reason reaches the client (onAuthenticationFailed); while
 * handling a message the error closes the connection with the code.
 */
export const REFUSED = Object.freeze({
  origin: 'demo-origin',
  busy: 'demo-busy',
  roomFull: 'demo-room-full',
  tooManyConnections: 'demo-too-many-connections',
  roomClosed: 'demo-room-closed',
});

const FORBIDDEN = 4403;

function refusal(reason, code) {
  const error = new Error(reason);
  error.reason = reason;
  if (code !== undefined) error.code = code;
  return error;
}

/** The client's network address. Behind Caddy it is the first X-Forwarded-For entry (Caddy replaces it). */
export function clientAddress(headers) {
  const forwarded = headers?.get?.('x-forwarded-for') ?? '';
  return forwarded.split(',')[0].trim() || 'direct';
}

/**
 * The bookkeeping behind the limits, called from the server's hooks.
 * @param {Partial<typeof PUBLIC_LIMITS>} options
 */
export function publicLimits(options = {}) {
  const limits = { ...PUBLIC_LIMITS, ...options };
  /** Address → open public-room connections from it. */
  const perAddress = new Map();
  /** Socket and room → the address it came from (to count down on disconnect). */
  const open = new Map();
  /** Room → bytes of edits since it opened. */
  const roomBytes = new Map();
  /** Room → the time it may open again. */
  const closedUntil = new Map();
  const key = (socketId, documentName) => `${socketId}\u0000${documentName}`;

  function isClosed(documentName) {
    const until = closedUntil.get(documentName);
    if (until === undefined) return false;
    if (until > Date.now()) return true;
    closedUntil.delete(documentName);
    return false;
  }

  function close(documentName) {
    closedUntil.set(documentName, Date.now() + limits.closedMinutes * 60_000);
  }

  return {
    limits,

    /** Before someone joins a public room: throws when they may not. */
    authenticate({ documentName, requestHeaders, instance, isPublic }) {
      if (
        limits.origins.length > 0 &&
        !limits.origins.includes(requestHeaders?.get?.('origin') ?? '')
      ) {
        throw refusal(REFUSED.origin);
      }
      if (isClosed(documentName)) throw refusal(REFUSED.roomClosed);
      const room = instance.documents.get(documentName);
      if (room) {
        if (room.getConnectionsCount() >= limits.maxRoomConnections)
          throw refusal(REFUSED.roomFull);
      } else {
        let rooms = 0;
        for (const name of instance.documents.keys()) if (isPublic(name)) rooms++;
        if (rooms >= limits.maxRooms) throw refusal(REFUSED.busy);
      }
      if ((perAddress.get(clientAddress(requestHeaders)) ?? 0) >= limits.maxConnectionsPerAddress) {
        throw refusal(REFUSED.tooManyConnections);
      }
    },

    /** Someone joined a public room. */
    connected({ documentName, requestHeaders, socketId }) {
      const address = clientAddress(requestHeaders);
      open.set(key(socketId, documentName), address);
      perAddress.set(address, (perAddress.get(address) ?? 0) + 1);
    },

    /** Someone left a public room. */
    disconnected({ documentName, socketId }) {
      const k = key(socketId, documentName);
      const address = open.get(k);
      if (address === undefined) return;
      open.delete(k);
      const left = (perAddress.get(address) ?? 1) - 1;
      if (left > 0) perAddress.set(address, left);
      else perAddress.delete(address);
    },

    /** Before a message is applied: a message that is too large, or any message in a closed room, ends the connection. */
    message({ documentName, update }) {
      if (update.byteLength > limits.maxMessageBytes) {
        close(documentName);
        throw refusal(REFUSED.roomClosed, FORBIDDEN);
      }
      if (isClosed(documentName)) throw refusal(REFUSED.roomClosed, FORBIDDEN);
    },

    /** After an edit: count its size; a room that grew too large closes. */
    changed({ documentName, update }) {
      const bytes = (roomBytes.get(documentName) ?? 0) + (update?.byteLength ?? 0);
      roomBytes.set(documentName, bytes);
      if (bytes > limits.maxRoomBytes && !isClosed(documentName)) close(documentName);
    },

    /** The room emptied and left memory. */
    unloaded(documentName) {
      roomBytes.delete(documentName);
    },
  };
}
