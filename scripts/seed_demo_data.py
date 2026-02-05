#!/usr/bin/env python3
"""
Demo Data Seeding Script for HomeCare AI Agent.

Based on data-model.md specifications:
- 24 patients with distribution: HIGH:4, MEDIUM:8, LOW:12
- 3 facilities, 5 areas
- Tags: 要注意:6, 独居:4, 看取り期:2, 難病:2
- Detailed demo patient: 田中太郎 (85M) with 10+ reports, 2 alerts, full context
"""

import argparse
import os
import random
import sys
from datetime import datetime, timedelta
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from google.cloud import firestore

# Demo organization
DEMO_ORG_ID = "demo-org-001"
DEMO_ORG = {
    "name": "デモ在宅医療クリニック",
    "slack_workspace_id": None,
    "slack_workspace_name": None,
    "slack_bot_user_id": None,
    "slack_token_ref": None,
    "signing_secret_ref": None,
    "oncall_channel_id": None,
    "setup_completed_at": None,
}

# Facilities
FACILITIES = [
    {"name": "本院", "address": "東京都渋谷区代々木1-1-1"},
    {"name": "城南サテライト", "address": "東京都品川区大崎2-2-2"},
    {"name": "城北サテライト", "address": "東京都北区王子3-3-3"},
]

# Areas
AREAS = [
    {"name": "渋谷区"},
    {"name": "品川区"},
    {"name": "北区"},
    {"name": "世田谷区"},
    {"name": "新宿区"},
]

# Conditions pool
CONDITIONS = [
    "COPD",
    "高血圧",
    "糖尿病",
    "心不全",
    "認知症",
    "脳梗塞後遺症",
    "パーキンソン病",
    "慢性腎臓病",
    "がん",
    "骨粗鬆症",
    "関節リウマチ",
    "肺炎既往",
]

# Tags
TAGS_POOL = ["要注意", "独居", "看取り期", "難病"]

# Patient names (Japanese)
PATIENT_NAMES = [
    ("田中太郎", "タナカタロウ", 85, "M"),  # Detailed demo patient
    ("山田花子", "ヤマダハナコ", 78, "F"),
    ("佐藤一郎", "サトウイチロウ", 92, "M"),
    ("鈴木美智子", "スズキミチコ", 81, "F"),
    ("高橋健二", "タカハシケンジ", 76, "M"),
    ("伊藤和子", "イトウカズコ", 89, "F"),
    ("渡辺正男", "ワタナベマサオ", 73, "M"),
    ("小林洋子", "コバヤシヨウコ", 84, "F"),
    ("加藤誠", "カトウマコト", 88, "M"),
    ("吉田春子", "ヨシダハルコ", 79, "F"),
    ("山本勝", "ヤマモトマサル", 91, "M"),
    ("中村恵子", "ナカムラケイコ", 82, "F"),
    ("小川三郎", "オガワサブロウ", 77, "M"),
    ("松本久美", "マツモトクミ", 86, "F"),
    ("井上四郎", "イノウエシロウ", 94, "M"),
    ("木村節子", "キムラセツコ", 80, "F"),
    ("林五郎", "ハヤシゴロウ", 75, "M"),
    ("斎藤幸子", "サイトウサチコ", 87, "F"),
    ("清水六郎", "シミズロクロウ", 83, "M"),
    ("森田千代", "モリタチヨ", 90, "F"),
    ("池田七郎", "イケダシチロウ", 74, "M"),
    ("橋本八重", "ハシモトヤエ", 85, "F"),
    ("山口九郎", "ヤマグチクロウ", 88, "M"),
    ("石川十子", "イシカワトオコ", 81, "F"),
]

# Risk level distribution
RISK_DISTRIBUTION = ["HIGH"] * 4 + ["MEDIUM"] * 8 + ["LOW"] * 12

