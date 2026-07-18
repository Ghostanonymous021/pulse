-- Allow reading accepted follows for public graph (followers/following lists).
-- Pending remains visible only to the two parties.

drop policy if exists "follows_select_participants" on public.follows;

create policy "follows_select_visibility"
  on public.follows
  for select
  to authenticated
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or status = 'accepted'
  );
