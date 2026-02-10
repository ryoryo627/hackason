#!/usr/bin/env python3
"""
Knowledge Base Seeding Script for HomeCare AI Agent.

Creates 5 demo knowledge documents with realistic Japanese medical content
in Firestore, generates text-embedding-005 embeddings for each chunk.

Collections used:
  - organizations/{org_id}/knowledge/{doc_id}       (document metadata)
  - organizations/{org_id}/knowledge/{doc_id}/chunks/{chunk_id}  (chunks + embeddings)

Usage:
  python scripts/seed_knowledge_data.py
  python scripts/seed_knowledge_data.py --org-id my-org-001
  python scripts/seed_knowledge_data.py --skip-embeddings
  python scripts/seed_knowledge_data.py --dry-run
"""

import argparse
import os
import sys
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from google.cloud import firestore

# Default organization
DEMO_ORG_ID = "demo-org-001"

# ============================================================================
# Document 1: BPSモデル基礎理論
# ============================================================================
DOC_BPS_MODEL = {
    "title": "BPSモデル基礎理論",
    "category": "bps",
    "source": "BPSモデル基礎理論 — 在宅医療への応用",
    "file_type": "markdown",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "chunks": [
        {
            "text": (
                "Bio-Psycho-Social（BPS）モデルは、1977年にGeorge L. Engelが提唱した統合的医療モデルである。"
                "従来の生物医学モデル（Biomedical Model）が疾患の生物学的側面のみに焦点を当てていたのに対し、"
                "BPSモデルは患者を生物学的（Bio）、心理学的（Psycho）、社会的（Social）の3軸から包括的に評価する。"
                "この枠組みにより、慢性疾患や高齢者の複合的な健康課題を多角的に理解し、"
                "患者中心のケアプランを策定することが可能となる。"
                "BPSモデルはWHOのICF（国際生活機能分類）とも整合性が高く、"
                "現代のリハビリテーション医学や在宅医療の基盤理論として広く採用されている。"
            ),
        },
        {
            "text": (
                "在宅医療におけるBPSモデルの適用は、病院医療とは異なる固有の意義を持つ。"
                "在宅では患者の生活環境を直接観察できるため、Social軸の評価が格段に精度を増す。"
                "例えば、住居のバリアフリー状況、家族の介護力、地域の支援ネットワークなど、"
                "病院では把握しにくい情報が自然に得られる。"
                "一方で、Bio軸のモニタリングは医療機器の制約から簡略化されることが多く、"
                "バイタルサインの変動トレンドや主観的症状の訴えを重視する必要がある。"
                "在宅医療チームはBPSの3軸を意識しながら、限られた訪問時間で効率的に情報を収集し、"
                "アセスメントを行うスキルが求められる。"
            ),
        },
        {
            "text": (
                "BPSアセスメントの方法論として、各軸に対応する標準的な評価項目がある。"
                "Bio軸ではバイタルサイン（SpO2、血圧、脈拍、体温、体重）、"
                "症状の有無と程度、服薬アドヒアランス、ADL（日常生活動作）を評価する。"
                "Psycho軸では気分・意欲の状態、認知機能（HDS-R、MMSEスコア）、"
                "睡眠の質、疼痛のVASスケール、不安や抑うつの傾向を評価する。"
                "Social軸では家族構成と介護力、経済状況、利用中の介護サービス、"
                "近隣との交流頻度、社会的孤立リスクを評価する。"
                "これらを統合的に記録し、3軸間の相互影響を分析することがBPSアセスメントの核心である。"
            ),
        },
        {
            "text": (
                "多職種連携におけるBPSモデルの活用は、在宅医療チームの共通言語として機能する。"
                "医師はBio軸を中心に診断・治療方針を示し、看護師はBio・Psycho軸の継続観察を担う。"
                "薬剤師はBio軸の服薬管理に加え、副作用によるPsycho軸への影響も評価する。"
                "ケアマネジャーはSocial軸のケアプランを主導し、リハビリ職はBio・Social軸の"
                "ADL改善と社会参加支援を担当する。"
                "BPSモデルを共通フレームワークとすることで、各職種が自身の専門領域を超えて"
                "患者の全体像を共有でき、情報の断片化を防ぐことができる。"
                "カンファレンスでもBPS3軸に沿った報告形式を統一することで、効率的な意思決定が実現する。"
            ),
        },
        {
            "text": (
                "患者中心のケア（Patient-Centered Care）はBPSモデルの実践的帰結である。"
                "BPSモデルに基づくケアでは、患者本人の価値観・希望・生活目標を最優先に据える。"
                "具体的には、Advance Care Planning（ACP）の場面でBio軸の予後予測だけでなく、"
                "Psycho軸の患者の心理的準備状態、Social軸の家族の受容度を統合的に考慮する。"
                "在宅看取りの意思決定においても、医学的適応だけでなく、"
                "患者が「自分らしく過ごしたい場所」という社会的・心理的ニーズを尊重する。"
                "BPSモデルは単なる評価ツールではなく、"
                "患者の尊厳と自律を守るための倫理的基盤としても機能する。"
            ),
        },
    ],
}