# Tag distribution (roughly matches spec)
TAG_DISTRIBUTION = {
    "要注意": 6,
    "独居": 4,
    "看取り期": 2,
    "難病": 2,
}


def create_patient_data(
    index: int,
    name: str,
    name_kana: str,
    age: int,
    sex: str,
    risk_level: str,
    facility: str,
    area: str,
    tags: list[str],
) -> dict[str, Any]:
    """Create patient document data."""
    conditions = random.sample(CONDITIONS, random.randint(1, 4))

    return {
        "org_id": DEMO_ORG_ID,
        "name": name,
        "name_kana": name_kana,
        "age": age,
        "sex": sex,
        "conditions": conditions,
        "facility": facility,
        "area": area,
        "tags": tags,
        "memo": None,
        "slack_channel_id": None,
        "slack_channel_name": f"pt-{name}",
        "slack_anchor_message_ts": None,
        "risk_level": risk_level,
        "status": "active",
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }


def create_demo_reports(patient_id: str, db: firestore.Client) -> list[str]:
    """Create demo reports for detailed patient (田中太郎)."""
    reports_data = [
        {
            "bio": {
                "vitals": [
                    {"type": "SpO2", "value": 94, "unit": "%", "trend": "↓", "delta": -2, "period": "1w"},
                    {"type": "BP_systolic", "value": 142, "unit": "mmHg", "trend": "→", "delta": 0, "period": "1w"},
                    {"type": "HR", "value": 78, "unit": "bpm", "trend": "→", "delta": 0, "period": "1w"},
                ],
                "symptoms": ["食欲低下", "倦怠感"],
                "medications": [
                    {"name": "アムロジピン5mg", "adherence": "良好", "note": None},
                    {"name": "メトホルミン500mg", "adherence": "低下", "note": "週2回忘れ"},
                ],
                "adl": "入浴に介助必要",
            },
            "psycho": {
                "mood": "やや暗い",
                "cognition": None,
                "concerns": ["意欲低下の可能性"],
            },
            "social": {
                "family": "妻の介護疲労あり",
                "services": "訪看週2回",
                "concerns": [],
            },
            "reporter": "nurse",
            "reporter_name": "看護師A",
            "source_type": "text",
            "raw_text": "本日訪問。SpO2 94%とやや低下傾向。食欲低下、倦怠感を訴える。服薬は週2回程度飲み忘れあり。入浴介助実施。奥様も少し疲れている様子。",
            "confidence": 0.92,
            "alert_triggered": False,
            "timestamp": datetime.now() - timedelta(days=7),
        },
        {
            "bio": {
                "vitals": [
                    {"type": "SpO2", "value": 93, "unit": "%", "trend": "↓", "delta": -1, "period": "1d"},
                ],
                "symptoms": ["咳嗽", "痰", "食欲低下継続"],
                "medications": [],
                "adl": None,
            },
            "psycho": {
                "mood": "暗い",
                "cognition": "変化の可能性",
                "concerns": ["抑うつ傾向"],
            },
            "social": {
                "family": None,
                "services": None,
                "concerns": [],
            },
            "reporter": "nurse",
            "reporter_name": "看護師B",
            "source_type": "text",
            "raw_text": "訪問時、咳嗽と痰の訴えあり。SpO2 93%。食欲低下継続。表情が暗く、受け答えも少ない。認知機能も少し変化があるかもしれない。",
            "confidence": 0.88,
            "alert_triggered": True,
            "timestamp": datetime.now() - timedelta(days=5),
        },
        {
            "bio": {
                "vitals": [],
                "symptoms": [],
                "medications": [
                    {"name": "アムロジピン5mg", "adherence": "低下", "note": "3日間未服用"},
                    {"name": "メトホルミン500mg", "adherence": "低下", "note": "服用状況不明"},
                ],
                "adl": None,
            },
            "psycho": {
                "mood": None,
                "cognition": None,
                "concerns": [],
            },
            "social": {
                "family": "妻が体調不良",
                "services": None,
                "concerns": ["介護負担増加傾向"],
            },
            "reporter": "pharmacist",
            "reporter_name": "薬剤師C",
            "source_type": "text",
            "raw_text": "服薬指導訪問。残薬確認したところ、アムロジピンが3日分余っている。奥様の体調が悪く、服薬管理が難しくなっている様子。",
            "confidence": 0.95,
            "alert_triggered": True,
            "timestamp": datetime.now() - timedelta(days=3),
        },
        {
            "bio": {
                "vitals": [
                    {"type": "SpO2", "value": 92, "unit": "%", "trend": "↓", "delta": -1, "period": "2d"},
                    {"type": "BT", "value": 37.4, "unit": "°C", "trend": "↑", "delta": 0.6, "period": "1d"},
                ],
                "symptoms": ["発熱", "咳嗽悪化", "食欲不振"],
                "medications": [],
                "adl": "臥床傾向",
            },
            "psycho": {
                "mood": "ぐったり",
                "cognition": None,
                "concerns": [],
            },
            "social": {
                "family": None,
                "services": "訪看週2回→3回に変更検討",
                "concerns": [],
            },
            "reporter": "nurse",
            "reporter_name": "看護師A",
            "source_type": "text",
            "raw_text": "緊急訪問。SpO2 92%、体温37.4℃。咳嗽悪化、ぐったりしている。食事もほとんど取れていない。訪看の頻度増加を検討。主治医に報告予定。",
            "confidence": 0.94,
            "alert_triggered": True,
            "timestamp": datetime.now() - timedelta(days=1),
        },
    ]

    report_ids = []
    reports_ref = db.collection("patients").document(patient_id).collection("reports")

    for report in reports_data:
        report["created_at"] = firestore.SERVER_TIMESTAMP
        doc_ref = reports_ref.document()
        doc_ref.set(report)
        report_ids.append(doc_ref.id)

    return report_ids


