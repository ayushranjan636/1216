import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores';
import { getMemories, addMemory } from '@/services/extras';
import { uploadMediaFile } from '@/services/supabaseStorage';
import { isSupabaseMode } from '@/lib/supabase';
import { IconMemories } from '@/components/Icons';
import type { Memory } from '@/types';

export function MemoriesPage() {
  const { profile } = useAuthStore();
  const [items, setItems] = useState<Memory[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getMemories().then(setItems).catch(console.error);
  }, []);

  const addPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !profile) return;
      setUploading(true);
      try {
        let mediaUrl = URL.createObjectURL(file);
        if (isSupabaseMode()) {
          const { publicUrl } = await uploadMediaFile(profile.uid, file);
          mediaUrl = publicUrl;
        }
        await addMemory({
          title: 'Special Moment',
          mediaUrl,
          mediaType: 'photo',
          createdBy: profile.uid,
          createdAt: Date.now(),
        });
        setItems(await getMemories());
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <div className="page">
      <h1 className="page-title">Memories</h1>
      <p className="muted-text page-subtitle">Our special moments</p>
      <button className="btn-primary" onClick={addPhoto} disabled={uploading}>
        {uploading ? 'Uploading…' : 'Add Photo'}
      </button>

      {items.length === 0 ? (
        <div className="empty-state glass">
          <IconMemories size={48} className="empty-icon" />
          <p>Start building your memory gallery</p>
        </div>
      ) : (
        <div className="grid-memories">
          {items.map((m) => (
            <img key={m.id} src={m.mediaUrl} alt={m.title} className="mem-thumb" loading="lazy" />
          ))}
        </div>
      )}
    </div>
  );
}