# ============================================================================
# Document 2: COPD診療ガイドライン抜粋
# ============================================================================
DOC_COPD_GUIDELINES = {
    "title": "COPD診療ガイドライン抜粋",
    "category": "guidelines",
    "source": "日本呼吸器学会 COPD診療ガイドライン 2022 準拠",
    "file_type": "markdown",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "chunks": [
        {
            "text": (
                "COPD患者の在宅モニタリングにおいて、SpO2は最も重要な指標の一つである。"
                "安静時SpO2が95%以上を正常範囲とし、93%以下は低酸素血症を示唆する。"
                "在宅酸素療法（HOT）導入基準はPaO2 55Torr以下またはSpO2 88%以下が持続する場合である。"
                "SpO2のトレンド評価では、1週間以内に3%以上の低下が認められた場合、"
                "急性増悪の前兆として警戒が必要である。"
                "労作時SpO2の測定も重要で、6分間歩行試験中に4%以上低下する場合は"
                "運動耐容能の低下を意味し、呼吸リハビリテーションの適応となる。"
                "パルスオキシメーターの精度は末梢循環不全やマニキュア装着で低下するため注意が必要である。"
            ),
        },
        {
            "text": (
                "COPD急性増悪の予防は在宅管理の最重要課題である。"
                "増悪の主要リスク因子は、過去1年間の増悪歴（2回以上）、FEV1 50%未満、"
                "喫煙の継続、ワクチン未接種（インフルエンザ・肺炎球菌）、"
                "合併症（心不全、糖尿病、GERD）の存在である。"
                "増悪の早期徴候として、呼吸困難の増強、痰量の増加、痰の膿性化の3主徴（Anthonisen基準）がある。"
                "在宅では患者・家族への自己管理教育（アクションプラン）が不可欠で、"
                "症状悪化時の段階的対応を事前に文書化しておく。"
                "冬季の感染予防（手洗い・マスク・加湿）と栄養管理（体重減少の防止）も増悪予防に寄与する。"
            ),
        },
        {
            "text": (
                "COPD薬物療法の基本は吸入気管支拡張薬であり、在宅での吸入手技の確認が重要となる。"
                "長時間作用性抗コリン薬（LAMA）は第一選択で、チオトロピウム等が使用される。"
                "中等度以上ではLAMA/LABA配合剤を用い、増悪頻回例にはICS/LABA/LAMAの三剤併用を検討する。"
                "在宅患者では吸入デバイスの選択が特に重要で、"
                "握力低下や認知機能低下がある場合はソフトミスト吸入器やネブライザーへの変更を考慮する。"
                "短時間作用性β2刺激薬（SABA）は発作時レスキューとして常備させ、"
                "週に2回以上の使用は治療ステップアップの目安となる。"
                "テオフィリン製剤は副作用リスクから高齢者では慎重投与とし、血中濃度モニタリングが推奨される。"
            ),
        },
        {
            "text": (
                "COPDのリスク層別化には、GOLD分類とmMRC呼吸困難スケール、CAT問診票を組み合わせる。"
                "GOLD A群（症状少・増悪リスク低）は必要時SABAのみ、"
                "GOLD B群（症状多・増悪リスク低）はLAMAまたはLABA開始、"
                "GOLD C群（症状少・増悪リスク高）はLAMA推奨、"
                "GOLD D群（症状多・増悪リスク高）はLAMA/LABA＋ICSを検討する。"
                "在宅患者のリスク層別化では、ADL低下、栄養状態（BMI 21未満）、"
                "うつ傾向（PHQ-9）、社会的孤立も加味した総合評価が重要である。"
                "BPSモデルと組み合わせることで、医学的重症度だけでなく生活全体のリスクを把握できる。"
            ),
        },
        {
            "text": (
                "在宅COPD管理における特有の留意点として、住環境の評価がある。"
                "室内の温度・湿度管理（冬季は室温20℃以上、湿度50-60%）、"
                "HOT機器の設置場所と酸素配管の安全確認、火気使用時の注意喚起が必要である。"
                "入浴は呼吸負荷が大きいため、シャワー浴への変更や入浴前の酸素吸入増量を指導する。"
                "食事は1回量を減らし5-6回の分食とし、高カロリー・高蛋白食を推奨する。"
                "呼吸リハビリとして口すぼめ呼吸、腹式呼吸の日常的実践を促す。"
                "緊急連絡体制の整備として、SpO2 90%以下持続・呼吸困難増強・意識レベル低下時の"
                "対応フローを患者宅に掲示し、家族にも周知する。"
            ),
        },
    ],
}

