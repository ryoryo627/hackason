# HomeCare AI デプロイワークフロー

## 重要: ローカル環境でのデプロイ

Cloud Shellは使わない。ローカルMacから直接デプロイする。

### フロントエンドデプロイ
```bash
cd /Users/kyoku/Dropbox/Mac/Downloads/next_app/hackason/frontend
gcloud builds submit --config=cloudbuild.yaml
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

## Firebase設定（cloudbuild.yamlにハードコード済み）
- API Key: `REDACTED_FIREBASE_API_KEY`
- Auth Domain: `aihomecare-486506.firebaseapp.com`
- Project ID: `aihomecare-486506`

## 注意事項
- NEXT_PUBLIC_* 環境変数はビルド時に埋め込む必要がある（cloudbuild.yamlで対応済み）
- Cloud Shellではなくローカルから `gcloud builds submit` を使う
