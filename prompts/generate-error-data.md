# エラー英語動画コンテンツ生成プロンプト

あなたはプログラミング初心者向けの教育コンテンツクリエイターです。
プログラミングのエラーメッセージに登場する英単語を、面白く、記憶に残る形で解説する動画シリーズの台本を作成してください。

## 出力形式

以下のJSON形式で、エラーメッセージに関連する英単語の解説データを生成してください：

```json
{
    "targetWord": "英単語（例：Fatal）",
    "errorMessage": "実際のエラーメッセージ例（例：FATAL ERROR: System Halted）",
    "messageTranslation": "エラーメッセージの日本語訳",
    "generalMeaning": "一般的な英単語の意味（辞書的な説明）",
    "generalExample": "一般的な使用例（日本語訳付き）",
    "techMeaning": "プログラミング文脈での意味（親しみやすく、ユーモアを交えた表現で）",
    "explanation": "補足説明（初心者が理解しやすい、面白い例えや実践的なアドバイス）",
    "usageContext": "日常生活での使用シーン（プログラミングと関連付けた面白い状況）",
    "usageExample": "日常会話での使用例（英語）",
    "usageExampleTranslation": "使用例の日本語訳",
    "usagePunchline": "オチ・ツッコミ（HTTPステータスコードなどIT用語を使った面白い返し）",
    "usagePunchlineTranslation": "オチの日本語訳"
}
```

## コンテンツ作成のガイドライン

### 1. ターゲット英単語の選定
- プログラミングのエラーメッセージによく登場する英単語
- 初心者がつまずきやすい、意味が分かりにくい単語
- 例：Fatal, Deprecated, Syntax, Undefined, Null, Exception, Parse, Timeout, など

### 2. techMeaning（技術的な意味）の書き方
- 堅苦しくなく、親しみやすい口調で
- プログラムを擬人化したり、日常的な例えを使う
- 例：「プログラムが即死して、もう息をしていない状態」

### 3. explanation（補足説明）の書き方
- 初心者が「あるある」と共感できる内容
- 実践的なアドバイスや対処法を含める
- ユーモアを交えつつ、学びになる内容に
- 例：「再起不能。保存してないデータは諦めよう。」

### 4. usageContext（日常での使用シーン）
- プログラミングと日常生活を関連付ける
- 親しみやすく、面白いシチュエーション
- 例：「遅刻確定の時」

### 5. usagePunchline（オチ）
- IT用語（HTTPステータスコード、エラーメッセージなど）を使った面白い返し
- 元の英単語の意味と関連付ける
- 例：「Boss: 403 Forbidden（上司：許さん）」

## 生成例

参考として、「Fatal」の完成例：

```json
{
    "targetWord": "Fatal",
    "errorMessage": "FATAL ERROR: System Halted",
    "messageTranslation": "致命的なエラー：システムが停止しました",
    "generalMeaning": "【形】致命的な、命に関わる",
    "generalExample": "A fatal accident (死亡事故)",
    "techMeaning": "プログラムが即死して、もう息をしていない状態",
    "explanation": "再起不能。保存してないデータは諦めよう。",
    "usageContext": "遅刻確定の時",
    "usageExample": "I made a fatal mistake...",
    "usageExampleTranslation": "致命的なミスをしちゃった…",
    "usagePunchline": "Boss: 403 Forbidden",
    "usagePunchlineTranslation": "上司：許さん（アクセス拒否）"
}
```

## タスク

上記のガイドラインに従って、新しいエラー英単語の解説データを**5個**生成してください。
各単語は異なるエラータイプをカバーし、バラエティに富んだ内容にしてください。

JSONの配列形式で出力してください：
```json
[
    { ... },
    { ... },
    ...
]
```
