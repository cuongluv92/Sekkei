-- oku-pro — Storage-backed reference drawings for 重量計算 > 盤重量計算 > 盤本体重量
--
-- One image per layer/part key (屋内/屋外/Nitto/扉/屋根), stored in Supabase
-- Storage (bucket oku-pro-files, panel-weight-layers/<layer>.<ext>) and
-- tracked here — same single-active-row-per-key pattern as
-- weight_shape_images (0013): no version history, uploading again just
-- replaces the row/object for that layer. Starts empty; the image frame on
-- the calc page is the upload point.

create table if not exists panel_weight_layer_images (
  id uuid primary key default gen_random_uuid(),
  layer_key text not null check (layer_key in ('indoor', 'outdoor', 'nitto', 'door', 'roof')),
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);
create unique index if not exists panel_weight_layer_images_layer_key_idx on panel_weight_layer_images(layer_key);

alter table panel_weight_layer_images enable row level security;
drop policy if exists anon_all on panel_weight_layer_images;
create policy anon_all on panel_weight_layer_images for all to anon using (true) with check (true);