def create_demo_context(patient_id: str, db: firestore.Client) -> None:
    """Create demo context for detailed patient."""
    context_data = {
        "current_summary": """【BPS経過サマリー】田中太郎様（85歳男性）

Bio: SpO2が1週間で96%→92%と低下傾向。発熱（37.4℃）、咳嗽・痰の増加あり。食欲低下継続。服薬アドヒアランス低下（アムロジピン3日未服用）。ADLは臥床傾向。

Psycho: 意欲低下、表情暗い。認知機能の変化の可能性あり。抑うつ傾向を示唆する所見。

Social: 主介護者である妻の体調不良により介護力低下。訪問看護の頻度増加を検討中。介護負担の増加が懸念される状況。

【総合評価】複合的なBio悪化（呼吸器症状＋服薬管理不良）に加え、Psycho・Socialの両面でも悪化傾向。早急な医療介入と介護支援体制の見直しが必要。""",
        "bio_trends": [
            {"indicator": "SpO2", "direction": "worsening", "detail": "96%→92% 1週間で4%低下"},
            {"indicator": "食欲", "direction": "worsening", "detail": "1週間継続して低下"},
            {"indicator": "服薬アドヒアランス", "direction": "worsening", "detail": "3日間未服用"},
        ],
        "psycho_trends": [
            {"indicator": "意欲", "direction": "worsening", "detail": "表情暗く、受け答え減少"},
            {"indicator": "認知機能", "direction": "worsening", "detail": "変化の可能性あり（要経過観察）"},
        ],
        "social_trends": [
            {"indicator": "介護力", "direction": "worsening", "detail": "妻の体調不良で低下"},
        ],
        "risk_factors": [
            "SpO2低下トレンド（感染症疑い）",
            "服薬アドヒアランス低下",
            "主介護者の体調不良",
            "複合的BPS悪化",
        ],
        "recommendations": [
            {
                "priority": "HIGH",
                "bps_axis": "bio",
                "text": "主治医への報告と診察依頼（発熱・SpO2低下の精査）",
            },
            {
                "priority": "HIGH",
                "bps_axis": "bio",
                "text": "服薬管理方法の見直し（一包化、服薬カレンダー等）",
            },
            {
                "priority": "MEDIUM",
                "bps_axis": "social",
                "text": "訪問看護の頻度増加（週2回→3回）",
            },
            {
                "priority": "MEDIUM",
                "bps_axis": "social",
                "text": "妻の介護負担軽減（レスパイト検討）",
            },
            {
                "priority": "MEDIUM",
                "bps_axis": "psycho",
                "text": "精神状態の継続評価と必要に応じた専門家相談",
            },
        ],
        "last_updated": firestore.SERVER_TIMESTAMP,
    }

    db.collection("patients").document(patient_id).collection("context").document("current").set(
        context_data
    )


