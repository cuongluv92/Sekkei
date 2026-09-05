# kW選定データの出典と照合範囲

この実装では、利用者のExcelファイルを使用していない。メーカーの公開カタログ／公式選定表から転記した値だけをカタログ値として扱い、条件が不足する項目、数値表を原本で照合できない項目、形名を一意に確定できない項目は `要確認` とする。

## 三菱電機

- **WS-V 24B版** — [低圧遮断器総合カタログ](https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/lvcb/yn-c-0701/y0701y2412.pdf)、表4-11～4-14（印刷ページ156～157）。SF-PR・4極の0.75～55 kWについて、200/400 Vおよび直入れ／スター・デルタの負荷電流と遮断器候補を照合した。表の始動倍率は遮断器選定条件であり、始動電流値への換算には使用していない。必要遮断容量が未入力、または候補の遮断容量を超える場合は遮断器を `要確認` とする。
- **MS-T/N Y-0810 24A版** — [電磁開閉器総合カタログ](https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/lvsw/l02031/Y-0810_24A.pdf)、ページ26～27、39、48、52、142～145。0.1～110 kWの直入れ標準AC-3モデル、および5.5 kW以上のスター・デルタ3接触器構成を照合した。コイル電圧、補助接点、特殊モータ、専用CTを含む構成は個別条件に応じて `要確認` とする。
- **FREQROL-E800** — [L(名)06130-J](https://www.mitsubishielectric.co.jp/fa/document/catalog/inv/l-06130/l060130j.pdf)。ND定格の200 V 0.1～22 kW、400 V 0.4～22 kWを対象に形名を表示する。
- **FREQROL-A800** — [L(名)06074-B](https://dl.mitsubishielectric.co.jp/dl/fa/document/catalog/inv/l06074/l06074b.pdf)、PDFページ13～14。ND定格の200 V 30～90 kW、400 V 30～280 kWの掲載形名を表示する。現行注文コードとモータ銘板電流は別途照合が必要である。

三菱の実始動電流は今回確認した公開表にアンペア値がないため全範囲 `要確認` とした。WS-Vの倍率を一律計算には使っていない。

## 富士電機

- **SC-NEXT MSスケール V20250331** — [公式選定表](https://f-net.fujielectric.co.jp/Catalog/FCS_appli/MSScale_SC-NEXT/MSScale_SC-NEXT.html)。4極・50 Hz条件で、直入れの200 V 0.1～55 kW、400 V 0.1～110 kWについて負荷電流、始動電流、遮断器、MS組合せ、ヒート範囲を取得した。
- **SC-NEXT 新製品カタログ A24001** — [2024年6月版](https://www.fujielectric.co.jp/fcs/pdf/new/2024/2024_JUN_A24001.pdf)、ページ15～16、20、52～54、75。SC09XA等の単体MC、TR18X／TR38X／TR65X等のサーマルリレー、MS組合せを照合した。実整定A、コイル電圧、補助接点コードは条件が足りないため `要確認` とする。
- **MSスケール（従来機種）** — [公式選定表](https://f-net.fujielectric.co.jp/Catalog/FCS_appli/MSSCALE/MSSCALE.html)。直入れは200 V 0.1～110 kW、400 V 0.1～132 kW、スター・デルタは200 V 5.5～132 kW、400 V 5.5～375 kWの公開配列を収録した。従来機種の単体MC／サーマル型式を現行SC-NEXTへ読み替えられない組合せは `要確認` とする。
- **FRENIC-Ace** — [200 V仕様](https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-ace_specification_01.html)／[400 V仕様](https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-ace_specification_02.html)。HHD仕様の200 V 0.1～22 kW、400 V 0.4～22 kWを対象に形名を表示する。
- **FRENIC-MEGA G2** — [公式仕様一覧](https://www.fujielectric.co.jp/products/drive_ctrl_equipment/inverter/product_series/frenic-megag2_specification.html)。HHD仕様の200 V 30～90 kW、400 V 30～630 kWについて、公式一覧にある標準容量だけ形名を表示する。

## 内線規程、CT、AM

- **内線規程 第14版 JEAC8001-2022** — [日本電気協会 商品ページ](https://store.denki.or.jp/products/%E5%86%85%E7%B7%9A%E8%A6%8F%E7%A8%8B-%E7%AC%AC14%E7%89%88)。2022年12月25日発行、970ページ。メーカー選定表が参照する3705-1表／3705-3表の数値をJEAC原本で照合できていないため、画面では全範囲を `要確認` とし、名称も `過電流遮断器` としている。二次資料の数値を正式値として表示しない。
- CTとAMは、測定対象電流、一次／二次比、計器レンジ、精度、過電流倍率などの選定条件が不足しているため、全組合せを `要確認` とする。条件なしで型式や比率を推定しない。

## ユーザー修正値

修正値はカタログ値とは別レコードで保存する。計算時はメーカー・電圧・kW・始動方式が完全一致する最新のユーザー修正値を優先し、元の値、修正後の値、更新日時を保持する。`カタログ値に戻す` はその修正レコードだけを削除する。
