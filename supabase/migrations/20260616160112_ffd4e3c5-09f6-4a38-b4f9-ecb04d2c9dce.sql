CREATE POLICY "household reads quest proof files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quest-proofs'
    AND EXISTS (
      SELECT 1 FROM public.quests q
      WHERE q.household_id::text = split_part(name, '/', 1)
        AND q.household_id = public.current_household_id()
    )
  );

CREATE POLICY "assignees upload quest proof files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quest-proofs'
    AND auth.uid()::text = split_part(name, '/', 2)
  );