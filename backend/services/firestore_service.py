"""
Firestore Service - Database operations for HomeCare AI Agent.
"""

import time
from datetime import datetime
from typing import Any

from google.cloud import firestore

from config import get_settings

# In-memory cache for service_configs (TTL 60s)
_config_cache: dict[str, tuple[dict[str, Any], float]] = {}
_CONFIG_CACHE_TTL = 60


def _get_cached_config(key: str) -> dict[str, Any] | None:
    """Get config from cache if not expired."""
    if key in _config_cache:
        data, ts = _config_cache[key]
        if time.monotonic() - ts < _CONFIG_CACHE_TTL:
            return data
        del _config_cache[key]
    return None


def _set_cached_config(key: str, data: dict[str, Any]) -> None:
    """Set config in cache."""
    _config_cache[key] = (data, time.monotonic())


def clear_config_cache(org_id: str | None = None, service_id: str | None = None) -> None:
    """Clear config cache. If org_id+service_id given, clear specific entry."""
    if org_id and service_id:
        _config_cache.pop(f"{org_id}_{service_id}", None)
    else:
        _config_cache.clear()


class FirestoreService:
    """Service class for Firestore database operations."""

    _db: firestore.Client | None = None

    @classmethod
    def get_client(cls) -> firestore.Client:
        """Get or create Firestore client."""
        if cls._db is None:
            settings = get_settings()
            cls._db = firestore.Client(
                project=settings.google_cloud_project,
                database=settings.firestore_database_id,
            )
        return cls._db

    # === Users ===

    @classmethod
    async def get_user(cls, uid: str) -> dict[str, Any] | None:
        """Get user by Firebase UID."""
        db = cls.get_client()
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            data = doc.to_dict()
            data["uid"] = doc.id
            return data
        return None

    @classmethod
    async def create_user(cls, uid: str, data: dict[str, Any]) -> str:
        """Create a new user document."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("users").document(uid).set(data)
        return uid

    @classmethod
    async def update_user(cls, uid: str, data: dict[str, Any]) -> None:
        """Update user data."""
        db = cls.get_client()
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("users").document(uid).update(data)

    @classmethod
    async def get_or_create_user(cls, uid: str, email: str, display_name: str | None = None) -> dict[str, Any]:
        """Get existing user or create new one."""
        user = await cls.get_user(uid)
        if user:
            return user

        user_data = {
            "email": email,
            "display_name": display_name or email.split("@")[0],
            "organization_id": None,
            "role": "admin",  # First user is admin
        }
        await cls.create_user(uid, user_data)
        return {**user_data, "uid": uid}

    @classmethod
    async def list_users_by_org(cls, org_id: str) -> list[dict[str, Any]]:
        """List all users belonging to an organization, sorted by created_at descending."""
        db = cls.get_client()
        docs = db.collection("users").where("organization_id", "==", org_id).stream()
        results = [{"uid": doc.id, **doc.to_dict()} for doc in docs]
        results.sort(key=lambda x: x.get("created_at", "") or "", reverse=True)
        return results

    @classmethod
    async def delete_user(cls, uid: str) -> None:
        """Delete a user document from Firestore."""
        db = cls.get_client()
        db.collection("users").document(uid).delete()

    # === Organizations ===

    @classmethod
    async def get_organization(cls, org_id: str) -> dict[str, Any] | None:
        """Get organization by ID."""
        db = cls.get_client()
        doc = db.collection("organizations").document(org_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None

    @classmethod
    async def create_organization(cls, org_id: str, data: dict[str, Any]) -> str:
        """Create a new organization."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("organizations").document(org_id).set(data)
        return org_id

    @classmethod
    async def update_organization(cls, org_id: str, data: dict[str, Any]) -> None:
        """Update organization data."""
        db = cls.get_client()
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("organizations").document(org_id).update(data)

    # === Facilities ===

    @classmethod
    async def list_facilities(cls, org_id: str) -> list[dict[str, Any]]:
        """List all facilities for an organization."""
        db = cls.get_client()
        docs = db.collection("organizations").document(org_id).collection("facilities").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def create_facility(cls, org_id: str, data: dict[str, Any]) -> str:
        """Create a new facility."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        doc_ref = (
            db.collection("organizations").document(org_id).collection("facilities").document()
        )
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def delete_facility(cls, org_id: str, facility_id: str) -> None:
        """Delete a facility."""
        db = cls.get_client()
        db.collection("organizations").document(org_id).collection("facilities").document(facility_id).delete()

    # === Areas ===

    @classmethod
    async def list_areas(cls, org_id: str) -> list[dict[str, Any]]:
        """List all areas for an organization."""
        db = cls.get_client()
        docs = db.collection("organizations").document(org_id).collection("areas").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def create_area(cls, org_id: str, data: dict[str, Any]) -> str:
        """Create a new area."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        doc_ref = db.collection("organizations").document(org_id).collection("areas").document()
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def delete_area(cls, org_id: str, area_id: str) -> None:
        """Delete an area."""
        db = cls.get_client()
        db.collection("organizations").document(org_id).collection("areas").document(area_id).delete()

    # === Patients ===

    @classmethod
    async def list_patients(
        cls,
        org_id: str,
        status: str | None = "active",
        risk_level: str | None = None,
        facility: str | None = None,
        area: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List patients with optional filters."""
        db = cls.get_client()
        query = db.collection("patients").where("org_id", "==", org_id)

        # Only add status filter if specified (to avoid requiring composite index)
        if status:
            query = query.where("status", "==", status)

        if risk_level:
            query = query.where("risk_level", "==", risk_level)
        if facility:
            query = query.where("facility", "==", facility)
        if area:
            query = query.where("area", "==", area)

        # Fetch without order_by to avoid composite index requirement
        # Sort in Python instead
        query = query.limit(limit * 2)  # Fetch extra for sorting buffer

        docs = query.stream()
        results = [{"id": doc.id, **doc.to_dict()} for doc in docs]

        # Sort by updated_at descending in Python
        results.sort(key=lambda x: x.get("updated_at", "") or "", reverse=True)

        return results[:limit]

    @classmethod
    async def get_patient(cls, patient_id: str) -> dict[str, Any] | None:
        """Get patient by ID."""
        db = cls.get_client()
        doc = db.collection("patients").document(patient_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None

    @classmethod
    async def create_patient(cls, data: dict[str, Any]) -> str:
        """Create a new patient."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        data["status"] = "active"
        doc_ref = db.collection("patients").document()
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def update_patient(cls, patient_id: str, data: dict[str, Any]) -> None:
        """Update patient data."""
        db = cls.get_client()
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("patients").document(patient_id).update(data)

    @classmethod
    async def archive_patient(cls, patient_id: str) -> None:
        """Archive a patient (soft delete). Subcollections are preserved."""
        db = cls.get_client()
        db.collection("patients").document(patient_id).update({
            "status": "archived",
            "archived_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })

    # === Reports ===

    @classmethod
    async def list_reports(
        cls,
        patient_id: str,
        limit: int = 50,
        since: datetime | None = None,
        acknowledged: bool | None = None,
    ) -> list[dict[str, Any]]:
        """List reports for a patient."""
        db = cls.get_client()
        query = db.collection("patients").document(patient_id).collection("reports")

        if acknowledged is not None:
            query = query.where("acknowledged", "==", acknowledged)

        # Order by timestamp descending for correct chronological order
        query = query.order_by("timestamp", direction=firestore.Query.DESCENDING)
        query = query.limit(limit)

        try:
            docs = query.stream()
            results = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        except Exception as e:
            # Composite index not yet created - fallback to Python sort
            print(f"[WARN] Firestore order_by failed (index needed?): {e}")
            query = db.collection("patients").document(patient_id).collection("reports")
            if acknowledged is not None:
                query = query.where("acknowledged", "==", acknowledged)
            docs = query.stream()
            results = [{"id": doc.id, **doc.to_dict()} for doc in docs]
            # Type-safe sort
            results.sort(
                key=lambda x: x.get("timestamp") if isinstance(x.get("timestamp"), datetime) else datetime.min,
                reverse=True,
            )
            results = results[:limit]

        # Filter by since if specified
        if since:
            results = [
                r for r in results
                if r.get("timestamp") and r.get("timestamp") >= since
            ]

        return results

    @classmethod
    async def create_report(cls, patient_id: str, data: dict[str, Any]) -> str:
        """Create a new report for a patient."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data.setdefault("acknowledged", False)
        doc_ref = db.collection("patients").document(patient_id).collection("reports").document()
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def acknowledge_report(
        cls, patient_id: str, report_id: str, acknowledged_by: str
    ) -> None:
        """Mark a report as acknowledged."""
        db = cls.get_client()
        db.collection("patients").document(patient_id).collection("reports").document(
            report_id
        ).update(
            {
                "acknowledged": True,
                "acknowledged_by": acknowledged_by,
                "acknowledged_at": firestore.SERVER_TIMESTAMP,
            }
        )

    # === Context ===

    @classmethod
    async def get_patient_context(cls, patient_id: str) -> dict[str, Any] | None:
        """Get current context for a patient."""
        db = cls.get_client()
        doc = (
            db.collection("patients").document(patient_id).collection("context").document("current").get()
        )
        if doc.exists:
            return doc.to_dict()
        return None

    @classmethod
    async def update_patient_context(cls, patient_id: str, data: dict[str, Any]) -> None:
        """Update patient context."""
        db = cls.get_client()
        data["last_updated"] = firestore.SERVER_TIMESTAMP
        db.collection("patients").document(patient_id).collection("context").document("current").set(
            data, merge=True
        )

    # === Alerts ===

    @classmethod
    async def list_alerts(
        cls,
        patient_id: str | None = None,
        org_id: str | None = None,
        acknowledged: bool | None = None,
        severity: str | None = None,
        limit: int = 50,
        since: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """List alerts with optional filters."""
        db = cls.get_client()

        # severity を小文字に正規化（既存データとの互換性）
        if severity:
            severity = severity.lower()

        if patient_id:
            # 単一患者 → 直接サブコレクション読み取り
            results = cls._query_patient_alerts(db, patient_id, acknowledged, severity, limit)
        elif org_id:
            # 組織全体 → 患者一覧取得 → 各患者のアラート読み取り
            patients = await cls.list_patients(org_id, status=None, limit=500)
            results = []
            for patient in patients:
                pid = patient.get("id")
                if not pid:
                    continue
                try:
                    patient_alerts = cls._query_patient_alerts(db, pid, acknowledged, severity, 20)
                    results.extend(patient_alerts)
                except Exception as e:
                    print(f"Alert query failed for patient {pid}: {e}")
        else:
            return []

        # severity を小文字に正規化（既存データの大文字対応）
        for r in results:
            if "severity" in r:
                r["severity"] = r["severity"].lower()

        # since フィルタ（list_reports と同パターン）
        if since:
            results = [r for r in results if r.get("created_at") and r.get("created_at") >= since]

        # created_at 降順でソート
        results.sort(key=lambda x: x.get("created_at", "") or "", reverse=True)
        return results[:limit]

    @classmethod
    def _query_patient_alerts(
        cls, db, patient_id: str, acknowledged: bool | None, severity: str | None, limit: int
    ) -> list[dict[str, Any]]:
        """特定患者のアラートをクエリ"""
        query = db.collection("patients").document(patient_id).collection("alerts")
        if acknowledged is not None:
            query = query.where("acknowledged", "==", acknowledged)
        if severity:
            query = query.where("severity", "==", severity)
        query = query.limit(limit)
        docs = query.stream()
        return [{"id": doc.id, "patient_id": patient_id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def create_alert(cls, patient_id: str, data: dict[str, Any]) -> str:
        """Create a new alert for a patient."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["acknowledged"] = False
        data["patient_id"] = patient_id
        # org_id が未設定の場合、患者ドキュメントから取得
        if "org_id" not in data:
            patient = await cls.get_patient(patient_id)
            if patient:
                data["org_id"] = patient.get("org_id")
        doc_ref = db.collection("patients").document(patient_id).collection("alerts").document()
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def acknowledge_alert(
        cls, patient_id: str, alert_id: str, acknowledged_by: str
    ) -> None:
        """Mark an alert as acknowledged."""
        db = cls.get_client()
        db.collection("patients").document(patient_id).collection("alerts").document(
            alert_id
        ).update(
            {
                "acknowledged": True,
                "acknowledged_by": acknowledged_by,
                "acknowledged_at": firestore.SERVER_TIMESTAMP,
            }
        )

    # === Service Configs ===

    @classmethod
    async def get_service_config(cls, org_id: str, service_id: str) -> dict[str, Any] | None:
        """Get service configuration (cached with 60s TTL)."""
        cache_key = f"{org_id}_{service_id}"
        cached = _get_cached_config(cache_key)
        if cached is not None:
            return cached

        db = cls.get_client()
        doc = db.collection("service_configs").document(cache_key).get()
        if doc.exists:
            data = doc.to_dict()
            _set_cached_config(cache_key, data)
            return data
        return None

    @classmethod
    async def list_service_configs(cls, service_id: str) -> list[dict[str, Any]]:
        """List all service configurations for a given service type (e.g. 'slack', 'gemini')."""
        db = cls.get_client()
        docs = db.collection("service_configs").where("service_id", "==", service_id).stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def update_service_config(
        cls, org_id: str, service_id: str, data: dict[str, Any]
    ) -> None:
        """Update service configuration (invalidates cache)."""
        db = cls.get_client()
        data["org_id"] = org_id
        data["service_id"] = service_id
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("service_configs").document(f"{org_id}_{service_id}").set(data, merge=True)
        clear_config_cache(org_id, service_id)

    # === Knowledge Documents ===

    @classmethod
    async def list_knowledge_documents(
        cls,
        org_id: str,
        category: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List knowledge documents."""
        db = cls.get_client()
        query = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge")
        )

        if category:
            query = query.where("category", "==", category)
        if status:
            query = query.where("status", "==", status)

        # Fetch without order_by to avoid composite index requirement
        query = query.limit(limit * 2)

        docs = query.stream()
        results = [{"id": doc.id, **doc.to_dict()} for doc in docs]

        # Sort by updated_at descending in Python
        results.sort(key=lambda x: x.get("updated_at", "") or "", reverse=True)

        return results[:limit]

    @classmethod
    async def create_knowledge_document(cls, org_id: str, data: dict[str, Any]) -> str:
        """Create a new knowledge document."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        data["status"] = "uploading"
        doc_ref = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge")
            .document()
        )
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def get_patients_batch(cls, patient_ids: list[str]) -> dict[str, dict[str, Any]]:
        """Get multiple patients by IDs in a single batch read."""
        if not patient_ids:
            return {}
        db = cls.get_client()
        unique_ids = list(set(patient_ids))
        refs = [db.collection("patients").document(pid) for pid in unique_ids]
        docs = db.get_all(refs)
        result = {}
        for doc in docs:
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                result[doc.id] = data
        return result

    # === Knowledge Chunks ===

    @classmethod
    async def save_knowledge_chunks(
        cls,
        org_id: str,
        doc_id: str,
        chunks: list[dict[str, Any]],
        embeddings: list[list[float]],
        category: str = "",
        source: str = "",
    ) -> None:
        """Save knowledge chunks with embeddings to Firestore using batch writes."""
        db = cls.get_client()
        chunks_col = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge")
            .document(doc_id)
            .collection("chunks")
        )

        # Delete existing chunks first
        existing = chunks_col.stream()
        for existing_doc in existing:
            existing_doc.reference.delete()

        # Write in batches of 500 (Firestore batch limit)
        batch = db.batch()
        batch_count = 0

        for i, chunk in enumerate(chunks):
            doc_ref = chunks_col.document(f"chunk_{i:04d}")
            chunk_data = {
                "chunk_index": chunk.get("chunk_index", i),
                "text": chunk.get("text", ""),
                "token_count": chunk.get("token_count", 0),
                "embedding": embeddings[i] if i < len(embeddings) else [],
                "category": category,
                "source": source,
                "doc_id": doc_id,
            }
            batch.set(doc_ref, chunk_data)
            batch_count += 1

            if batch_count >= 400:  # Leave margin under 500 limit
                batch.commit()
                batch = db.batch()
                batch_count = 0

        if batch_count > 0:
            batch.commit()

    @classmethod
    async def list_knowledge_chunks(
        cls,
        org_id: str,
        doc_id: str,
    ) -> list[dict[str, Any]]:
        """List chunks for a specific knowledge document (without embeddings)."""
        db = cls.get_client()
        chunks_col = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge")
            .document(doc_id)
            .collection("chunks")
        )
        docs = chunks_col.order_by("chunk_index").stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            # Strip embeddings from response (too large)
            data.pop("embedding", None)
            data["id"] = doc.id
            results.append(data)
        return results

    @classmethod
    async def get_chunks_by_categories(
        cls,
        org_id: str,
        categories: list[str] | None = None,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        """Get all chunks from indexed documents matching categories."""
        db = cls.get_client()
        knowledge_col = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge")
        )

        # Get indexed documents
        query = knowledge_col.where("status", "==", "indexed")
        docs = list(query.stream())

        all_chunks: list[dict[str, Any]] = []
        for doc in docs:
            doc_data = doc.to_dict()
            doc_category = doc_data.get("category", "")

            # Filter by categories if specified
            if categories and doc_category not in categories:
                continue

            # Read chunks subcollection
            chunks = doc.reference.collection("chunks").stream()
            for chunk in chunks:
                chunk_data = chunk.to_dict()
                chunk_data["doc_id"] = doc.id
                chunk_data["doc_title"] = doc_data.get("title", "")
                if not chunk_data.get("category"):
                    chunk_data["category"] = doc_category
                if not chunk_data.get("source"):
                    chunk_data["source"] = doc_data.get("source", "")
                all_chunks.append(chunk_data)

                if len(all_chunks) >= limit:
                    return all_chunks

        return all_chunks

    @classmethod
    async def get_agent_bindings(
        cls,
        org_id: str,
        agent_id: str,
    ) -> list[str]:
        """Get knowledge categories bound to an agent."""
        DEFAULT_BINDINGS: dict[str, list[str]] = {
            "intake": ["bps", "clinical", "protocol"],
            "context": ["bps", "clinical", "guidelines", "homecare", "geriatric", "medication", "protocol"],
            "alert": ["guidelines", "clinical", "medication", "protocol"],
            "summary": ["bps", "guidelines", "homecare", "palliative"],
        }

        db = cls.get_client()
        doc = (
            db.collection("organizations")
            .document(org_id)
            .collection("knowledge_agent_bindings")
            .document(agent_id)
            .get()
        )

        if doc.exists:
            data = doc.to_dict()
            return data.get("categories", DEFAULT_BINDINGS.get(agent_id, []))

        return DEFAULT_BINDINGS.get(agent_id, [])

    # === Raw Files (Slack attachments) ===

    @classmethod
    async def create_raw_file(cls, patient_id: str, data: dict[str, Any]) -> str:
        """Create a raw file record in the patient's raw_files subcollection."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        doc_ref = (
            db.collection("patients")
            .document(patient_id)
            .collection("raw_files")
            .document()
        )
        doc_ref.set(data)
        return doc_ref.id

    @classmethod
    async def list_raw_files(
        cls, patient_id: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        """List raw files for a patient."""
        db = cls.get_client()
        query = (
            db.collection("patients")
            .document(patient_id)
            .collection("raw_files")
            .limit(limit)
        )
        docs = query.stream()
        results = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        results.sort(key=lambda x: x.get("created_at", "") or "", reverse=True)
        return results

    # === Batch Operations ===

    @classmethod
    def get_batch(cls) -> firestore.WriteBatch:
        """Get a new write batch for atomic operations."""
        db = cls.get_client()
        return db.batch()
