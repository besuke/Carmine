# ASW デモデータの出所

Curie の A1 オファーシートのデモデータ（**すべて架空**。実在の銘柄・市場価格ではない）と、その旧デモの結果をコピーしたもの。
`scripts/asw/snapshot_curie_demo.R` が作る。Curie は読むだけで変更しない。

- Curie のコミット：`60940de`
- 作成日時：2026-11-14 15:53:36 JST

| このフォルダ | Curie の元ファイル | 更新日時 | SHA-256 |
|---|---|---|---|
| `offers.csv` | `output/work/JPY/offers_standard_JPY_20261006.xlsx` | 2026-10-27 00:29 | `09b97ed49ac49c485b15ce7cfe7b349e2c7f3ec07e2b6a4cb2a6480be0ce2ec2` |
| `offers.csv` | `output/work/ISO/offers_standard_ISO_20261006.xlsx` | 2026-10-27 00:29 | `4cf18eb6a27c8876dd1ee9c19933e2303f3879fd273bc9024ee64869c3b08969` |
| `offer_columns.csv` | `data/demo/offers/demo_offers_JPY_20261006.xlsx` | 2026-10-27 08:14 | `bbb669f131831c0c4679c52cdf3f2e854f244f5a64b0830640570955bee9ce10` |
| `offer_columns.csv` | `data/demo/offers/demo_offers_ISO_20261006.xlsx` | 2026-10-27 08:14 | `31d69b1ffc626d00d155460c3a2c81aa8058b83589bd32e2956f5b5bee4fd38f` |
| `attributes.csv` | `data/demo/attributes/demo_attributes_20261006.rds` | 2026-10-27 08:14 | `d2f358bdccaba34e318ed527bb5ade4238a9e263292f700681e85bfbb5f4b270` |
| `ois_JPY.txt` | `data/demo/market/demo_ois_JPY_20261006.txt` | 2026-10-27 08:14 | `e7f112063be6a45630986eb81d03c56819af93d90fb456d53d9542cc7e382b32` |
| `ois_USD.txt` | `data/demo/market/demo_ois_USD_20261006.txt` | 2026-10-27 08:14 | `c332a6e3ad8f248a4dbc409543e72ba6d870984a658b77463ef689b50393ddd8` |
| `ois_EUR.txt` | `data/demo/market/demo_ois_EUR_20261006.txt` | 2026-10-27 08:14 | `b1d1d798d93de07eea668147f558cec891357de321be16dd7060389c748f9db8` |
| `fx.txt` | `data/demo/market/demo_fx_20261006.txt` | 2026-10-27 08:14 | `ff31ed383e813f41d5aecae399aef26f456859df2c63d7f2af94c33ee470bf82` |
| `basis.txt` | `data/demo/market/demo_basis_20261006.txt` | 2026-10-27 08:14 | `e61c85caa2065983edf22dc6b8fb89cda1d9f49f48e4129abbfaccee0c1cbea4` |
| `jgb.txt` | `data/demo/market/demo_jgb_20261006.txt` | 2026-10-27 08:14 | `2ad1d92370b5ab6278a704c3d778d0d29c27ea01fda4fc38143d83e276969c4e` |
| `curie_reference.json` | `output/offer_results_JPY_demo_20261006.xlsx` | 2026-10-27 00:29 | `352f41cc31ff506c5352f9dd28ec7cc3ae247df896f7ff2078c3ec190cfe2dfd` |
| `curie_reference.json` | `output/offer_results_ISO_demo_20261006.xlsx` | 2026-10-27 00:29 | `98a9e9df1bac4a234ca2e8932595c496f83398d3c73fc7acb00ec3dfca53a1a0` |

オファーは、Curie の `convert_offer_sheet_Curie()` がデモの Excel（`data/demo/offers/`）から読んだ標準形式（`output/work/`）を使う。
単価は額面100あたりのクリーン価格、数量は額面金額（通貨単位）。`offer_columns.csv` は、元の Excel の見出しと標準形式の列の対応である。
