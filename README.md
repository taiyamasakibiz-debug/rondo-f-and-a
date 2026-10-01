# Rondo（v2）

中小企業診断士の 2 次試験「事例Ⅳ」と 1 次試験「財務・会計」を、毎日の短い演習で鍛える学習アプリ。
数値を変えて何度でも解ける問題を、その場で採点し、間違えた原因まで返す。

- 設計：[`docs/DESIGN.md`](docs/DESIGN.md)
- 学習コース・レベル・認定の設計：[`docs/COURSE.md`](docs/COURSE.md)
- デザインシステム（Tessera）のルール：[`docs/design-system/README.md`](docs/design-system/README.md)
- 問題の下書きを NotebookLM で作るプロンプト：[`docs/prompts/notebooklm-problem-draft.md`](docs/prompts/notebooklm-problem-draft.md)
- 新しい単元（事例Ⅳ総合・時間価値・セグメント・企業価値・為替など）の問題を頼んだ依頼書と、直しのポイント：[`docs/prompts/notebooklm-new-units-brief.md`](docs/prompts/notebooklm-new-units-brief.md)

## できること

| 画面             | 内容                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| ホーム・デイリー | 復習の期日が来た問題、導入期の型、まだ解いていない問題から「今日のおすすめ」を出す。学習の局面も表示  |
| ラボ             | 仕訳・経営分析・CF・CVP・投資の 5 つ。問題を解いて採点、よくある誤答にはヒント、記述は自己採点        |
| 認定テスト       | Stage の修了テスト。単元をまたぐ混合セットで、制限時間つき。ブロンズ → シルバー → ゴールド            |
| 記録             | ストリーク、学習コース（Stage・単元の状態・コースレベル・認定）、ラボごとの XP と熟練度、間違いノート |
| フリーモード     | 自由に仕訳を記帳すると B/S・P/L・CF が組み上がる。パネルを別ウィンドウで開き、リアルタイムに同期する  |
| 設定             | デイリーのノルマ、日付の切り替わり時刻、学習スケジュール（目標月・試験日）、同期、書き出し・読み込み  |

データはブラウザ（IndexedDB）の中だけに保存する。同じ端末の複数のウィンドウは BroadcastChannel で同期する。

## 開発

Node.js のバージョンは [`.node-version`](.node-version) に合わせる。

```bash
npm install
npm run dev
```

| コマンド                          | 内容                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | 開発サーバー（http://localhost:5173）                                                             |
| `npm test`                        | テスト（Vitest）                                                                                  |
| `npm run validate:problems`       | すべての問題テンプレートを 1,000 通りの数値で作り、解けない問題や紛らわしい誤答がないかを確かめる |
| `npm run lint` / `npm run format` | oxlint / Prettier                                                                                 |
| `npm run typecheck`               | 型チェック                                                                                        |
| `npm run build`                   | 本番用のビルド（`dist/`）                                                                         |

### フォルダ

```
src/
  domain/     計算エンジン（会計・経営分析・CF・CVP・投資）。React に依存しない
  engine/     出題・採点（問題テンプレートの型、乱数、数値の読み取り）
  problems/   問題テンプレート（ラボごと）
  progress/   解答記録から計算するもの（レベル・ストリーク・復習・デイリー・認定）
  ledger/     フリーモードの科目と仕訳
  data/       保存先（IndexedDB）、ウィンドウ間の同期、バックアップ
  features/   画面
  components/ 共通の部品（shadcn/ui を含む）
```

### 問題を追加する

1. `src/problems/<ラボ>/` にテンプレートを書く（正解は `src/domain/` の関数で計算する）
2. `src/problems/index.ts` に登録する
3. `npm run validate:problems` を通す

過去問をもとにした問題は `src/problems/_private/` に置き、`source.kind: 'past-exam'`・`publishable: false` にする。

## デプロイ

Cloudflare Workers（静的アセット）。設定は [`wrangler.jsonc`](wrangler.jsonc)。
本番ブランチへの push で本番に、ほかのブランチはプレビューにデプロイされる。
