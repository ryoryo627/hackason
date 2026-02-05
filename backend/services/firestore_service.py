"""
Firestore Service - Database operations for HomeCare AI Agent.
"""

from datetime import datetime
from typing import Any

from google.cloud import firestore

from config import get_settings


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
        status: str = "active",
        risk_level: str | None = None,
        facility: str | None = None,
        area: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """List patients with optional filters."""
        db = cls.get_client()
        query = db.collection("patients").where("org_id", "==", org_id).where("status", "==", status)

        if risk_level:
            query = query.where("risk_level", "==", risk_level)
        if facility:
            query = query.where("facility", "==", facility)
        if area:
            query = query.where("area", "==", area)

        query = query.order_by("updated_at", direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

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

    # === Reports ===

    @classmethod
    async def list_reports(
        cls,
        patient_id: str,
        limit: int = 50,
        since: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """List reports for a patient."""
        db = cls.get_client()
        query = db.collection("patients").document(patient_id).collection("reports")

        if since:
            query = query.where("timestamp", ">=", since)

        query = query.order_by("timestamp", direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def create_report(cls, patient_id: str, data: dict[str, Any]) -> str:
        """Create a new report for a patient."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        doc_ref = db.collection("patients").document(patient_id).collection("reports").document()
        doc_ref.set(data)
        return doc_ref.id

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
    ) -> list[dict[str, Any]]:
        """List alerts with optional filters."""
        db = cls.get_client()

        if patient_id:
            query = db.collection("patients").document(patient_id).collection("alerts")
        else:
            # Cross-patient alert query requires a different approach
            # For MVP, iterate through patients
            query = db.collection_group("alerts")

        if acknowledged is not None:
            query = query.where("acknowledged", "==", acknowledged)
        if severity:
            query = query.where("severity", "==", severity)

        query = query.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def create_alert(cls, patient_id: str, data: dict[str, Any]) -> str:
        """Create a new alert for a patient."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["acknowledged"] = False
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
        """Get service configuration."""
        db = cls.get_client()
        doc = db.collection("service_configs").document(f"{org_id}_{service_id}").get()
        if doc.exists:
            return doc.to_dict()
        return None

    @classmethod
    async def update_service_config(
        cls, org_id: str, service_id: str, data: dict[str, Any]
    ) -> None:
        """Update service configuration."""
        db = cls.get_client()
        data["org_id"] = org_id
        data["service_id"] = service_id
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        db.collection("service_configs").document(f"{org_id}_{service_id}").set(data, merge=True)

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
        query = db.collection("knowledge_documents").where("org_id", "==", org_id)

        if category:
            query = query.where("category", "==", category)
        if status:
            query = query.where("status", "==", status)

        query = query.order_by("updated_at", direction=firestore.Query.DESCENDING).limit(limit)

        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    @classmethod
    async def create_knowledge_document(cls, data: dict[str, Any]) -> str:
        """Create a new knowledge document."""
        db = cls.get_client()
        data["created_at"] = firestore.SERVER_TIMESTAMP
        data["updated_at"] = firestore.SERVER_TIMESTAMP
        data["status"] = "uploading"
        doc_ref = db.collection("knowledge_documents").document()
        doc_ref.set(data)
        return doc_ref.id

    # === Batch Operations ===

    @classmethod
    def get_batch(cls) -> firestore.WriteBatch:
        """Get a new write batch for atomic operations."""
        db = cls.get_client()
        return db.batch()
