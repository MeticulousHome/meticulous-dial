import { FreePourSession } from './types';
import {
  getLatestBackendFreePourOnlySession,
  getLatestBackendFreePourSession,
  persistFreePourSession
} from './historyApi';

const DATABASE_NAME = 'meticulous-brew-history';
const DATABASE_VERSION = 2;
const STORE_NAME = 'brew-sessions';
const PENDING_STORE_NAME = 'pending-backend-sessions';
const MAX_LOCAL_SESSIONS = 128;
const MAX_PENDING_SYNC_PER_RUN = 10;

let databasePromise: Promise<IDBDatabase> | null = null;
let memoryFallback: FreePourSession[] = [];
let latestSessionCache: FreePourSession | null = null;

const openDatabase = () => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('completedAt', 'completedAt');
      }
      if (!database.objectStoreNames.contains(PENDING_STORE_NAME)) {
        const pendingStore = database.createObjectStore(PENDING_STORE_NAME, {
          keyPath: 'id'
        });
        if ((event as IDBVersionChangeEvent).oldVersion > 0) {
          const sessionStore = request.transaction?.objectStore(STORE_NAME);
          const cursorRequest = sessionStore?.openCursor();
          if (cursorRequest) {
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) return;
              pendingStore.put({ id: cursor.key, queuedAt: Date.now() });
              cursor.continue();
            };
          }
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
};

const cacheSession = async (
  session: FreePourSession,
  queueForBackend: boolean
) => {
  latestSessionCache = session;
  if (typeof indexedDB === 'undefined') {
    memoryFallback = [
      session,
      ...memoryFallback.filter((item) => item.id !== session.id)
    ].slice(0, MAX_LOCAL_SESSIONS);
    return;
  }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [STORE_NAME, PENDING_STORE_NAME],
      'readwrite'
    );
    const sessionStore = transaction.objectStore(STORE_NAME);
    const pendingStore = transaction.objectStore(PENDING_STORE_NAME);
    sessionStore.put(session);
    if (queueForBackend) {
      pendingStore.put({
        id: session.id,
        queuedAt: Date.now()
      });
    }
    let retained = 0;
    const pruneRequest = sessionStore
      .index('completedAt')
      .openCursor(null, 'prev');
    pruneRequest.onsuccess = () => {
      const cursor = pruneRequest.result;
      if (!cursor) return;
      retained += 1;
      if (retained > MAX_LOCAL_SESSIONS) {
        sessionStore.delete(cursor.primaryKey);
        pendingStore.delete(cursor.primaryKey);
      }
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

const markBackendPersisted = async (sessionId: string) => {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE_NAME, 'readwrite');
    transaction.objectStore(PENDING_STORE_NAME).delete(sessionId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveFreePourSession = async (session: FreePourSession) => {
  await cacheSession(session, true);
  await persistFreePourSession(session);
  await markBackendPersisted(session.id);
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

export const getLatestFreePourSession = async () => getLatestDurableSession();

const getLatestDurableSession = async () => {
  const local = latestSessionCache ?? (await getFreePourSessions(1))[0] ?? null;
  try {
    const backend = await getLatestBackendFreePourSession();
    if (
      backend &&
      (!local ||
        new Date(backend.completedAt).getTime() >
          new Date(local.completedAt).getTime())
    ) {
      await cacheSession(backend, false);
      return backend;
    }
  } catch {
    // The local cache remains usable while the backend is starting or offline.
  }
  return local;
};

export const getLatestFreePourOnlySession = async () => {
  const latest = await getLatestDurableSession();
  if (latest?.mode === 'free_pour') return latest;
  const local = (await getFreePourSessions()).find(
    (session) => session.mode === 'free_pour'
  );
  try {
    const backend = await getLatestBackendFreePourOnlySession();
    if (
      backend &&
      (!local ||
        new Date(backend.completedAt).getTime() >
          new Date(local.completedAt).getTime())
    ) {
      await cacheSession(backend, false);
      return backend;
    }
  } catch {
    // The local cached Free Pour remains available if the backend is offline.
  }
  return local;
};

const getPendingSessionIds = async () => {
  if (typeof indexedDB === 'undefined') return [];
  const database = await openDatabase();
  return new Promise<string[]>((resolve, reject) => {
    const transaction = database.transaction(PENDING_STORE_NAME, 'readonly');
    const request = transaction.objectStore(PENDING_STORE_NAME).getAllKeys();
    request.onsuccess = () => resolve(request.result.map(String));
    request.onerror = () => reject(request.error);
  });
};

const getSessionById = async (sessionId: string) => {
  if (typeof indexedDB === 'undefined') {
    return memoryFallback.find((session) => session.id === sessionId) ?? null;
  }
  const database = await openDatabase();
  return new Promise<FreePourSession | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(sessionId);
    request.onsuccess = () =>
      resolve((request.result as FreePourSession | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
};

export const syncPendingFreePourSessions = async () => {
  const pendingIds = await getPendingSessionIds();
  const attemptIds = pendingIds.slice(0, MAX_PENDING_SYNC_PER_RUN);
  let synced = 0;
  for (const sessionId of attemptIds) {
    const session = await getSessionById(sessionId);
    if (!session) {
      await markBackendPersisted(sessionId);
      continue;
    }
    try {
      await persistFreePourSession(session);
      await markBackendPersisted(sessionId);
      synced += 1;
    } catch {
      // Keep this session pending for the next startup or completed brew.
    }
  }
  return { pending: pendingIds.length - synced, synced };
};
