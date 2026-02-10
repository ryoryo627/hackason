# HomeCare AI デプロイワークフロー

## 重要: ローカル環境でのデプロイ

Cloud Shellは使わない。ローカルMacから直接デプロイする。

### フロントエンドデプロイ
```bash
cd /Users/kyoku/Dropbox/Mac/Downloads/next_app/hackason/frontend
./deploy.sh
```

### バックエンドデプロイ
```bash
cd /Users/kyoku/Dropbox/Mac/Downloads/next_app/hackason/backend
gcloud run deploy homecare-bot --source=. --region=asia-northeast1
```

## GCPプロジェクト情報
- Project ID: `aihomecare-486506`
- Region: `asia-northeast1`
- Frontend Service: `homecare-admin`
- Backend Service: `homecare-bot`

## Firebase設定
- 実際の値は `frontend/.env.local` を参照（gitにはコミットしない）
- デプロイ時は `frontend/deploy.sh` を使用

## 注意事項
- NEXT_PUBLIC_* 環境変数はビルド時に埋め込む必要がある（deploy.shで対応済み）
- Cloud Shellではなくローカルから `deploy.sh` を使う
- cloudbuild.yaml にはクレデンシャルをハードコードしない
