-- 1216 Supabase schema (run in SQL Editor or via Supabase CLI)

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single conversation for the couple
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT '1216-private-chat',
  participant_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO conversations (id, participant_ids)
VALUES ('1216-private-chat', '{}')
ON CONFLICT (id) DO NOTHING;

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL DEFAULT '1216-private-chat' REFERENCES conversations(id),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  media_url TEXT,
  media_path TEXT,
  reply_to_id UUID,
  reply_to_preview TEXT,
  reactions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'sent',
  view_once BOOLEAN NOT NULL DEFAULT FALSE,
  viewed_by UUID[] NOT NULL DEFAULT '{}',
  read_by UUID[] NOT NULL DEFAULT '{}',
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_snaps ON messages(type, created_at DESC) WHERE type = 'snap';

-- Calls
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES profiles(id),
  callee_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_participants ON calls(caller_id, callee_id, created_at DESC);

-- WebRTC signaling
CREATE TABLE IF NOT EXISTS call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  from_id UUID NOT NULL REFERENCES profiles(id),
  to_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_signals_call ON call_signals(call_id, created_at);

-- Memories
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  media_url TEXT NOT NULL,
  media_path TEXT,
  media_type TEXT NOT NULL DEFAULT 'photo',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily notes
CREATE TABLE IF NOT EXISTS daily_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  saved_by UUID NOT NULL REFERENCES profiles(id),
  preview TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  UPDATE conversations
  SET participant_ids = array_append(participant_ids, NEW.id)
  WHERE id = '1216-private-chat'
    AND NOT (NEW.id = ANY(participant_ids));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_couple_member()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() IN (
    SELECT unnest(participant_ids) FROM conversations WHERE id = '1216-private-chat'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "profiles_read" ON profiles FOR SELECT TO authenticated
  USING (is_couple_member());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "conversations_read" ON conversations FOR SELECT TO authenticated
  USING (is_couple_member());

CREATE POLICY "messages_all" ON messages FOR ALL TO authenticated
  USING (is_couple_member()) WITH CHECK (is_couple_member());

CREATE POLICY "calls_all" ON calls FOR ALL TO authenticated
  USING (is_couple_member()) WITH CHECK (is_couple_member());

CREATE POLICY "signals_all" ON call_signals FOR ALL TO authenticated
  USING (is_couple_member()) WITH CHECK (is_couple_member());

CREATE POLICY "memories_all" ON memories FOR ALL TO authenticated
  USING (is_couple_member()) WITH CHECK (is_couple_member());

CREATE POLICY "notes_all" ON daily_notes FOR ALL TO authenticated
  USING (is_couple_member()) WITH CHECK (is_couple_member());

CREATE POLICY "favorites_all" ON favorites FOR ALL TO authenticated
  USING (is_couple_member()) WITH CHECK (is_couple_member());

-- Storage bucket (run separately if needed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');
CREATE POLICY "media_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media');
CREATE POLICY "media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;
