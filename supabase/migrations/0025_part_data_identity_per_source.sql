-- oku-pro — 部品製作からの自動登録(部品製作から自動登録) と インポート画面/
-- カタログ由来のデータを完全に別データとして扱えるようにする。
--
-- 0015_part_data_trash.sql で追加した part_data_identity_idx は
-- (manufacturer_id, category, model, specification) の組み合わせだけで
-- 一意性を見ており、source (部品製作から自動登録 / インポート / ...) を
-- 区別していなかった。そのため、部品製作 の取込で登録しようとした部品が、
-- たまたま インポート 側に同じメーカー・品名・型番・仕様のレコードを既に
-- 持っているというだけで DB の unique index に弾かれ、自動登録側には
-- 永遠に登録できない(常に「インポート側のレコードに丸め込まれる」ように
-- 見える)問題があった。source をキーに含めて張り直す — 同じ内容でも
-- 自動登録／インポートそれぞれの世界で別レコードとして共存できるようにする
-- (それぞれの世界の中での重複は引き続き防ぐ)。
drop index if exists part_data_identity_idx;
create unique index if not exists part_data_identity_idx
  on part_data (manufacturer_id, category, model, specification, source)
  where deleted_at is null;
