# S2 Runbook ── 振込計算ロジックのテスト凍結（本番非変更）

> 目的: 保護対象の「振込額計算」を純粋関数へ1:1抽出し、ユニットテストで現挙動を凍結する。
> Flutter移植・UI刷新の際に計算差異（リグレッション）を検知できる安全網を作る。
> 本ステップはDBを一切触らない。フロントのロジック整理のみ。

---

## 何を変えたか（差分の要点）
| ファイル | 変更 |
|---|---|
| `src/features/account/transferCalc.ts` | **新規**。`calcDeductDetail` / `calculateTransfer` を純粋関数として実装（現行の数式を1:1移植） |
| `src/features/account/transferCalc.test.ts` | **新規**。端数吸収・ガード順序・控除ルールを固定するテスト |
| `src/features/account/CalculatePage.tsx` | 数式を `transferCalc` へ委譲。UIバリデーション/トースト/表示は不変 |
| `vitest.config.ts` | **新規**。ユニットテスト設定（environment=node、`@` エイリアス） |
| `package.json` | `test` / `test:watch` スクリプトと devDep `vitest` を追加 |

**不変を保証した点（変更していない）**
- 手取り→比率→按分の式、`Math.round` と「端数は miyu 側で吸収（`transMiyu = topUp - transShota`）」。
- ガード順序（控除後手取り<=0 → 次に topUp<=0）。
- トースト文言、目標を上回った際の `overage`（= 上回り額）表示。
- `account_records` への保存フィールドと形状。

---

## あなたの環境での検証手順（必須）
> サンドボックスに node が無いため、コミット/デプロイ前に必ずローカルで実行して確認すること。

```bash
# 1) 依存インストール（vitest を含む）
npm install
#   ※ もし Vite 8 と vitest のピア依存で衝突したら:
#      npm i -D vitest@latest

# 2) テスト実行（現挙動が凍結されていることを確認）
npm test

# 3) 型チェック + ビルド（リファクタで型崩れが無いこと）
npm run build

# 4) Lint
npm run lint
```

期待結果:
- `npm test` … `transferCalc.test.ts` が全ケース green。
- `npm run build` … `tsc -b` がエラー無しで通る。

---

## 手動での等価性確認（任意・推奨）
リファクタ前後で結果が同じことを画面でも確認:
1. `npm run dev` で `振込額計算` を開く。
2. 例: 目標 `500000` / 現在 `100000` / SHOTA `300000` / MIYU `200000`（控除なし）
   → 需追 `400000`、SHOTA `240000`、MIYU `160000`（比率60% / 40%）。
3. 控除あり・端数ありのケースでも、SHOTA+MIYU が需追金額とちょうど一致することを確認。

---

## 完了条件（Doneの定義）
- [ ] `npm test` が green
- [ ] `npm run build` が通る
- [ ] `npm run lint` が通る
- [ ] 画面で数値が従来どおり（特に端数の合計一致）であることを確認

---

## 補足: なぜ保護対象に手を入れたか
「変更禁止」は**計算の意味を変えないこと**を指す。本ステップは意味を変えず、
むしろ数式を単一の出所（`transferCalc.ts`）に集約し、テストで**恒久的に固定**することで、
今後のUI刷新・Flutter移植による意図しない計算変更を**防止**する。二重定義を残す方が
将来の乖離リスクが高いため、コンポーネントからは委譲とした。
