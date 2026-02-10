#!/usr/bin/env python3
"""
Dummy Report Posting Script for HomeCare AI Agent.

Posts realistic dummy reports to patient Slack channels as thread replies
to anchor messages, triggering the Intake Agent BPS structuring pipeline.

Usage:
  python scripts/post_dummy_reports.py                    # 全患者に1件ずつ
  python scripts/post_dummy_reports.py --count 3          # 全患者に3件ずつ
  python scripts/post_dummy_reports.py --patients 2       # 先頭2名のみ
  python scripts/post_dummy_reports.py --delay 5          # 投稿間隔5秒
  python scripts/post_dummy_reports.py --dry-run          # 実行せず確認のみ
"""

import argparse
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from google.cloud import firestore
from slack_sdk import WebClient

# Realistic dummy reports from various healthcare professionals
DUMMY_REPORTS = [
    # Nurse reports (Bio-heavy)
    {
        "role": "看護師",
        "text": "本日訪問。バイタル: BP 148/86, HR 82, SpO2 95%, BT 36.4℃。"
        "食事は昼食を半分程度摂取。水分は500ml程度。排便2日なし。"
        "下肢の浮腫は軽度持続。服薬は自己管理できている。",
    },
    {
        "role": "看護師",
        "text": "訪問時、咳嗽と痰の訴えあり。SpO2 93%とやや低下。"
        "体温37.2℃の微熱。食欲低下が3日続いている。"
        "表情がやや暗く、「最近元気が出ない」とのこと。"
        "夜間の睡眠も浅いとの訴え。主治医に報告予定。",
    },
    {
        "role": "看護師",
        "text": "定期訪問。全身状態は安定。BP 132/78, SpO2 97%。"
        "リハビリの自主トレーニングを継続しており、歩行も安定している。"
        "笑顔も見られ、精神的にも落ち着いている様子。"
        "ご家族も「最近調子が良い」と話されていた。",
    },
    {
        "role": "看護師",
        "text": "入浴介助にて訪問。皮膚の状態を確認。"
        "仙骨部に発赤あり（NPUAP分類 Stage I）。"
        "体位変換の指導を本人・ご家族に実施。"
        "除圧マットの導入を検討。ケアマネに連絡する。",
    },
    # Pharmacist reports (Medication-focused)
    {
        "role": "薬剤師",
        "text": "服薬指導訪問。残薬確認したところ、アムロジピン5mgが5日分余っている。"
        "飲み忘れが週2-3回ある模様。一包化の提案を行い、了承いただいた。"
        "次回から一包化で調剤する。副作用の訴えなし。",
    },
    {
        "role": "薬剤師",
        "text": "臨時訪問。新規処方のワーファリン開始にあたり服薬指導実施。"
        "納豆・クロレラなどビタミンK含有食品の制限について説明。"
        "お薬手帳に記載。ご家族にも説明。"
        "次回PT-INR確認予定と伝達。",
    },
    {
        "role": "薬剤師",
        "text": "定期訪問。血糖降下薬の服用タイミングを確認。"
        "食前30分の服用が守れていない日がある。"
        "食直前でも可の薬剤に変更できないか主治医に提案予定。"
        "低血糖症状の説明と対処法を再指導。",
    },
    # Care worker / helper reports (ADL + Social)
    {
        "role": "介護士",
        "text": "生活援助にて訪問。掃除と買い物代行。"
        "冷蔵庫の中がほとんど空だった。スーパーで1週間分の食材を購入。"
        "ご本人は「一人だと買い物に行くのが億劫」とのこと。"
        "近隣との交流も減っている様子。孤立傾向が気になる。",
    },
    {
        "role": "介護士",
        "text": "身体介護訪問。排泄介助・着替え介助。"
        "トイレまでの移動は手すりを使って自力で可能だが、"
        "立ち上がりに時間がかかるようになった。"
        "「最近足に力が入りにくい」との訴え。リハビリ職に情報共有したい。",
    },
    # Rehab therapist reports (Functional)
    {
        "role": "理学療法士",
        "text": "訪問リハビリ実施。TUG 18秒→15秒に改善。"
        "屋内歩行は安定しているが、段差昇降にまだ不安あり。"
        "下肢筋力トレーニング（スクワット10回×3セット）継続。"
        "バランス運動を追加。次回、屋外歩行を評価予定。",
    },
    {
        "role": "作業療法士",
        "text": "訪問リハビリ。上肢機能訓練と自助具の使用訓練。"
        "箸の使用は改善傾向。ボタン掛けはまだ時間がかかる。"
        "台所での簡単な調理動作を練習。卵焼きを一人で完成。"
        "ご本人のモチベーションも高く、意欲的にリハビリに取り組んでいる。",
    },
    # Doctor reports (Assessment)
    {
        "role": "医師",
        "text": "定期往診。聴診上、両側下肺野に湿性ラ音聴取。"
        "SpO2 94%。心不全の増悪を疑う。利尿剤の増量を指示。"
        "体重が前回より1.5kg増加。塩分制限と水分制限の再指導。"
        "次回1週間後に再評価。悪化時は連絡するよう指示。",
    },
    {
        "role": "医師",
        "text": "臨時往診。腹痛・嘔吐の訴え。腹部は軟、圧痛は上腹部に限局。"
        "バイタル安定。便秘が5日続いている。浣腸実施し排便あり。"
        "腹痛は軽減。嘔吐の原因は便秘と判断。"
        "酸化マグネシウムを処方。水分摂取の励行を指示。",
    },
    # Social worker / care manager reports (Social-heavy)
    {
        "role": "ケアマネ",
        "text": "担当者会議実施。訪問看護の頻度を週2回→3回に変更。"
        "デイサービス利用日を火・木に変更。"
        "主介護者の娘さんが仕事の都合で月水金の日中不在になるため。"
        "ショートステイの利用も月1回検討。介護負担軽減が急務。",
    },
    {
        "role": "ケアマネ",
        "text": "モニタリング訪問。現在のサービス利用状況を確認。"
        "ご本人は「デイサービスが楽しい」と話している。"
        "ただし自宅での転倒が先月2回あったとのこと。"
        "住宅改修（手すり設置）の申請を進める。福祉用具の見直しも検討。",
    },
]


