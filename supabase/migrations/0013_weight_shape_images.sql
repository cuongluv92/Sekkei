-- oku-pro — Storage-backed reference drawings for 重量計算 > 基本重量計算
--
-- One image per shape (アングル/チャンネル/フラットバー), stored in Supabase
-- Storage (bucket oku-pro-files, weight-shapes/<shape>.<ext>) and tracked
-- here — same single-active-row-per-key pattern as part_templates (0009):
-- no version history, uploading again just replaces the row/object for
-- that shape. Starts empty; the placeholder box on the calc page is the
-- upload point.

create table if not exists weight_shape_images (
  id uuid primary key default gen_random_uuid(),
  shape_key text not null check (shape_key in ('angle', 'channel', 'flatBar')),
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);
create unique index if not exists weight_shape_images_shape_key_idx on weight_shape_images(shape_key);

alter table weight_shape_images enable row level security;
drop policy if exists anon_all on weight_shape_images;
create policy anon_all on weight_shape_images for all to anon using (true) with check (true);