def create_demo_alerts(patient_id: str, report_ids: list[str], db: firestore.Client) -> None:
    """Create demo alerts for detailed patient."""
    alerts_data = [
        {
            "severity": "HIGH",
            "pattern_type": "A-2",
            "pattern_name": "複合Bio悪化",
            "message": """⚠️ 【複合Bio悪化アラート】田中太郎様

SpO2低下（93%）+ 咳嗽悪化 + 食欲低下継続 + 服薬アドヒアランス低下
→ 呼吸器感染症の可能性。早急な医療介入を推奨。

📋 推奨アクション:
1. 主治医への報告・診察依頼
2. バイタル・症状の頻回モニタリング
3. 服薬管理体制の見直し""",
            "evidence": [
                {
                    "report_id": report_ids[1] if len(report_ids) > 1 else "",
                    "reporter_name": "看護師B",
                    "timestamp": datetime.now() - timedelta(days=5),
                    "summary": "SpO2 93%、咳嗽・痰、食欲低下継続、抑うつ傾向",
                },
                {
                    "report_id": report_ids[2] if len(report_ids) > 2 else "",
                    "reporter_name": "薬剤師C",
                    "timestamp": datetime.now() - timedelta(days=3),
                    "summary": "服薬アドヒアランス低下（アムロジピン3日未服用）",
                },
            ],
            "recommended_actions": [
                "主治医への報告・診察依頼",
                "バイタル・症状の頻回モニタリング",
                "服薬管理体制の見直し",
            ],
            "slack_message_ts": None,
            "acknowledged": False,
            "acknowledged_by": None,
            "acknowledged_at": None,
            "created_at": datetime.now() - timedelta(days=3),
        },
        {
            "severity": "HIGH",
            "pattern_type": "A-5",
            "pattern_name": "全軸複合",
            "message": """🚨 【全軸複合アラート】田中太郎様

Bio: SpO2 92%、発熱37.4℃、臥床傾向
Psycho: 意欲低下、認知変化の可能性
Social: 主介護者（妻）の体調不良

→ BPS全軸で悪化傾向。緊急度の高い多職種カンファレンス推奨。

📋 推奨アクション:
1. 緊急往診の検討
2. 多職種カンファレンス開催
3. 介護支援体制の緊急見直し""",
            "evidence": [
                {
                    "report_id": report_ids[3] if len(report_ids) > 3 else "",
                    "reporter_name": "看護師A",
                    "timestamp": datetime.now() - timedelta(days=1),
                    "summary": "SpO2 92%、発熱37.4℃、咳嗽悪化、食事摂取不良、訪看頻度増加検討",
                },
            ],
            "recommended_actions": [
                "緊急往診の検討",
                "多職種カンファレンス開催",
                "介護支援体制の緊急見直し",
            ],
            "slack_message_ts": None,
            "acknowledged": False,
            "acknowledged_by": None,
            "acknowledged_at": None,
            "created_at": datetime.now() - timedelta(days=1),
        },
    ]

    alerts_ref = db.collection("patients").document(patient_id).collection("alerts")
    for alert in alerts_data:
        alerts_ref.document().set(alert)


