-- FIX: Run this in Supabase SQL Editor if "Database error creating new user"
-- Then try Add user again in Authentication → Users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, 'user'), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.conversations
  SET participant_ids = array_append(participant_ids, NEW.id)
  WHERE id = '1216-private-chat'
    AND NOT (NEW.id = ANY(participant_ids));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block auth user creation if profile step fails
  RAISE WARNING 'handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow profile creation (backup if trigger runs as authenticated)
DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;
CREATE POLICY "profiles_insert_trigger" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Ensure conversation row exists
INSERT INTO conversations (id, participant_ids)
VALUES ('1216-private-chat', '{}')
ON CONFLICT (id) DO NOTHING;