# ============================================================================
# Document 3: 在宅医療における服薬管理
# ============================================================================
DOC_MEDICATION = {
    "title": "在宅医療における服薬管理",
    "category": "medication",
    "source": "日本薬剤師会 在宅服薬管理ガイド",
    "file_type": "markdown",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "chunks": [
        {
            "text": (
                "在宅患者の服薬アドヒアランス評価は、残薬確認と患者・家族への聞き取りを基本とする。"
                "訪問薬剤管理指導では、持参薬・残薬のカウント、お薬カレンダーの確認、"
                "一包化薬の空き袋確認により客観的な服用率を算出する。"
                "服用率80%未満は「アドヒアランス不良」と判定し介入を検討する。"
                "評価ツールとしてMorisky Medication Adherence Scale（MMAS-8）の日本語版が利用可能であるが、"
                "認知機能低下のある患者には適用が難しい。"
                "アドヒアランス低下の要因は「飲み忘れ」「副作用の自覚」「効果実感の欠如」「服薬負担」"
                "の4つに大別され、要因別の介入戦略が必要である。"
                "介護者による管理が必要な場合は、介護者自身の負担度も評価に含める。"
            ),
        },
        {
            "text": (
                "高齢在宅患者のポリファーマシー（多剤併用）管理は薬剤師の重要な役割である。"
                "内服薬6剤以上をポリファーマシーと定義し、潜在的不適切処方（PIM）のスクリーニングを行う。"
                "日本老年医学会の「高齢者の安全な薬物療法ガイドライン2015」に準拠し、"
                "特に慎重な投与を要する薬物リスト（STOPP-J）を参照して処方適正化を提案する。"
                "在宅患者で特に問題となる薬剤は、ベンゾジアゼピン系（転倒リスク）、"
                "NSAIDs（腎機能障害・消化管出血）、抗コリン薬（認知機能低下・口渇・便秘）、"
                "糖尿病治療薬の過剰投与（低血糖リスク）である。"
                "処方医への疑義照会は具体的な代替案と根拠を添えて行い、"
                "減薬は1剤ずつ段階的に実施し、減薬後の症状変化を2週間以上観察する。"
            ),
        },
        {
            "text": (
                "薬物相互作用のモニタリングは在宅で複数の医療機関を受診する患者において特に重要である。"
                "在宅患者はかかりつけ医・専門医・歯科医から個別に処方を受けることがあり、"
                "処方情報の一元管理が困難になりやすい。"
                "薬剤師はお薬手帳の確認に加え、OTC薬・健康食品・サプリメントの使用状況も聴取する。"
                "特に注意すべき相互作用として、ワルファリンと納豆・クロレラ（ビタミンK拮抗）、"
                "カルシウム拮抗薬とグレープフルーツジュース（CYP3A4阻害）、"
                "抗てんかん薬と他剤（CYP誘導による効果減弱）がある。"
                "腎機能低下患者では腎排泄型薬剤の蓄積に注意し、"
                "eGFRに基づく用量調整を定期的に確認する。"
                "問題を検出した場合は速やかに処方医へフィードバックし、"
                "BPSレポートのBio軸に服薬関連情報として記録する。"
            ),
        },
    ],
}

