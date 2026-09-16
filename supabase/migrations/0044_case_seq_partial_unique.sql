-- oku-pro — 設計依頼から新規案件を作成すると「作成中...」のまま無限に
-- スピナーが回り続ける不具合を修正。
--
-- 原因: design_cases_year_sequence_no_key はUNIQUE制約なので、論理削除
-- (deleted_at設定)されたテスト用の行であっても(year, sequence_no)の
-- 組はDB上ずっと使用済みのまま残る。一方0043で「次番号=削除されていない
-- 行のmax(sequence_no)+1」に直したため、過去に一度でも使われて後から
-- 削除された番号(例: 26-040を作ってすぐ削除したケース)と同じ番号を
-- 再度計算してINSERTしようとして、UNIQUE制約違反でエラーになっていた。
-- NewCaseModal側がこのエラーを捕捉していなかったため、送信ボタンの
-- スピナーが止まらないまま固まって見えていた(下のNewCaseModal.tsx修正と
-- セット)。
--
-- 修正: UNIQUE制約を「論理削除されていない行だけ」を対象にした部分
-- ユニークインデックスに置き換える。削除済みの行はもう対象外になるため、
-- 削除して空いた番号を新しい案件が問題なく使えるようになる(現在アクティブ
-- な行同士の重複は引き続き防止される)。

alter table design_cases
  drop constraint if exists design_cases_year_sequence_no_key;

create unique index if not exists design_cases_year_sequence_no_active_key
  on design_cases (year, sequence_no)
  where deleted_at is null;
