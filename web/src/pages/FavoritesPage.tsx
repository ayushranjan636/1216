import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores';
import { getFavorites } from '@/services/extras';
import { IconStar, IconMemories } from '@/components/Icons';
import type { FavoriteMessage } from '@/types';

export function FavoritesPage() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<FavoriteMessage[]>([]);

  useEffect(() => {
    if (!profile) return;
    getFavorites(profile.uid).then(setItems).catch(console.error);
  }, [profile?.uid]);

  return (
    <div className="page">
      <h1 className="page-title">Favorite Messages</h1>
      {items.length === 0 ? (
        <div className="empty-state glass">
          <IconStar size={40} className="empty-icon" />
          <p>Tap React on a message and save it here</p>
        </div>
      ) : (
        items.map((f) => (
          <div key={f.id} className="glass favorite-item">
            <IconMemories size={16} className="favorite-icon" />
            <span>{f.preview}</span>
          </div>
        ))
      )}
    </div>
  );
}
