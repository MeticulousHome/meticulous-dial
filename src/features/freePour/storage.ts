import { FreePourSession } from './types';

const DATABASE_NAME = 'meticulous-brew-history';
const DATABASE_VERSION = 1;
const STORE_NAME = 'brew-sessions';

let databasePromise: Promise<IDBDatabase> | null = null;
let memoryFallback: FreePourSession[] = [];
let latestSessionCache: FreePourSession | null = null;

const openDatabase = () => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('completedAt', 'completedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
};

export const saveFreePourSession = async (session: FreePourSession) => {
  latestSessionCache = session;
  if (typeof indexedDB === 'undefined') {
    memoryFallback = [
      session,
      ...memoryFallback.filter((item) => item.id !== session.id)
    ];
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getFreePourSessions = async (limit = 50) => {
  if (typeof indexedDB === 'undefined') return memoryFallback.slice(0, limit);
  const database = await openDatabase();
  return new Promise<FreePourSession[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const index = transaction.objectStore(STORE_NAME).index('completedAt');
    const sessions: FreePourSession[] = [];
    const request = index.openCursor(null, 'prev');
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || sessions.length >= limit) {
        resolve(sessions);
        return;
      }
      sessions.push(cursor.value as FreePourSession);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
};

export const getLatestFreePourSession = async () =>
  latestSessionCache ?? (await getFreePourSessions(1))[0] ?? null;

export const getLatestFreePourOnlySession = async () => {
  if (latestSessionCache?.mode === 'free_pour') return latestSessionCache;
  return (await getFreePourSessions()).find(
    (session) => session.mode === 'free_pour'
  );
};
