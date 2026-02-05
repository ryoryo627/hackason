"""
Knowledge Base API endpoints.

Manages RAG knowledge documents for AI agents.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, UploadFile, File, HTTPException
from pydantic import BaseModel

from services.firestore_service import FirestoreService

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

        query = query.order_by("updated_at", direction="DESCENDING").limit(limit)
        docs = query.stream()

        documents = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            documents.append(data)

        return {"documents": documents, "total": len(documents)}
    except Exception as e:
        # Return empty list if collection doesn't exist
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
    now = datetime.utcnow().isoformat()

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
    """Upload a file for a knowledge document."""
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

    # Update document status
    doc_ref.update(
        {
            "status": "processing",
            "file_name": file.filename,
            "file_type": file.content_type,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )

    # In production, this would:
    # 1. Upload file to GCS
    # 2. Trigger Cloud Function to process (chunk + embed)
    # 3. Store chunks in Firestore
    # 4. Create embeddings with text-embedding-005
    # 5. Index in Vertex AI Vector Search

    # For demo, simulate processing completion
    doc_ref.update(
        {
            "status": "indexed",
            "total_chunks": 50,  # Simulated
            "updated_at": datetime.utcnow().isoformat(),
        }
    )

    return {
        "success": True,
        "document_id": document_id,
        "file_name": file.filename,
        "status": "indexed",
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

    updates = {"updated_at": datetime.utcnow().isoformat()}
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

    # Delete chunks subcollection first
    chunks = doc_ref.collection("chunks").stream()
    for chunk in chunks:
        chunk.reference.delete()

    # Delete document
    doc_ref.delete()

    # In production, also delete from Vector Search index

    return {"success": True}


@router.post("/search")
async def search_knowledge(
    org_id: str = Query(...),
    query: str = Query(..., min_length=1),
    category: Optional[str] = Query(None),
    limit: int = Query(5),
):
    """
    Search knowledge base using semantic search.

    In production, this would use Vertex AI Vector Search.
    For demo, we do simple text matching.
    """
    db = FirestoreService.get_client()

    # Get all documents (in production, use Vector Search)
    docs_query = db.collection("organizations").document(org_id).collection("knowledge")
    if category:
        docs_query = docs_query.where("category", "==", category)

    docs_query = docs_query.where("status", "==", "indexed")
    docs = docs_query.stream()

    results = []
    query_lower = query.lower()

    for doc in docs:
        data = doc.to_dict()
        # Simple relevance scoring (in production, use embedding similarity)
        score = 0
        if query_lower in data.get("title", "").lower():
            score += 10
        if query_lower in data.get("source", "").lower():
            score += 5

        if score > 0:
            results.append(
                {
                    "document_id": doc.id,
                    "title": data.get("title"),
                    "category": data.get("category"),
                    "source": data.get("source"),
                    "score": score,
                    "snippet": f"関連ドキュメント: {data.get('title')}",  # In production, return actual chunk
                }
            )

    # Sort by score and limit
    results.sort(key=lambda x: x["score"], reverse=True)
    results = results[:limit]

    return {"results": results, "query": query, "total": len(results)}


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
            "updated_at": datetime.utcnow().isoformat(),
        }
    )

    return {"success": True, "agent_bindings": agent_ids}
