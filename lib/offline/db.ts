import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface OfflineSale {
  id: string;
  synced: number;
  created_at: string;
  data: {
    product_id: string;
    client_id: string;
    payment_method: 'cash' | 'pay-slow';
    installment_duration?: number;
  };
}

interface GlobalEssentialsDB extends DBSchema {
  'offline-sales': {
    key: string;
    value: OfflineSale;
    indexes: { 'by-synced': number; 'by-created': string };
  };
}

const DB_NAME = 'global-essentials';
const DB_VERSION = 1;

async function getDB(): Promise<IDBPDatabase<GlobalEssentialsDB>> {
  return openDB<GlobalEssentialsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline-sales')) {
        const store = db.createObjectStore('offline-sales', { keyPath: 'id' });
        store.createIndex('by-synced', 'synced', { unique: false });
        store.createIndex('by-created', 'created_at');
      }
    },
  });
}

export async function saveOfflineSale(sale: OfflineSale): Promise<void> {
  const db = await getDB();
  await db.put('offline-sales', sale);
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await getDB();
  const tx = db.transaction('offline-sales', 'readonly');
  const index = tx.store.index('by-synced');
  return index.getAll(IDBKeyRange.only(0));
}

export async function markSaleSynced(id: string): Promise<void> {
  const db = await getDB();
  const sale = await db.get('offline-sales', id);
  if (sale) {
    sale.synced = 1;
    await db.put('offline-sales', sale);
  }
}

export async function deleteOfflineSale(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-sales', id);
}

export async function getAllOfflineSales(): Promise<OfflineSale[]> {
  const db = await getDB();
  return db.getAll('offline-sales');
}

export async function clearSyncedSales(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('offline-sales', 'readwrite');
  const index = tx.store.index('by-synced');
  const keys = await index.getAllKeys(IDBKeyRange.only(1));
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}
