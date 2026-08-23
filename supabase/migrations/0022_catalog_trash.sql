-- oku-pro — soft delete (ゴミ箱/trash) for カタログ, matching 0015's
-- treatment of 部品データ・部品図: removing a row from the UI moves it to
-- the trash (recoverable via restore()) instead of losing it outright, and
-- a separate purge() action does the real permanent delete from the ゴミ箱
-- screen. Every catalogs query needs `deleted_at is null` added on the app
-- side — this migration only prepares the schema.

alter table catalogs add column if not exists deleted_at timestamptz;