# ============================================================================
# Document 4: 緩和ケアの基本原則
# ============================================================================
DOC_PALLIATIVE = {
    "title": "緩和ケアの基本原則",
    "category": "palliative",
    "source": "日本緩和医療学会ガイドライン準拠",
    "file_type": "markdown",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "chunks": [
        {
            "text": (
                "在宅緩和ケアにおける症状マネジメントは、疼痛・呼吸困難・悪心嘔吐・倦怠感が4大症状である。"
                "疼痛管理はWHO三段階鎮痛ラダーに準拠し、非オピオイド→弱オピオイド→強オピオイドへと段階的に移行する。"
                "在宅ではオピオイドの貼付剤（フェンタニルパッチ）が服薬管理の負担軽減に有効であるが、"
                "レスキュー薬として速放性オキシコドンまたはモルヒネ内用液を常備させる。"
                "呼吸困難に対してはモルヒネの少量投与（経口2.5-5mg/回）が有効で、"
                "酸素投与と併用する場合はSpO2のモニタリングを継続する。"
                "症状評価はNRS（Numerical Rating Scale）0-10を用い、"
                "患者の主観的評価を定時（朝・昼・夕・就寝前）に記録することが推奨される。"
                "BPSモデルのBio軸に症状スコアを経時的に記録し、トレンド分析に活用する。"
            ),
        },
        {
            "text": (
                "Advance Care Planning（ACP）は緩和ケアの中核プロセスであり、"
                "患者本人の意思を尊重した終末期ケアの実現に不可欠である。"
                "ACPでは「もしもの時」に備えて、希望する医療・ケアの内容、"
                "代理意思決定者の指定、療養場所の希望（自宅・施設・病院）を文書化する。"
                "ACPは一度きりの決定ではなく、病状の変化に応じて繰り返し更新する。"
                "在宅医療チームは定期的（3ヶ月ごとまたは病状変化時）にACPの見直しを提案する。"
                "Psycho軸の評価として、患者の病状認識と心理的準備状態を把握し、"
                "死への不安や抑うつ傾向がある場合は専門的心理支援を検討する。"
                "Social軸では家族の意向と患者の意向の乖離がないか確認し、"
                "乖離がある場合は家族ミーティングを通じて調整を図る。"
            ),
        },
        {
            "text": (
                "家族支援とグリーフケア（悲嘆ケア）は在宅緩和ケアの重要な構成要素である。"
                "主介護者の身体的・精神的負担は看取り期に急増するため、"
                "介護負担評価（Zarit介護負担尺度短縮版）を定期的に実施する。"
                "介護負担スコアが高い場合は、レスパイト入院の手配、"
                "訪問介護の増回、ボランティアの導入を検討する。"
                "予期悲嘆（Anticipatory Grief）への対応として、"
                "家族が患者の病状経過と予後について正しく理解できるよう説明を重ねる。"
                "死別後のグリーフケアは、四十九日前後と百日前後を目安に電話または訪問による"
                "フォローアップを行い、複雑性悲嘆（Complicated Grief）の兆候がある場合は"
                "専門カウンセリングへの紹介を検討する。"
                "BPSモデルのSocial軸に家族の状態も記録し、チーム全体で支援方針を共有する。"
            ),
        },
    ],
}