def get_eligible_patients(db: firestore.Client, org_id: str | None, limit: int | None):
    """Get patients that have both slack_channel_id and anchor_message_ts."""
    query = db.collection("patients").where("status", "==", "active")
    if org_id:
        query = query.where("org_id", "==", org_id)

    patients = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        if data.get("slack_channel_id") and data.get("anchor_message_ts"):
            patients.append(data)

    if limit:
        patients = patients[:limit]

    return patients


def post_report(client: WebClient, channel_id: str, anchor_ts: str, report: dict) -> bool:
    """Post a single report as a thread reply to the anchor message."""
    text = f"[{report['role']}] {report['text']}"
    try:
        response = client.chat_postMessage(
            channel=channel_id,
            thread_ts=anchor_ts,
            text=text,
            metadata={
                "event_type": "dummy_report",
                "event_payload": {"source": "post_dummy_reports"},
            },
        )
        return response["ok"]
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Post dummy reports to patient Slack channels"
    )
    parser.add_argument(
        "--project", "-p",
        default=os.environ.get("GOOGLE_CLOUD_PROJECT", "aihomecare-486506"),
        help="GCP project ID",
    )
    parser.add_argument(
        "--org-id",
        default=None,
        help="Organization ID filter (auto-detect if not specified)",
    )
    parser.add_argument(
        "--patients", "-n",
        type=int,
        default=None,
        help="Number of patients to send to (default: all eligible)",
    )
    parser.add_argument(
        "--count", "-c",
        type=int,
        default=1,
        help="Number of reports per patient (default: 1)",
    )
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=3,
        help="Delay between posts in seconds (default: 3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be posted without actually posting",
    )

    args = parser.parse_args()

    db = firestore.Client(project=args.project)

    # Auto-detect org_id from service_configs if not specified
    org_id = args.org_id
    if not org_id:
        configs = list(db.collection("service_configs").limit(1).stream())
        if configs:
            config_data = configs[0].to_dict()
            org_id = config_data.get("org_id")
            print(f"Auto-detected org_id: {org_id}")

    # Get Slack token
    token = None
    if not args.dry_run:
        if org_id:
            config_doc = db.collection("service_configs").document(f"{org_id}_slack").get()
            if config_doc.exists:
                token = config_doc.to_dict().get("slack_bot_token")
        if not token:
            # Try to find any slack config
            for doc in db.collection("service_configs").stream():
                data = doc.to_dict()
                if data.get("slack_bot_token"):
                    token = data["slack_bot_token"]
                    break
        if not token:
            print("ERROR: Slack Bot Token not found in service_configs")
            sys.exit(1)

    # Get eligible patients
    patients = get_eligible_patients(db, org_id, args.patients)
    if not patients:
        print("No eligible patients found (need slack_channel_id + anchor_message_ts)")
        sys.exit(1)

    print(f"\nTarget patients: {len(patients)}")
    print(f"Reports per patient: {args.count}")
    print(f"Total reports to post: {len(patients) * args.count}")
    print(f"Delay between posts: {args.delay}s")
    print(f"Estimated time: {len(patients) * args.count * args.delay:.0f}s")
    print()

    if args.dry_run:
        print("=== DRY RUN ===\n")

    client = WebClient(token=token) if token else None
    posted = 0
    errors = 0

    for patient in patients:
        name = patient.get("name", "不明")
        channel_id = patient["slack_channel_id"]
        anchor_ts = patient["anchor_message_ts"]
        channel_name = patient.get("slack_channel_name", channel_id)

        reports = random.sample(DUMMY_REPORTS, min(args.count, len(DUMMY_REPORTS)))

        for i, report in enumerate(reports):
            if posted > 0 and not args.dry_run:
                time.sleep(args.delay)

            prefix = f"[{posted + 1}/{len(patients) * args.count}]"

            if args.dry_run:
                print(f"{prefix} {name} (#{channel_name})")
                print(f"     [{report['role']}] {report['text'][:60]}...")
                print()
            else:
                print(f"{prefix} {name} (#{channel_name}) <- [{report['role']}]...", end=" ")
                ok = post_report(client, channel_id, anchor_ts, report)
                if ok:
                    print("OK")
                    posted += 1
                else:
                    print("FAILED")
                    errors += 1

    print(f"\nDone! Posted: {posted}, Errors: {errors}")


if __name__ == "__main__":
    main()
