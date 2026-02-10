"""
RAG Service - Document processing and semantic search.

Handles text extraction, chunking, embedding generation, and
cosine similarity search using Firestore as the vector store.
"""

import asyncio
import io
import re
from typing import Any

import numpy as np
from google import genai

EMBEDDING_MODEL = "text-embedding-005"
MAX_BATCH_SIZE = 20
MAX_CHUNKS_PER_DOC = 100


class RAGService:
    """Service for RAG (Retrieval-Augmented Generation) operations."""

    # ─── Text Extraction ───

    @staticmethod
    def extract_text(file_bytes: bytes, content_type: str) -> str:
        """Extract plain text from various file formats."""
        if content_type in ("text/plain", "text/markdown"):
            return file_bytes.decode("utf-8", errors="replace")

        if content_type == "application/pdf":
            return RAGService._extract_pdf(file_bytes)

        if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return RAGService._extract_docx(file_bytes)

        raise ValueError(f"Unsupported content type: {content_type}")

    @staticmethod
    def _extract_pdf(file_bytes: bytes) -> str:
        from PyPDF2 import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
        return "\n\n".join(pages)

    @staticmethod
    def _extract_docx(file_bytes: bytes) -> str:
        from docx import Document

        doc = Document(io.BytesIO(file_bytes))
        paragraphs = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)
        return "\n\n".join(paragraphs)

    # ─── Chunking ───

    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = 500,
        overlap: int = 50,
    ) -> list[dict[str, Any]]:
        """Split text into overlapping chunks at paragraph boundaries."""
        if not text.strip():
            return []

        # Split by paragraph boundaries
        paragraphs = re.split(r"\n\n+", text.strip())

        chunks: list[dict[str, Any]] = []
        current_text = ""
        chunk_index = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If adding this paragraph exceeds chunk_size, finalize current chunk
            if current_text and len(current_text) + len(para) + 1 > chunk_size:
                chunks.append({
                    "chunk_index": chunk_index,
                    "text": current_text.strip(),
                    "token_count": len(current_text) // 3,  # rough estimate
                })
                chunk_index += 1

                # Carry overlap from end of previous chunk
                if overlap > 0 and len(current_text) > overlap:
                    current_text = current_text[-overlap:] + "\n" + para
                else:
                    current_text = para

                if chunk_index >= MAX_CHUNKS_PER_DOC:
                    print(f"[WARN] Max chunks ({MAX_CHUNKS_PER_DOC}) reached, truncating")
                    break
            else:
                current_text = (current_text + "\n" + para).strip() if current_text else para

            # Handle very long paragraphs by splitting at sentence boundaries
            while len(current_text) > chunk_size:
                # Find a sentence boundary (。or \n) near chunk_size
                split_pos = -1
                for sep in ["。", "\n", ".", "、"]:
                    pos = current_text.rfind(sep, 0, chunk_size)
                    if pos > chunk_size // 3:
                        split_pos = pos + len(sep)
                        break

                if split_pos <= 0:
                    split_pos = chunk_size

                chunks.append({
                    "chunk_index": chunk_index,
                    "text": current_text[:split_pos].strip(),
                    "token_count": split_pos // 3,
                })
                chunk_index += 1
                current_text = current_text[max(0, split_pos - overlap):].strip()

                if chunk_index >= MAX_CHUNKS_PER_DOC:
                    break

        # Add remaining text
        if current_text.strip() and chunk_index < MAX_CHUNKS_PER_DOC:
            chunks.append({
                "chunk_index": chunk_index,
                "text": current_text.strip(),
                "token_count": len(current_text) // 3,
            })

        return chunks

    # ─── Embedding ───

    @staticmethod
    async def generate_embeddings(
        texts: list[str], api_key: str
    ) -> list[list[float]]:
        """Generate embeddings using text-embedding-005 in batches."""
        client = genai.Client(api_key=api_key)
        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), MAX_BATCH_SIZE):
            batch = texts[i : i + MAX_BATCH_SIZE]
            result = await asyncio.to_thread(
                client.models.embed_content,
                model=EMBEDDING_MODEL,
                contents=batch,
            )
            all_embeddings.extend(e.values for e in result.embeddings)

        return all_embeddings

    # ─── Similarity ───

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        dot = np.dot(va, vb)
        norm = np.linalg.norm(va) * np.linalg.norm(vb)
        if norm == 0:
            return 0.0
        return float(dot / norm)

    # ─── Full Pipeline ───

    @staticmethod
    async def process_document(
        doc_id: str,
        org_id: str,
        file_bytes: bytes,
        content_type: str,
        api_key: str,
        category: str = "",
        source: str = "",
    ) -> dict[str, Any]:
        """Full RAG pipeline: extract → chunk → embed → store."""
        from services.firestore_service import FirestoreService

        db = FirestoreService.get_client()
        doc_ref = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge")
            .document(doc_id)
        )

        try:
            # 1. Extract text
            text = RAGService.extract_text(file_bytes, content_type)
            if not text.strip():
                doc_ref.update({"status": "error", "error_message": "テキストを抽出できませんでした"})
                return {"success": False, "error": "Empty text"}

            # 2. Chunk
            chunks = RAGService.chunk_text(text)
            if not chunks:
                doc_ref.update({"status": "error", "error_message": "チャンク分割に失敗しました"})
                return {"success": False, "error": "No chunks generated"}

            # 3. Generate embeddings
            chunk_texts = [c["text"] for c in chunks]
            embeddings = await RAGService.generate_embeddings(chunk_texts, api_key)

            # 4. Save chunks to Firestore
            await FirestoreService.save_knowledge_chunks(
                org_id=org_id,
                doc_id=doc_id,
                chunks=chunks,
                embeddings=embeddings,
                category=category,
                source=source,
            )

            # 5. Update document status
            from datetime import datetime, timezone

            doc_ref.update({
                "status": "indexed",
                "total_chunks": len(chunks),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

            return {
                "success": True,
                "total_chunks": len(chunks),
                "total_chars": len(text),
            }

        except Exception as e:
            print(f"[ERROR] RAG process_document failed: {e}")
            doc_ref.update({
                "status": "error",
                "error_message": str(e)[:500],
            })
            return {"success": False, "error": str(e)}

    # ─── Search ───

    @staticmethod
    async def search(
        query: str,
        org_id: str,
        categories: list[str] | None = None,
        api_key: str = "",
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """Search knowledge base using cosine similarity."""
        from services.firestore_service import FirestoreService

        if not api_key:
            return []

        # Generate query embedding
        query_embedding = await RAGService.generate_embeddings([query], api_key)
        if not query_embedding:
            return []
        q_vec = query_embedding[0]

        # Get all chunks from matching categories
        all_chunks = await FirestoreService.get_chunks_by_categories(
            org_id, categories, limit=500
        )

        if not all_chunks:
            return []

        # Compute similarities
        scored: list[tuple[float, dict[str, Any]]] = []
        for chunk in all_chunks:
            embedding = chunk.get("embedding")
            if not embedding:
                continue
            sim = RAGService.cosine_similarity(q_vec, embedding)
            scored.append((sim, chunk))

        # Sort by similarity descending
        scored.sort(key=lambda x: x[0], reverse=True)

        # Return top-K results
        results = []
        for score, chunk in scored[:limit]:
            results.append({
                "text": chunk.get("text", ""),
                "category": chunk.get("category", ""),
                "source": chunk.get("source", ""),
                "doc_id": chunk.get("doc_id", ""),
                "chunk_index": chunk.get("chunk_index", 0),
                "score": round(score, 4),
            })

        return results
