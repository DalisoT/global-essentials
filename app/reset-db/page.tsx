'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetDBPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(databases.map((db) => {
          if (db.name) return indexedDB.deleteDatabase(db.name);
          return Promise.resolve();
        }));
        alert('All IndexedDB cleared! You can now use the app.');
        router.push('/');
      } catch (err) {
        alert('Failed to clear: ' + err);
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-white/60">Clearing all databases...</p>
        <p className="text-white/30 text-sm">This may take a moment</p>
      </div>
    </div>
  );
}
