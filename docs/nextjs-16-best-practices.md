# Next.js 16 ベストプラクティス

本プロジェクトのAdmin UIで使用するNext.js 16の実装ガイドライン。

## 1. 技術スタック

| 項目 | バージョン/技術 |
|------|----------------|
| Next.js | 16.x |
| React | 19.2+ |
| TypeScript | 5.1+ |
| Node.js | 20.9+ |
| バンドラー | Turbopack（デフォルト） |
| スタイリング | Tailwind CSS |
| 認証 | Firebase Authentication |

## 2. プロジェクト構造

```
frontend/
├── next.config.ts           # Next.js設定
├── proxy.ts                 # プロキシ設定（旧middleware.ts）
├── app/
│   ├── layout.tsx           # ルートレイアウト
│   ├── page.tsx             # ホーム（ダッシュボード）
│   ├── login/
│   │   └── page.tsx         # ログイン画面
│   ├── setup/
│   │   └── page.tsx         # セットアップウィザード
│   ├── patients/
│   │   ├── page.tsx         # 患者一覧
│   │   └── [id]/
│   │       └── page.tsx     # 患者詳細
│   ├── alerts/
│   │   └── page.tsx         # アラート一覧
│   ├── knowledge/
│   │   └── page.tsx         # ナレッジベース
│   ├── settings/
│   │   ├── api/
│   │   │   └── page.tsx     # API & サービス設定
│   │   ├── master/
│   │   │   └── page.tsx     # マスタ管理
│   │   └── organization/
│   │       └── page.tsx     # 組織設定
│   ├── actions/             # Server Actions
│   │   ├── auth.ts
│   │   ├── patients.ts
│   │   ├── alerts.ts
│   │   └── knowledge.ts
│   └── api/                 # API Routes（必要に応じて）
├── components/
│   ├── ui/                  # 基本UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ...
│   └── features/
│       ├── patients/
│       ├── alerts/
│       └── ...
├── lib/
│   ├── firebase.ts          # Firebase初期化
│   ├── api.ts               # APIクライアント
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   └── ...
└── types/
    └── index.ts
```

## 3. Cache Components（キャッシュコンポーネント）

Next.js 16の最重要新機能。`"use cache"`ディレクティブによるオプトイン型キャッシング。

### 3.1 有効化

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

### 3.2 使用パターン

#### ファイルレベルキャッシュ

```typescript
// app/patients/page.tsx
'use cache'

export default async function PatientsPage() {
  const patients = await fetchPatients()
  return <PatientList patients={patients} />
}
```

#### コンポーネントレベルキャッシュ

```typescript
// components/features/patients/PatientStats.tsx
export async function PatientStats() {
  'use cache'

  const stats = await fetchPatientStats()
  return (
    <div>
      <p>総患者数: {stats.total}</p>
      <p>HIGH: {stats.highRisk}</p>
    </div>
  )
}
```

#### 関数レベルキャッシュ

```typescript
// lib/api.ts
export async function getPatientContext(patientId: string) {
  'use cache'

  const response = await fetch(`/api/patients/${patientId}/context`)
  return response.json()
}
```

### 3.3 本プロジェクトでのキャッシュ戦略

| データ種別 | キャッシュ戦略 | 理由 |
|-----------|--------------|------|
| 患者一覧 | `revalidate: 60` | 更新頻度は低めだが最新性も必要 |
| 患者詳細 | `no-store` | リアルタイム性が重要 |
| ダッシュボード統計 | `revalidate: 30` | 定期的な更新で十分 |
| マスタデータ | `force-cache` | ほぼ変更されない |
| アラート | `no-store` | 即時性が最重要 |

## 4. Server Components vs Client Components

### 4.1 基本原則

- **デフォルトはServer Component**
- 以下の場合のみClient Componentを使用:
  - `useState`, `useEffect`などのReact Hooks
  - ブラウザAPI（`window`, `document`）
  - イベントハンドラ（`onClick`, `onChange`）
  - サードパーティのクライアントライブラリ

### 4.2 パターン例

```typescript
// app/patients/page.tsx (Server Component)
import { PatientListClient } from '@/components/features/patients/PatientListClient'

export default async function PatientsPage() {
  // サーバーサイドでデータ取得
  const patients = await fetchPatients()

  // Client Componentにデータを渡す
  return <PatientListClient initialPatients={patients} />
}
```

```typescript
// components/features/patients/PatientListClient.tsx (Client Component)
'use client'

import { useState } from 'react'
import { Patient } from '@/types'

interface Props {
  initialPatients: Patient[]
}

export function PatientListClient({ initialPatients }: Props) {
  const [patients, setPatients] = useState(initialPatients)
  const [searchTerm, setSearchTerm] = useState('')

  // フィルタリングはクライアントサイドで
  const filtered = patients.filter(p =>
    p.name.includes(searchTerm)
  )

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="検索..."
      />
      {filtered.map(p => <PatientCard key={p.id} patient={p} />)}
    </div>
  )
}
```

## 5. Server Actions

### 5.1 基本実装

```typescript
// app/actions/patients.ts
'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'

const PatientSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0).max(150),
  sex: z.enum(['M', 'F']),
  conditions: z.array(z.string()),
})

export async function createPatient(formData: FormData) {
  // 認証チェック
  const session = await getSession()
  if (!session) {
    throw new Error('認証が必要です')
  }

  // バリデーション
  const validated = PatientSchema.safeParse({
    name: formData.get('name'),
    age: Number(formData.get('age')),
    sex: formData.get('sex'),
    conditions: formData.getAll('conditions'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  // API呼び出し
  const response = await fetch(`${API_BASE}/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.token}`,
    },
    body: JSON.stringify(validated.data),
  })

  if (!response.ok) {
    return { error: 'Failed to create patient' }
  }

  // キャッシュ無効化
  revalidateTag('patients', 'hours')

  return { success: true, data: await response.json() }
}
```

