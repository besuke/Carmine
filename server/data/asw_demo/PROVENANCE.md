# ASW デモデータの出所

Curie の A1 オファーシートのデモデータ（**すべて架空**。実在の銘柄・市場価格ではない）をコピーしたもの。
`scripts/asw/snapshot_curie_demo.R` が作る。Curie は読むだけで変更しない。

- Curie のコミット：`60940de`
- 作成日時：2026-11-14 15:24:38 JST

| このフォルダ | Curie の元ファイル | 更新日時 | SHA-256 |
|---|---|---|---|
| `offers.csv` | `output/work/JPY/offers_standard_JPY_20261006.xlsx` | 2026-10-27 00:29 | `09b97ed49ac49c485b15ce7cfe7b349e2c7f3ec07e2b6a4cb2a6480be0ce2ec2` |
| `offers.csv` | `output/work/ISO/offers_standard_ISO_20261006.xlsx` | 2026-10-27 00:29 | `4cf18eb6a27c8876dd1ee9c19933e2303f3879fd273bc9024ee64869c3b08969` |
| `attributes.csv` | `data/demo/attributes/demo_attributes_20261006.rds` | 2026-10-27 08:14 | `d2f358bdccaba34e318ed527bb5ade4238a9e263292f700681e85bfbb5f4b270` |
| `ois_JPY.txt` | `data/demo/market/demo_ois_JPY_20261006.txt` | 2026-10-27 08:14 | `e7f112063be6a45630986eb81d03c56819af93d90fb456d53d9542cc7e382b32` |
| `ois_USD.txt` | `data/demo/market/demo_ois_USD_20261006.txt` | 2026-10-27 08:14 | `c332a6e3ad8f248a4dbc409543e72ba6d870984a658b77463ef689b50393ddd8` |
| `ois_EUR.txt` | `data/demo/market/demo_ois_EUR_20261006.txt` | 2026-10-27 08:14 | `b1d1d798d93de07eea668147f558cec891357de321be16dd7060389c748f9db8` |

オファーは、Curie の `convert_offer_sheet_Curie()` がデモの Excel（`data/demo/offers/`）から読んだ標準形式（`output/work/`）を使う。
単価は額面100あたりのクリーン価格、数量は額面金額（通貨単位）。
