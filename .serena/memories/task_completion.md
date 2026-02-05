# タスク完了時のチェックリスト

## Backend変更時

1. **型チェック**
   ```bash
   cd backend && mypy .
   ```

2. **リント**
   ```bash
   ruff check .
   ```

3. **フォーマット**
   ```bash
   ruff format .
   ```

4. **テスト（あれば）**
   ```bash
   pytest
   ```

5. **インポート確認**
   ```bash
   python -c "from main import app"
   ```

## Frontend変更時

1. **リント**
   ```bash
   cd frontend && npm run lint
   ```

2. **ビルド確認**
   ```bash
   npm run build
   ```

3. **型チェック（ビルドに含まれる）**

## 両方変更時

1. Backend → Frontend の順でチェック
2. 統合テスト（必要に応じて）

## コミット前

1. `git status` で変更確認
2. `git diff` で内容確認
3. 不要ファイル（__pycache__, .next, node_modules）がステージされていないか確認
4. 意味のあるコミットメッセージ

## Phase完了時

1. 全ページの動作確認
2. デモシナリオの確認
3. CLAUDE.md の進捗更新（必要に応じて）

## デモモード確認

- Firebase未設定時はデモモードで動作
- ログイン: demo@homecare.ai / demo1234
- localStorageでセッション管理