### 5.2 フォームとの連携

```typescript
// components/features/patients/PatientForm.tsx
'use client'

import { useActionState } from 'react'
import { createPatient } from '@/app/actions/patients'

export function PatientForm() {
  const [state, action, pending] = useActionState(createPatient, null)

  return (
    <form action={action}>
      <input name="name" placeholder="患者名" required />
      {state?.errors?.name && <p className="text-red-500">{state.errors.name}</p>}

      <input name="age" type="number" placeholder="年齢" required />

      <select name="sex" required>
        <option value="M">男性</option>
        <option value="F">女性</option>
      </select>

      <button type="submit" disabled={pending}>
        {pending ? '登録中...' : '登録'}
      </button>
    </form>
  )
}
```

## 6. proxy.ts（旧middleware.ts）

Next.js 16では`middleware.ts`が`proxy.ts`に置き換え。

```typescript
// proxy.ts
import { NextRequest, NextResponse } from 'next/server'

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 認証不要パス
  const publicPaths = ['/login', '/api/auth']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 認証チェック
  const token = request.cookies.get('auth-token')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

## 7. データフェッチング

### 7.1 フェッチ戦略

```typescript
// 静的データ（ビルド時に取得、手動無効化まで保持）
const staticData = await fetch(url, { cache: 'force-cache' })

// 動的データ（毎リクエスト）
const dynamicData = await fetch(url, { cache: 'no-store' })

// 時間ベース再検証
const revalidatedData = await fetch(url, {
  next: { revalidate: 60 }  // 60秒
})

// タグベース再検証
const taggedData = await fetch(url, {
  next: { tags: ['patients'] }
})
```

### 7.2 新しいキャッシュAPI

```typescript
// revalidateTag（更新済み）- cacheLifeプロファイル必須
import { revalidateTag } from 'next/cache'

revalidateTag('patients', 'hours')  // SWR動作
revalidateTag('alerts', 'max')      // 最長キャッシュ

// updateTag（新規）- Server Actions専用
import { updateTag } from 'next/cache'

export async function updatePatient(id: string, data: PatientData) {
  'use server'
  await db.patients.update(id, data)
  updateTag(`patient-${id}`)  // 即時更新
}

// refresh（新規）- キャッシュされていないデータのみ更新
import { refresh } from 'next/cache'

export async function markAlertAsRead(id: string) {
  'use server'
  await db.alerts.markAsRead(id)
  refresh()  // キャッシュされていないデータを更新
}
```

## 8. 非同期params/searchParams

Next.js 16では`params`と`searchParams`が非同期に。

```typescript
// ❌ 旧パターン（非推奨）
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>
}

// ✅ 新パターン
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <div>{id}</div>
}
```

## 9. エラーハンドリング

### 9.1 error.tsx

```typescript
// app/patients/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-4 bg-red-50 rounded">
      <h2 className="text-red-800">エラーが発生しました</h2>
      <p className="text-red-600">{error.message}</p>
      <button
        onClick={() => reset()}
        className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
      >
        再試行
      </button>
    </div>
  )
}
```

### 9.2 not-found.tsx

```typescript
// app/patients/[id]/not-found.tsx
export default function NotFound() {
  return (
    <div className="p-4">
      <h2>患者が見つかりません</h2>
      <p>指定された患者IDは存在しないか、アクセス権限がありません。</p>
    </div>
  )
}
```

## 10. パフォーマンス最適化

### 10.1 Turbopack

デフォルトで有効。Webpackに戻す場合:

```bash
next dev --webpack
```

### 10.2 ファイルシステムキャッシュ（ベータ）

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
}
```

### 10.3 画像最適化

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/homecare-ai-files/**',
      },
    ],
  },
}
```

## 11. React 19.2 新機能

### 11.1 View Transitions

```typescript
'use client'

import { useViewTransition } from 'react'

export function PatientCard({ patient }: { patient: Patient }) {
  const { startTransition } = useViewTransition()

  const handleClick = () => {
    startTransition(() => {
      router.push(`/patients/${patient.id}`)
    })
  }

  return (
    <div
      style={{ viewTransitionName: `patient-${patient.id}` }}
      onClick={handleClick}
    >
      {patient.name}
    </div>
  )
}
```

### 11.2 useEffectEvent

```typescript
'use client'

import { useEffectEvent } from 'react'

export function AlertNotifier({ alerts }: { alerts: Alert[] }) {
  const onNewAlert = useEffectEvent((alert: Alert) => {
    // 最新のpropsを使用可能
    showNotification(alert.message)
  })

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    ws.onmessage = (e) => onNewAlert(JSON.parse(e.data))
    return () => ws.close()
  }, [])  // 依存配列にonNewAlertは不要
}
```

## 12. 環境変数

```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"..."}

# サーバーサイドのみ
FIREBASE_ADMIN_SDK={"projectId":"..."}
```

## 参考リンク

- [Next.js 16 Blog](https://nextjs.org/blog/next-16)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Cache Components Documentation](https://nextjs.org/docs/app/getting-started/cache-components)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
