# Lifolio 2.0 再設計 ── Phase2: 業務仕様書（自然言語）

> 既存業務ロジックの「現状の振る舞い」を正確に言語化する。これは**保護対象の定義書**でもある。
> 出典: `CalculatePage.tsx`, `DataPage.tsx`, `mealStore.ts`, `mealApi.ts`, `gemini.ts`, `AiProposalPanel.tsx`。

---

## A. 家計管理仕様（＝共有口座 振込額管理）

### 用語の整理（重要）
本アプリの「家計管理」は **支出簿（家計簿）ではない**。
実体は「夫婦が共有口座へ毎月いくら振り込むかを、手取り比率で公平に按分する計算ツール + その月次履歴」である。
日々の支出データは存在しない。

### 登場人物
- `shota` と `miyu` の2名固定。ユーザーアカウントの概念はなく、文字列で識別。

### 設定（`account_settings`, key=`user_settings`, jsonb）
- `targetBalance`: 共有口座の目標残高。
- 各人 (`shota`/`miyu`) の控除設定:
  - `rentCheck`/`rent`（家賃補助）, `transCheck`/`trans`（交通費）, `otherCheck`/`others[]`（その他免除: desc+amount）。
- チェックON かつ 金額>0 の項目のみ控除として有効化される。

---

## B. 残高算出ロジック（振込額計算）── 中核・変更禁止

`CalculatePage.calculate()` の手順（数式そのまま）:

1. **入力**: `target`(目標残高), `salaryShota`, `salaryMiyu`, `currentBal`(現在残高)。
2. **バリデーション（順序通り）**:
   - `target` 未入力 → 中断（「目標残高を入力してください」）。
   - いずれかの給料が未入力 → 中断。
   - `month` 未選択 → 中断。
3. **控除合計算出** (`calcDeductDetail`): 各人につき、有効な家賃補助・交通費・その他を `DeductItem{label, amount}` として収集し合算。
4. **手取り（net）**: `netShota = salaryShota - 控除合計`, `netMiyu = salaryMiyu - 控除合計`。
   - `netShota <= 0` または `netMiyu <= 0` → 中断（「控除後の給料が0以下」）。
5. **比率**: `total = netShota + netMiyu`、`ratioShota = netShota/total`, `ratioMiyu = netMiyu/total`。
6. **需追金額（topUp）**: `topUp = target - currentBal`。
   - `topUp <= 0` → 中断（「目標を上回っています — 振込不要」）。
7. **振込額按分**:
   - `transShota = Math.round(topUp * ratioShota)`
   - `transMiyu = topUp - transShota` ← **端数はmiyu側で吸収**（合計が必ず topUp と一致する設計）。
8. 結果を画面表示（この時点ではDB未保存）。

> ⚠ 端数処理の非対称性（shota=四捨五入, miyu=差分）は**意図的な仕様**。合計一致を保証している。変更すると過去計算との整合が崩れる。

---

## C. 確定・保存ロジック（`confirmResult`）

1. 同月 (`month` unique) の既存レコードを検索。
2. 既存あり → `window.confirm` で上書き確認 → OKなら**当該月を物理削除**してから挿入。
3. `account_records` に全フィールド（B.の全中間値 + `confirmed_at=now()`）を保存。
4. 成功でフォームリセット。

> 月は一意。実質「月次スナップショットの upsert（delete+insert）」。

---

## D. 集計ロジック（現状）

- `DataPage`: `account_records` を `month desc` で全件取得しテーブル表示するのみ。
- **集計・推移・前月比などの算出ロジックは存在しない**。
- CSV出力: 年月・給料・控除・目標/現在残高・振込額・確定日を UTF-8(BOM付) で出力。
- 削除: 月指定で物理削除（`window.confirm` 後）。

> 将来要件の「支出推移・食費推移・月次比較」を満たす元データもロジックも現状は無い（→ Phase4 で要確認）。

---

## E. 月次処理

- 自動バッチは存在しない。ユーザーが毎月手動で計算→確定する運用。
- 「1ヶ月」という時間概念が使われる箇所:
  - `account_records.month`（YYYY-MM 一意）。
  - `plansApi.deleteOld()`: `initMeal` 時に1ヶ月超前の `meal_plans` を物理削除。
  - `plansApi.getRecent(14)`: 直近14日の献立をAI重複回避用に取得。

---

## F. AI処理フロー（献立提案）── 承認フロー実装済み

`AiProposalPanel` + `gemini.ts`:

1. **入力収集**: 日数・開始日・テーマ・冷蔵庫の残り食材・必須レシピ。
2. **プロンプト構築** (`buildSystemPrompt`): 好み（大好物/苦手）・参考レシピ(最大15)・直近献立（重複禁止）・食材ルール（一般スーパー限定）・献立ルール（夕食=主菜/副菜/汁物の3品、昼食=1品）・出力JSONスキーマ。
3. **生成** (`generateMealProposal` → `callGroq`): JSON応答を `extractJson` でパース、各 meal に `_localId` 付与。
4. **ユーザー編集**: カード単位で「自由入力 / レシピから選択」へ変更、削除可。チャット (`continueMealChat`) で会話的に微修正。
5. **確定** (`handleConfirm`) ← **承認 = 明示的ボタン押下**:
   - 各 meal を `meal_plans` に upsert（`ai_proposal=true`）。
   - `generateShoppingList` で買い物リストをAI生成。
   - `meal_shopping_lists` と `ai_proposals`（最新1件）に保存。
6. **復元**: 保存済み提案を `savedProposal` から復元可能。

> このドメインは既に「AI提案 → 人間が確認/編集 → 明示確定で初めてDB書込」を満たしており、目標の **提案→承認→実行** モデルの先行実装になっている。

---

## G. 認証フロー（現状）

1. `LoginPage`: `app_settings.auth_hash` を取得し、`sha256("username:password")` と**クライアント側で比較**。
2. 一致 → `authStore.login(username)`（`isAuthenticated=true` を localStorage 永続化）。
3. `ProtectedRoute` は `isAuthenticated` のみで判定（サーバ検証なし）。
4. パスワード変更 (`SettingsPage`): 現ハッシュ照合 → 新ハッシュで `app_settings.auth_hash` を更新。

> ハッシュはソルト無し。anon key で `auth_hash` も読めるため、**データ層のアクセス制御としては機能していない**（UI上のゲートに過ぎない）。
