# コードスタイル・規約

## Python (Backend)

### 全般
- Python 3.12+
- 行長: 100文字 (ruff設定)
- インデント: 4スペース

### 型ヒント
- 全関数に型ヒント必須 (mypy strict)
- Pydantic v2 モデルを使用

### Lint/Format
- ruff (E, F, I, N, W, UP, B, C4, SIM)
- `ruff check .` → `ruff format .`

### 命名規則
- 関数・変数: snake_case
- クラス: PascalCase
- 定数: UPPER_SNAKE_CASE
- ファイル: snake_case.py

### インポート順序
1. 標準ライブラリ
2. サードパーティ
3. ローカル

### Pydanticモデル例
```python
from pydantic import BaseModel, Field
from datetime import datetime

class Patient(BaseModel):
    id: str
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

## TypeScript (Frontend)

### 全般
- TypeScript strict mode
- Next.js 16 App Router
- Server Components優先

### 命名規則
- 関数・変数: camelCase
- コンポーネント: PascalCase
- ファイル: kebab-case.tsx (コンポーネントはPascalCase.tsx)
- 型: PascalCase

### コンポーネント構造
```
components/
├── ui/           # 基本UIコンポーネント
├── layout/       # レイアウト
└── features/     # 機能別
```

### Tailwind CSS
- ユーティリティクラス優先
- カスタムクラスは最小限

### Client Components
- "use client" ディレクティブを先頭に
- hooks使用時は必須

## 共通

### コメント
- 日本語OK（UIテキストは日本語）
- 複雑なロジックには説明コメント

### エラーメッセージ
- ユーザー向け: 日本語
- ログ: 英語推奨

### 環境変数
- Backend: .env.example参照
- Frontend: NEXT_PUBLIC_プレフィックス
