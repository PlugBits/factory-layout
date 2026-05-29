# Factory Layout Planner

工場レイアウトを実寸スケールで検討するための、ブラウザ完結型Webツールです。
2D編集と3D確認を基本にしています。

## 主な機能

- 工場サイズ設定
  - 幅
  - 奥行
  - グリッド間隔
- 設備テンプレート配置
- 設備ドラッグ移動
- グリッドスナップ
- 設備寸法編集
  - X
  - Y
  - 幅
  - 奥行
  - 高さ
  - 回転
- 2D表示
- 3Dプレビュー
- 3D回転中心の切り替え
  - 全体中心
  - 選択設備中心
- 3D簡易設備モデル
  - 箱だけではなく、機械らしい段差・扉・操作盤・棚・ローラー・柱などを簡易表現
- JSON保存 / JSON読込
- PNG出力

## 初期設備テンプレート

- 加工設備
- 搬送・物流
- 検査・作業
- 建屋
- ユーティリティ
- 安全

合計30種類の初期テンプレートを用意しています。

## セットアップ

```powershell
cd C:\conda\factory-layout
npm install
```

## 開発実行

```powershell
npm run dev
```

## ビルド

```powershell
npm run build
```

## GitHub Pages

GitHub Actionsで `dist` をPagesへ公開します。

1. GitHubでリポジトリを作成
2. このプロジェクトをpush
3. `Settings` -> `Pages`
4. `Source` を `GitHub Actions` に設定
5. `main` へpushすると自動公開

## 制限事項

- CADではありません。
- DXF入出力はありません。
- 厳密な干渉チェックや配管経路計算は未対応です。
- 3D表示は簡易モデルです。実機の完全再現ではなく、配置検討で見分けやすくすることを目的にしています。