# ============================================================================
# Document 5: 院内フォールリスク評価プロトコル
# ============================================================================
DOC_FALL_RISK = {
    "title": "院内フォールリスク評価プロトコル",
    "category": "protocol",
    "source": "デモ在宅医療クリニック 転倒転落防止プロトコル",
    "file_type": "markdown",
    "chunk_size": 500,
    "chunk_overlap": 50,
    "chunks": [
        {
            "text": (
                "在宅患者の転倒リスク評価には、修正版転倒リスクスコアシート（Modified Fall Risk Assessment）を使用する。"
                "評価項目は次の8項目で構成される：(1)転倒歴（過去1年以内の転倒：2点）、"
                "(2)歩行補助具の使用（杖・歩行器：1点、車椅子：2点）、"
                "(3)IV/ヘパリンロック等の点滴ルート（該当：1点）、"
                "(4)歩行・移乗能力（ふらつきあり：2点、介助必要：3点）、"
                "(5)認知機能（見当識障害あり：2点）、"
                "(6)排泄パターン（頻尿・切迫感あり：1点）、"
                "(7)服用薬剤（転倒リスク薬3剤以上：2点）、"
                "(8)環境要因（段差・滑りやすい床：1点）。"
                "合計5点以上を「高リスク」、3-4点を「中リスク」、0-2点を「低リスク」と判定する。"
            ),
        },
        {
            "text": (
                "転倒リスク「高」と判定された在宅患者に対する介入プロトコルは以下の通りである。"
                "住環境整備：手すり設置（トイレ・浴室・廊下）、段差解消（スロープ・踏み台）、"
                "照明改善（夜間フットライト設置）、滑り止めマット配置を訪問リハビリ職と連携して実施する。"
                "運動プログラム：下肢筋力強化（椅子からの立ち座り10回x3セット/日）、"
                "バランス訓練（片脚立ち・タンデム立位）、歩行訓練を理学療法士が指導する。"
                "薬剤レビュー：転倒リスク増加薬剤（睡眠薬・抗不安薬・降圧薬・利尿薬）の"
                "減量・中止を処方医と協議する。"
                "モニタリング：月1回の再評価を実施し、リスクスコアの変動をBPSレポートのBio軸に記録する。"
                "転倒発生時は直ちに外傷の有無を確認し、受傷時はX線検査のための受診を手配する。"
            ),
        },
        {
            "text": (
                "転倒発生後のインシデント対応フローを以下に示す。"
                "第一報：発見者（家族・訪問スタッフ）が主治医または訪問看護ステーションへ電話連絡する。"
                "報告内容は「いつ・どこで・どのように転倒したか」「意識レベル」「外傷の有無」「現在の状態」を含む。"
                "初期対応：頭部打撲がある場合は24時間の経過観察を指示し、"
                "嘔吐・意識変容・瞳孔不同が出現した場合は救急搬送する。"
                "四肢の変形・腫脹・強い疼痛がある場合は骨折を疑い、安静保持のうえ整形外科受診を手配する。"
                "記録：転倒インシデントレポートを作成し、BPSレポートのBio軸に記載する。"
                "再発防止策として、転倒状況の分析に基づきリスクスコアを再評価し、"
                "環境調整・運動プログラム・薬剤見直しの追加介入を検討する。"
                "転倒が反復する場合は多職種カンファレンスを開催し、包括的な再評価を行う。"
            ),
        },
    ],
}

# All documents
KNOWLEDGE_DOCUMENTS = [
    DOC_BPS_MODEL,
    DOC_COPD_GUIDELINES,
    DOC_MEDICATION,
    DOC_PALLIATIVE,
    DOC_FALL_RISK,
]


def generate_embeddings(
    texts: list[str],
    api_key: str,
) -> list[list[float]]:
    """Generate embeddings using google-genai text-embedding-005."""
    from google import genai

    client = genai.Client(api_key=api_key)
    result = client.models.embed_content(
        model="text-embedding-005",
        contents=texts,
    )
    return [e.values for e in result.embeddings]


def get_gemini_api_key(db: firestore.Client, org_id: str) -> str | None:
    """Retrieve Gemini API key from Firestore service_configs."""
    doc = db.collection("service_configs").document(f"{org_id}_gemini").get()
    if doc.exists:
        data = doc.to_dict()
        return data.get("api_key")
    return None


