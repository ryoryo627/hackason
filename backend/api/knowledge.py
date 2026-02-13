"""
Knowledge Base API endpoints.

Manages RAG knowledge documents for AI agents.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, UploadFile, File, HTTPException
from pydantic import BaseModel

from services.firestore_service import FirestoreService
from services.storage_service import StorageService
from config import get_settings

router = APIRouter()

# Knowledge categories
KNOWLEDGE_CATEGORIES = {
    "bps": "BPSモデル",
    "clinical": "臨床推論",
    "guidelines": "診療ガイドライン",
    "homecare": "在宅医療制度",
    "palliative": "緩和ケア",
    "geriatric": "老年医学",
    "medication": "薬剤管理",
    "protocol": "院内プロトコル",
}


class DocumentCreate(BaseModel):
    """Create document request."""

    title: str
    category: str
    source: Optional[str] = None
    content: Optional[str] = None  # For text-based documents


class DocumentUpdate(BaseModel):
    """Update document request."""

    title: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    agent_bindings: Optional[list[str]] = None  # Which agents can use this doc


class SearchRequest(BaseModel):
    """Search request."""

    query: str
    category: Optional[str] = None
    limit: int = 5


@router.get("/documents")
async def list_documents(
    org_id: str = Query(...),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50),
):
    """List knowledge documents."""
    try:
        db = FirestoreService.get_client()
        query = db.collection("organizations").document(org_id).collection("knowledge")

        if category:
            query = query.where("category", "==", category)
        if status:
            query = query.where("status", "==", status)

        query = query.limit(limit)
        docs = query.stream()

        documents = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            documents.append(data)

        # Sort in Python (avoids composite index requirement)
        # updated_at may be str or DatetimeWithNanoseconds — normalize to str for comparison
        documents.sort(key=lambda x: str(x.get("updated_at", "") or ""), reverse=True)

        return {"documents": documents, "total": len(documents)}
    except Exception as e:
        print(f"[ERROR] list_documents failed: {e}")
        return {"documents": [], "total": 0}


@router.post("/documents")
async def create_document(
    org_id: str = Query(...),
    title: str = Query(...),
    category: str = Query(...),
    source: Optional[str] = Query(None),
):
    """Create a new knowledge document."""
    if category not in KNOWLEDGE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

    db = FirestoreService.get_client()
    now = datetime.now(timezone.utc).isoformat()

    doc_data = {
        "title": title,
        "category": category,
        "source": source or "",
        "status": "pending",  # pending -> processing -> indexed
        "total_chunks": 0,
        "agent_bindings": [],  # Which agents can use this doc
        "created_at": now,
        "updated_at": now,
    }

    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document()
    )
    doc_ref.set(doc_data)

    return {"success": True, "document_id": doc_ref.id}


@router.post("/documents/{document_id}/upload")
async def upload_document_file(
    document_id: str,
    org_id: str = Query(...),
    file: UploadFile = File(...),
):
    """Upload a file for a knowledge document and process with RAG pipeline."""
    # Validate file type
    allowed_types = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, TXT, MD, DOCX",
        )

    db = FirestoreService.get_client()
    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document(document_id)
    )

    # Get document metadata for category/source
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")
    doc_data = doc.to_dict()

    # Update document status to processing
    doc_ref.update(
        {
            "status": "processing",
            "file_name": file.filename,
            "file_type": file.content_type,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    # Read file bytes
    file_bytes = await file.read()

    # Upload original file to GCS for persistent storage
    gcs_uri = None
    try:
        settings = get_settings()
        destination_path = f"{org_id}/{document_id}/{file.filename}"
        gcs_uri = await StorageService.upload_file(
            bucket_name=settings.gcs_knowledge_bucket,
            destination_path=destination_path,
            file_bytes=file_bytes,
            content_type=file.content_type,
        )
        doc_ref.update({
            "gcs_uri": gcs_uri,
            "file_size_bytes": len(file_bytes),
        })
    except Exception as e:
        print(f"[WARN] GCS upload failed (RAG processing will continue): {e}")

    # Get Gemini API key for embedding generation
    from agents.base_agent import BaseAgent

    api_key = await BaseAgent.get_gemini_api_key(org_id)
    if not api_key:
        doc_ref.update({"status": "error", "error_message": "Gemini APIキーが設定されていません"})
        raise HTTPException(status_code=400, detail="Gemini APIキーが設定されていません")

    # Process with RAG pipeline
    from services.rag_service import RAGService

    result = await RAGService.process_document(
        doc_id=document_id,
        org_id=org_id,
        file_bytes=file_bytes,
        content_type=file.content_type,
        api_key=api_key,
        category=doc_data.get("category", ""),
        source=doc_data.get("source", ""),
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "RAG処理に失敗しました"),
        )

    return {
        "success": True,
        "document_id": document_id,
        "file_name": file.filename,
        "status": "indexed",
        "total_chunks": result.get("total_chunks", 0),
    }


@router.get("/documents/{document_id}")
async def get_document(
    document_id: str,
    org_id: str = Query(...),
):
    """Get a knowledge document by ID."""
    db = FirestoreService.get_client()
    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document(document_id)
    )
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")

    data = doc.to_dict()
    data["id"] = doc.id
    return {"document": data}


@router.get("/documents/{document_id}/download")
async def get_document_download_url(
    document_id: str,
    org_id: str = Query(...),
):
    """Get a signed download URL for the original document file."""
    db = FirestoreService.get_client()
    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document(document_id)
    )
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")

    data = doc.to_dict()
    gcs_uri = data.get("gcs_uri")
    if not gcs_uri:
        raise HTTPException(status_code=404, detail="原本ファイルが保存されていません")

    signed_url = await StorageService.generate_signed_url(gcs_uri)
    return {"url": signed_url, "file_name": data.get("file_name", "")}


@router.get("/documents/{document_id}/chunks")
async def list_document_chunks(
    document_id: str,
    org_id: str = Query(...),
):
    """List chunks for a knowledge document."""
    chunks = await FirestoreService.list_knowledge_chunks(org_id, document_id)
    return {"chunks": chunks, "total": len(chunks)}


@router.put("/documents/{document_id}")
async def update_document(
    document_id: str,
    org_id: str = Query(...),
    title: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    """Update a knowledge document."""
    db = FirestoreService.get_client()
    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document(document_id)
    )

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if title:
        updates["title"] = title
    if category:
        if category not in KNOWLEDGE_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")
        updates["category"] = category
    if source:
        updates["source"] = source

    doc_ref.update(updates)
    return {"success": True, "updated_fields": list(updates.keys())}


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    org_id: str = Query(...),
):
    """Delete a knowledge document."""
    db = FirestoreService.get_client()
    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document(document_id)
    )

    # Delete original file from GCS if it exists
    doc = doc_ref.get()
    if doc.exists:
        doc_data = doc.to_dict()
        gcs_uri = doc_data.get("gcs_uri")
        if gcs_uri:
            try:
                await StorageService.delete_file(gcs_uri)
            except Exception as e:
                print(f"[WARN] GCS file deletion failed: {e}")

    # Delete chunks subcollection first
    chunks = doc_ref.collection("chunks").stream()
    for chunk in chunks:
        chunk.reference.delete()

    # Delete document
    doc_ref.delete()

    return {"success": True}


@router.post("/search")
async def search_knowledge(
    org_id: str = Query(...),
    query: str = Query(..., min_length=1),
    category: Optional[str] = Query(None),
    limit: int = Query(5),
):
    """Search knowledge base using semantic search with embedding similarity."""
    # Get Gemini API key for embedding
    from agents.base_agent import BaseAgent

    api_key = await BaseAgent.get_gemini_api_key(org_id)

    if api_key:
        # Semantic search with RAG
        try:
            from services.rag_service import RAGService

            categories = [category] if category else None
            chunks = await RAGService.search(
                query=query,
                org_id=org_id,
                categories=categories,
                api_key=api_key,
                limit=limit,
            )

            results = []
            for chunk in chunks:
                results.append({
                    "document_id": chunk.get("doc_id", ""),
                    "title": chunk.get("source", ""),
                    "category": chunk.get("category", ""),
                    "source": chunk.get("source", ""),
                    "score": chunk.get("score", 0),
                    "snippet": chunk.get("text", "")[:200],
                })

            return {"results": results, "query": query, "total": len(results)}
        except Exception as e:
            print(f"[WARN] RAG search failed, falling back to text match: {e}")

    # Fallback: simple text matching
    db = FirestoreService.get_client()
    docs_query = db.collection("organizations").document(org_id).collection("knowledge")
    if category:
        docs_query = docs_query.where("category", "==", category)
    docs_query = docs_query.where("status", "==", "indexed")
    docs = docs_query.stream()

    results = []
    query_lower = query.lower()

    for doc in docs:
        data = doc.to_dict()
        score = 0
        if query_lower in data.get("title", "").lower():
            score += 10
        if query_lower in data.get("source", "").lower():
            score += 5

        if score > 0:
            results.append({
                "document_id": doc.id,
                "title": data.get("title"),
                "category": data.get("category"),
                "source": data.get("source"),
                "score": score,
                "snippet": f"関連ドキュメント: {data.get('title')}",
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:limit]

    return {"results": results, "query": query, "total": len(results)}


@router.post("/seed")
async def seed_knowledge(
    org_id: str = Query(...),
):
    """Seed sample knowledge documents with chunks for demo/testing."""
    db = FirestoreService.get_client()
    knowledge_col = db.collection("organizations").document(org_id).collection("knowledge")
    now = datetime.now(timezone.utc).isoformat()

    seed_documents = [
        {
            "title": "BPSモデル基礎",
            "category": "bps",
            "source": "医療教育テキスト",
            "status": "indexed",
            "total_chunks": 3,
            "agent_bindings": ["intake", "context", "summary"],
            "created_at": now,
            "updated_at": now,
            "chunks": [
                {
                    "text": "BPSモデル（Bio-Psycho-Social Model）は、1977年にジョージ・エンゲルが提唱した医療モデルである。疾患を生物学的（Biological）、心理的（Psychological）、社会的（Social）の3つの側面から包括的に捉えるアプローチであり、従来の生物医学モデルの限界を克服するために開発された。在宅医療においては、患者の生活環境や家族関係、心理状態を含めた全人的アセスメントが不可欠であり、BPSモデルはその基盤となる。",
                    "token_count": 180,
                },
                {
                    "text": "BPSアセスメントの実施手法：生物学的側面では、バイタルサイン、既往歴、服薬状況、ADL（日常生活動作）、栄養状態を評価する。心理的側面では、認知機能（HDS-R、MMSE）、うつスクリーニング（GDS-15）、不安・ストレス評価、睡眠パターン、疼痛の主観的評価を行う。社会的側面では、家族構成・介護力、経済状況、住環境、社会的孤立リスク、利用中の介護サービスを確認する。",
                    "token_count": 170,
                },
                {
                    "text": "BPSモデルに基づく多職種連携：在宅医療チームでは、医師が生物学的側面を主に担当し、看護師がバイタルサインのモニタリングと心理的サポートを行う。ケアマネージャーは社会的側面の調整を担い、理学療法士・作業療法士がADL維持・改善を支援する。各職種がBPSの視点を共有することで、患者中心のケアプランが実現する。定期的なカンファレンスでBPS各側面の変化を共有し、ケアプランを適時修正することが重要である。",
                    "token_count": 185,
                },
            ],
        },
        {
            "title": "在宅医療ガイドライン",
            "category": "homecare",
            "source": "厚生労働省ガイドライン",
            "status": "indexed",
            "total_chunks": 3,
            "agent_bindings": ["context", "summary"],
            "created_at": now,
            "updated_at": now,
            "chunks": [
                {
                    "text": "在宅医療における訪問頻度の目安：安定期の患者は月2回の定期訪問が基本となる。状態変化時や急性増悪時には週1〜2回に増頻する。終末期（看取り期）には連日訪問も検討する。訪問看護は医師の指示書に基づき、週3回を上限として介護保険で提供される。特別訪問看護指示書が交付された場合は、14日間に限り毎日の訪問が可能となる。",
                    "token_count": 160,
                },
                {
                    "text": "在宅介護制度の概要：介護保険制度は要支援1〜2、要介護1〜5の7段階で区分される。居宅サービスには訪問介護、訪問看護、訪問リハビリテーション、通所介護（デイサービス）、短期入所（ショートステイ）がある。地域密着型サービスとして小規模多機能型居宅介護、定期巡回・随時対応型訪問介護看護がある。ケアマネージャーがケアプランを作成し、サービス担当者会議で多職種が連携する。",
                    "token_count": 175,
                },
                {
                    "text": "在宅医療の緊急対応体制：24時間対応の在宅療養支援診療所（機能強化型）では、常勤医師3名以上、過去1年間の緊急往診実績10件以上が要件となる。夜間・休日の電話対応（トリアージ）を行い、緊急度に応じて電話指導、翌日訪問、緊急往診の判断を行う。患者・家族には事前に緊急連絡先と対応手順を説明し、急変時のアクションカードを配布しておくことが推奨される。",
                    "token_count": 170,
                },
            ],
        },
        {
            "title": "臨床推論プロセス",
            "category": "clinical",
            "source": "臨床推論教育マニュアル",
            "status": "indexed",
            "total_chunks": 2,
            "agent_bindings": ["intake", "context", "alert"],
            "created_at": now,
            "updated_at": now,
            "chunks": [
                {
                    "text": "臨床推論の基本ステップ：(1) 情報収集 - 主訴、現病歴、既往歴、身体所見、検査データを系統的に収集する。(2) 問題リスト作成 - 収集した情報から活動的問題（active problems）を抽出し優先順位をつける。(3) 鑑別診断の生成 - 各問題に対して可能性のある疾患・状態を列挙する。解剖学的アプローチ、病態生理学的アプローチ、頻度順アプローチを使い分ける。(4) 仮説の検証 - 追加の問診・検査で鑑別を絞り込む。",
                    "token_count": 195,
                },
                {
                    "text": "在宅患者における鑑別診断の特徴：高齢在宅患者では、非典型的な症状提示が多い。発熱なき感染症、無痛性心筋梗塞、せん妄による認知症様症状などに注意する。多疾患併存（マルチモビディティ）が一般的であり、ポリファーマシーによる薬剤性の症状も常に鑑別に含める。Red Flags（見逃してはならない危険な徴候）として、意識レベル変化、急激な体重変化、持続する疼痛、繰り返す転倒、新規の嚥下障害を評価する。",
                    "token_count": 190,
                },
            ],
        },
    ]

    created_ids = []
    for doc_seed in seed_documents:
        chunks_data = doc_seed.pop("chunks")
        doc_ref = knowledge_col.document()
        doc_ref.set(doc_seed)

        # Write chunks subcollection
        chunks_col = doc_ref.collection("chunks")
        for i, chunk in enumerate(chunks_data):
            chunks_col.document(f"chunk_{i:04d}").set({
                "chunk_index": i,
                "text": chunk["text"],
                "token_count": chunk["token_count"],
                "embedding": [],
                "category": doc_seed["category"],
                "source": doc_seed["source"],
                "doc_id": doc_ref.id,
            })

        created_ids.append({"id": doc_ref.id, "title": doc_seed["title"]})

    return {
        "success": True,
        "message": f"Seeded {len(created_ids)} knowledge documents",
        "documents": created_ids,
    }


@router.get("/categories")
async def list_categories():
    """List available knowledge categories."""
    return {
        "categories": [
            {"id": k, "name": v} for k, v in KNOWLEDGE_CATEGORIES.items()
        ]
    }


@router.put("/documents/{document_id}/bindings")
async def update_agent_bindings(
    document_id: str,
    org_id: str = Query(...),
    agent_ids: list[str] = Query(...),
):
    """Update which agents can use this document."""
    db = FirestoreService.get_client()
    doc_ref = (
        db.collection("organizations")
        .document(org_id)
        .collection("knowledge")
        .document(document_id)
    )

    doc_ref.update(
        {
            "agent_bindings": agent_ids,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"success": True, "agent_bindings": agent_ids}
