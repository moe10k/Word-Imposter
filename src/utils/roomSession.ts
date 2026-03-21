const PLAYER_NAME_STORAGE_KEY = 'playerName';
const ROOM_QUERY_PARAM = 'room';

export function getStoredPlayerName() {
  return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
}

export function storePlayerName(playerName: string) {
  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
}

export function getInitialRoomId() {
  return new URLSearchParams(window.location.search).get(ROOM_QUERY_PARAM) || '';
}

export function setRoomQuery(roomId: string) {
  window.history.replaceState({}, '', `?room=${roomId}`);
}

export function clearRoomQuery() {
  window.history.replaceState({}, '', window.location.pathname);
}

export function createRoomId() {
  return Math.random().toString(36).substring(2, 9);
}