def seed_knowledge(
    project_id: str,
    org_id: str,
    skip_embeddings: bool = False,
    dry_run: bool = False,
) -> None:
    """Seed knowledge documents with chunks and embeddings to Firestore."""
    print(f"Seeding knowledge data to project: {project_id}, org: {org_id}")
    print(f"  skip_embeddings: {skip_embeddings}")
    print(f"  dry_run: {dry_run}")
    print()

    total_docs = len(KNOWLEDGE_DOCUMENTS)
    total_chunks = sum(len(doc["chunks"]) for doc in KNOWLEDGE_DOCUMENTS)

    if dry_run:
        print("--- DRY RUN ---")
        for doc_def in KNOWLEDGE_DOCUMENTS:
            chunk_count = len(doc_def["chunks"])
            total_tokens = sum(len(c["text"]) // 2 for c in doc_def["chunks"])
            print(f"  Document: {doc_def['title']}")
            print(f"    category: {doc_def['category']}, chunks: {chunk_count}, tokens: ~{total_tokens}")
            for i, chunk in enumerate(doc_def["chunks"]):
                print(f"    chunk_{i:04d}: {len(chunk['text'])} chars, ~{len(chunk['text']) // 2} tokens")
                print(f"      preview: {chunk['text'][:60]}...")
        print()
        print(f"Would create {total_docs} documents with {total_chunks} total chunks.")
        return

    db = firestore.Client(project=project_id)

    # Get API key for embeddings
    api_key = None
    if not skip_embeddings:
        api_key = get_gemini_api_key(db, org_id)
        if not api_key:
            print("[WARN] Gemini API key not found in service_configs. Falling back to --skip-embeddings mode.")
            skip_embeddings = True
        else:
            print("Gemini API key loaded from service_configs.")

    knowledge_col = db.collection("organizations").document(org_id).collection("knowledge")

    created_docs = 0
    created_chunks = 0

    for doc_idx, doc_def in enumerate(KNOWLEDGE_DOCUMENTS, start=1):
        title = doc_def["title"]
        category = doc_def["category"]
        source = doc_def["source"]
        chunks = doc_def["chunks"]
        chunk_count = len(chunks)

        # Calculate token counts
        chunk_token_counts = [len(c["text"]) // 2 for c in chunks]
        total_tokens = sum(chunk_token_counts)

        print(f"[{doc_idx}/{total_docs}] Creating document: {title} ({category}, {chunk_count} chunks)")

        # Create document metadata
        doc_ref = knowledge_col.document()
        doc_id = doc_ref.id

        doc_data = {
            "org_id": org_id,
            "title": title,
            "category": category,
            "source": source,
            "file_type": doc_def["file_type"],
            "chunk_size": doc_def["chunk_size"],
            "chunk_overlap": doc_def["chunk_overlap"],
            "status": "indexed",
            "total_chunks": chunk_count,
            "total_tokens": total_tokens,
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
        doc_ref.set(doc_data)
        created_docs += 1

        # Generate embeddings for all chunks in this document
        chunk_texts = [c["text"] for c in chunks]
        embeddings: list[list[float]] = []

        if not skip_embeddings and api_key:
            try:
                print(f"  Generating embeddings for {chunk_count} chunks...")
                embeddings = generate_embeddings(chunk_texts, api_key)
                print(f"  Embeddings generated (dim={len(embeddings[0]) if embeddings else 0})")
            except Exception as e:
                print(f"  [ERROR] Embedding generation failed: {e}")
                print(f"  Storing empty embeddings for this document.")
                embeddings = [[] for _ in chunks]
        else:
            embeddings = [[] for _ in chunks]

        # Create chunk subcollection using batch writes
        chunks_col = doc_ref.collection("chunks")
        batch = db.batch()
        batch_count = 0

        for i, chunk in enumerate(chunks):
            chunk_ref = chunks_col.document(f"chunk_{i:04d}")
            chunk_data = {
                "chunk_index": i,
                "text": chunk["text"],
                "token_count": chunk_token_counts[i],
                "embedding": embeddings[i] if i < len(embeddings) else [],
                "category": category,
                "source": title,
                "org_id": org_id,
                "doc_id": doc_id,
            }
            batch.set(chunk_ref, chunk_data)
            batch_count += 1
            created_chunks += 1

            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0

        if batch_count > 0:
            batch.commit()

        print(f"  Created: doc_id={doc_id}, {chunk_count} chunks, ~{total_tokens} tokens")

    print()
    print("=" * 60)
    print("Knowledge data seeding complete!")
    print(f"  Organization:  {org_id}")
    print(f"  Documents:     {created_docs}")
    print(f"  Total chunks:  {created_chunks}")
    print(f"  Embeddings:    {'generated' if not skip_embeddings else 'skipped'}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed demo knowledge documents for HomeCare AI Agent"
    )
    parser.add_argument(
        "--org-id",
        default=DEMO_ORG_ID,
        help=f"Organization ID (default: {DEMO_ORG_ID})",
    )
    parser.add_argument(
        "--project",
        "-p",
        default=os.environ.get("GOOGLE_CLOUD_PROJECT", "aihomecare-486506"),
        help="GCP project ID (default: aihomecare-486506)",
    )
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Skip embedding generation (stores empty arrays)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be created without writing to Firestore",
    )

    args = parser.parse_args()

    seed_knowledge(
        project_id=args.project,
        org_id=args.org_id,
        skip_embeddings=args.skip_embeddings,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
