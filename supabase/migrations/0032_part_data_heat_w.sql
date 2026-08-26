-- oku-pro — 部品データに発熱量(W)を追加する。
--
-- 換気計算(JSIA-T1016)の盤内部発熱源表で使う発熱量Wを、部品データ側でも
-- 記録できるようにする(将来、部品データの型番から発熱量を自動反映する
-- 連携機能を作る前段として、まずデータを持てるようにする)。単位は換気計算
-- 側の HeatSourceItem.heatW と揃えてW(ワット)、任意項目。
alter table part_data add column if not exists heat_w numeric;