def seed_data(project_id: str, database_id: str = "(default)", dry_run: bool = False) -> None:
    """Seed demo data to Firestore."""
    print(f"Seeding demo data to project: {project_id}, database: {database_id}")

    if dry_run:
        print("DRY RUN - No data will be written")
        return

    db = firestore.Client(project=project_id, database=database_id)

    # 1. Create organization
    print("\n1. Creating organization...")
    org_ref = db.collection("organizations").document(DEMO_ORG_ID)
    org_ref.set({**DEMO_ORG, "created_at": firestore.SERVER_TIMESTAMP, "updated_at": firestore.SERVER_TIMESTAMP})

    # 2. Create facilities
    print("2. Creating facilities...")
    facility_names = []
    for facility in FACILITIES:
        doc_ref = org_ref.collection("facilities").document()
        doc_ref.set({**facility, "created_at": firestore.SERVER_TIMESTAMP})
        facility_names.append(facility["name"])

    # 3. Create areas
    print("3. Creating areas...")
    area_names = []
    for area in AREAS:
        doc_ref = org_ref.collection("areas").document()
        doc_ref.set({**area, "created_at": firestore.SERVER_TIMESTAMP})
        area_names.append(area["name"])

    # 4. Assign tags
    tag_assignments: dict[int, list[str]] = {i: [] for i in range(len(PATIENT_NAMES))}
    for tag, count in TAG_DISTRIBUTION.items():
        indices = random.sample(range(len(PATIENT_NAMES)), count)
        for idx in indices:
            if tag not in tag_assignments[idx]:
                tag_assignments[idx].append(tag)

    # 5. Create patients
    print("4. Creating patients...")
    random.shuffle(RISK_DISTRIBUTION)

    detailed_patient_id = None

    for i, (name, name_kana, age, sex) in enumerate(PATIENT_NAMES):
        risk_level = RISK_DISTRIBUTION[i]
        facility = facility_names[i % len(facility_names)]
        area = area_names[i % len(area_names)]
        tags = tag_assignments[i]

        patient_data = create_patient_data(
            i, name, name_kana, age, sex, risk_level, facility, area, tags
        )

        doc_ref = db.collection("patients").document()
        doc_ref.set(patient_data)

        # Track detailed patient (田中太郎)
        if name == "田中太郎":
            detailed_patient_id = doc_ref.id
            # Update risk level to HIGH for demo purposes
            doc_ref.update({"risk_level": "HIGH", "tags": ["要注意", "独居"]})

        print(f"  Created: {name} ({risk_level})")

    # 6. Create detailed data for 田中太郎
    if detailed_patient_id:
        print("\n5. Creating detailed data for 田中太郎...")
        report_ids = create_demo_reports(detailed_patient_id, db)
        print(f"  Created {len(report_ids)} reports")

        create_demo_context(detailed_patient_id, db)
        print("  Created context")

        create_demo_alerts(detailed_patient_id, report_ids, db)
        print("  Created 2 alerts")

    print("\n✅ Demo data seeding complete!")
    print(f"  Organization: {DEMO_ORG_ID}")
    print(f"  Patients: {len(PATIENT_NAMES)}")
    print(f"  Facilities: {len(FACILITIES)}")
    print(f"  Areas: {len(AREAS)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data for HomeCare AI Agent")
    parser.add_argument(
        "--project",
        "-p",
        default=os.environ.get("GOOGLE_CLOUD_PROJECT", "homecare-ai-dev"),
        help="GCP project ID",
    )
    parser.add_argument(
        "--database",
        "-d",
        default="(default)",
        help="Firestore database ID",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without making changes",
    )

    args = parser.parse_args()

    seed_data(args.project, args.database, args.dry_run)


if __name__ == "__main__":
    main()
