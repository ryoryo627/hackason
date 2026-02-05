# 開発コマンド一覧

## Backend開発

```bash
# ディレクトリ移動
cd backend

# 依存関係インストール（開発用）
pip install -e ".[dev]"

# 開発サーバー起動
uvicorn main:app --reload --port 8080

# リント
ruff check .

# フォーマット
ruff format .

# 型チェック
mypy .

# テスト
pytest

# テスト（カバレッジ付き）
pytest --cov
```

## Frontend開発

```bash
# ディレクトリ移動
cd frontend

# 依存関係インストール
npm install

# 開発サーバー起動（Turbopack）
npm run dev

# 開発サーバー起動（Webpack）
npm run dev -- --webpack

# ビルド
npm run build

# 本番サーバー起動
npm run start

# リント
npm run lint
```

## デモ・テスト

```bash
# デモデータ投入
python scripts/seed_demo_data.py

# デモログイン情報
# Email: demo@homecare.ai
# Password: demo1234
```

## デプロイ

```bash
# Botサービス
gcloud run deploy homecare-bot --source=backend/ --region=asia-northeast1

# Adminサービス
gcloud run deploy homecare-admin --source=frontend/ --region=asia-northeast1
```

## Git操作

```bash
git status
git branch
git checkout -b feature/xxx
git add <files>
git commit -m "message"
git push -u origin <branch>
```

## macOS (Darwin) 固有
- `timeout` コマンドは未対応 → `gtimeout`(coreutils) または代替手法を使用
- `sed -i` は `sed -i ''` の形式が必要
