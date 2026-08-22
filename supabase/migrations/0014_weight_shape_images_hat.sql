-- oku-pro — allow ハット形 (hat) as a 4th shape for weight_shape_images.
--
-- 0013 created the shape_key CHECK as ('angle', 'channel', 'flatBar') only;
-- weightShapes.ts now also defines 'hat'. Widen the constraint in place
-- (drop + recreate) rather than a new table — same idempotent-migration
-- practice as 0012. Safe to re-run: dropping a constraint that doesn't
-- exist is a no-op guarded by `if exists`.

alter table weight_shape_images
  drop constraint if exists weight_shape_images_shape_key_check;

alter table weight_shape_images
  add constraint weight_shape_images_shape_key_check
  check (shape_key in ('angle', 'channel', 'flatBar', 'hat'));
