// トレーニングの「なぜ」と技術的な詳細。
// planData.ts がスプレッドシート由来の「何をやるか」なのに対し、
// こちらは設計思想・技術ポイント・判断基準といった解説をまとめている。

import type { SessionKind } from './planData'

export interface GuideSection {
  title: string
  /** 段落 */
  body?: string[]
  /** 箇条書き */
  bullets?: string[]
  /** ラベル + 内容の対 */
  pairs?: { label: string; detail: string }[]
}

export interface SessionGuide {
  /** カードに常時出す1〜2行の狙い */
  aim: string
  /** 「詳しい解説」を開いたときの中身 */
  sections: GuideSection[]
}

// ---------------------------------------------------------------- 用語集

export interface Term {
  term: string
  ja: string
  /** true ならカード内のタイトルに自動で訳を添える */
  inline?: boolean
}

/** 表記ゆれを避けるため、planData の文字列と同じ大文字小文字で書くこと */
export const GLOSSARY: Term[] = [
  { term: 'Threshold', ja: '閾値走。きついが「あと1本ならできる」ペース', inline: true },
  { term: 'Jog', ja: 'つなぎのジョグ', inline: true },
  { term: 'Easy', ja: 'イージーラン。会話できる楽なペース', inline: true },
  { term: 'Stride', ja: '流し。15秒ほどの軽い加速走', inline: true },
  { term: 'Burpee', ja: 'バーピー', inline: true },
  { term: 'EMOM', ja: '毎分00秒に開始し、決めた回数をこなして残りは休む (Every Minute On the Minute)', inline: true },
  { term: 'Bodymake', ja: '見た目を作る補助トレ', inline: true },
  { term: 'Mobility', ja: 'モビリティ。可動域を整える動き', inline: true },
  { term: 'TT', ja: 'タイムトライアル。全力での計測', inline: true },
  { term: 'Benchmark', ja: '基準テスト。進捗を測る回', inline: true },
  { term: 'Deload', ja: '負荷を落として回復させる週', inline: true },
  { term: 'R:', ja: 'ラウンド (round)', inline: true },
  { term: 'Zone2', ja: '会話できる強度の低強度有酸素', inline: true },
  { term: 'RIR', ja: 'あと何回できる余力を残すか。RIR1-3 なら限界の1〜3回手前で止める' },
  { term: 'RPE', ja: '主観的なきつさ。10段階で表す' },
  { term: 'WOD', ja: 'その日のトレーニング内容 (Workout of the Day)' },
  { term: 'Cycle time', ja: '1repあたりにかかる時間' },
  { term: 'Running economy', ja: 'ランニングエコノミー。同じ速度をより少ないエネルギーで走る力' },
  { term: 'V taper', ja: '肩が広くウエストが細い逆三角形の体型' },
  { term: 'HSPU', ja: '逆立ち腕立て (Handstand Push-up)' },
  { term: 'C&J', ja: 'クリーン＆ジャーク' },
  { term: 'Snatch', ja: 'スナッチ' },
  { term: 'OHS', ja: 'オーバーヘッドスクワット' },
  { term: 'Ring Muscle-up', ja: 'リングマッスルアップ' },
  { term: 'Pull-up', ja: '懸垂' },
  { term: 'Thruster', ja: 'スラスター。フロントスクワットから頭上へ押し上げる動き' },
  { term: 'Wall Ball', ja: 'ウォールボール。ボールを的へ投げ上げる動き' },
  { term: 'Barbell cycling', ja: 'バーベルを止めずに連続で挙げ続ける技術' },
]

/** 文中に出てくる英語のうち、訳を添えるものを拾う */
export function glossFor(text: string): Term[] {
  return GLOSSARY.filter(t => t.inline && text.includes(t.term))
}

/** 種目名の日本語。planData の name をキーにする */
export const EXERCISE_JA: Record<string, string> = {
  'Cable Lateral Raise': 'ケーブル・ラテラルレイズ (ケーブルで腕を横に上げる)',
  'Machine Lateral Raise': 'マシン・ラテラルレイズ (マシンで腕を横に上げる)',
  'Overhead Cable Triceps Ext.': 'オーバーヘッド・トライセプス・エクステンション (頭上から三頭を伸ばす)',
  'Rope Pushdown': 'ロープ・プッシュダウン (ロープを押し下げる)',
  'Cable Crunch': 'ケーブル・クランチ (ケーブル負荷の腹筋)',
  'Lat Pulldown': 'ラット・プルダウン (広背筋の引き下ろし)',
  'Chest Supported Row': 'チェスト・サポーテッド・ロウ (胸当て付きのローイング)',
  'Incline DB Curl': 'インクライン・ダンベルカール (傾斜ベンチでの腕曲げ)',
  'Hammer Curl': 'ハンマーカール (ダンベルを縦に持つ腕曲げ)',
  'Lateral Raise': 'ラテラルレイズ (腕を横に上げる)',
  'Hanging Leg Raise': 'ハンギング・レッグレイズ (ぶら下がって脚を上げる)',
  'Ab Wheel（任意）': 'アブローラー (腹筋ローラー)',
  'Ab Wheel': 'アブローラー (腹筋ローラー)',
  'Incline Machine Press': 'インクライン・マシンプレス (傾斜をつけたマシンで押す)',
  'Preacher Curl': 'プリーチャーカール (台に肘を乗せた腕曲げ)',
  'Overhead Triceps Ext.': 'オーバーヘッド・トライセプス・エクステンション (頭上から三頭を伸ばす)',
  'DB Lateral Raise': 'ダンベル・ラテラルレイズ (ダンベルで腕を横に上げる)',
  'Seated DB Lateral Raise': 'シーテッド・ラテラルレイズ (ベンチに座って腕を横に上げる)',
  'DB Overhead Triceps Ext.': 'ダンベル・オーバーヘッド・エクステンション (頭上から三頭を伸ばす)',
  'Bench Dips': 'ベンチディップス (ベンチに手をついて体を沈める)',
  'Weighted Ball Crunch': 'ウェイテッド・ボールクランチ (バランスボール上で重りを抱えた腹筋)',
  'One-arm DB Row': 'ワンハンド・ダンベルロウ (片手ずつのローイング)',
  'Chest Supported DB Row': 'チェストサポーテッド・ダンベルロウ (ベンチにうつ伏せのローイング)',
  'Lying Leg Raise': 'ライイング・レッグレイズ (仰向けで脚を上げる)',
  'Ball Rollout（任意）': 'ボール・ロールアウト (バランスボール版の腹筋ローラー)',
  'Ball Rollout': 'ボール・ロールアウト (バランスボール版の腹筋ローラー)',
  'Incline DB Press': 'インクライン・ダンベルプレス (傾斜ベンチでダンベルを押す)',
  'Concentration Curl': 'コンセントレーション・カール (肘を膝の内側に固定した腕曲げ)',
  'Easy Run': 'イージーラン (会話できる楽なペースの走り込み)',
  Stride: 'ストライド (15秒ほどの流し)',
  'Burpee EMOM': 'バーピー EMOM (毎分開始で決めた回数)',
  'Threshold / 400m+Burpee': '閾値走 / 400m＋バーピー',
}

/** 種目の「目的」欄に英語が入っているものだけ差し替える */
export const AIM_JA: Record<string, string> = {
  'Running economy': 'ランニングエコノミー (同じ速度をより楽に走る力)',
  'V taper/広背筋': '逆三角形の体型 / 広背筋',
}

// ---------------------------------------------------------------- 曜日別ガイド

export const SESSION_GUIDE: Record<SessionKind, SessionGuide> = {
  shoulder: {
    aim: '肩幅と腕の太さを作る日。腹筋は「燃やす」のではなく、重量を伸ばして厚みを出す。',
    sections: [
      {
        title: 'この日の考え方',
        body: [
          '全種目 RIR 1〜3（限界の1〜3回手前で止める）。40〜45分で終える。',
          '腹筋は胸や腕と同じように扱う。回数を追わず、重量を伸ばして肥大させる。',
        ],
      },
      {
        title: 'Cable Crunch のログの付け方',
        bullets: ['45kg × 12', '50kg × 12', '55kg × 10'],
        body: ['12回が揃ったら重量を上げる。腰が痛むフォームになるならそこで中止する。'],
      },
    ],
  },

  back: {
    aim: '背中の厚みと広がり、二頭、腹筋。40〜50分で終える。',
    sections: [
      {
        title: 'なぜベントオーバーロウを使わないか',
        body: [
          'Chest Supported Row（胸当て付きローイング）を選ぶのは、CrossFitとランをやっている状態で腰とハムストリングスを余計に疲れさせないため。',
          'Ab Wheel は余裕があればでよい。腰が反るなら中止する。',
        ],
      },
    ],
  },

  optional: {
    aim: 'ボーナス扱い。CrossFit後に「まだかなり元気」なときだけ、30〜35分で終える。',
    sections: [
      {
        title: '削る判断',
        body: [
          '朝のWODが HSPU / Ring Muscle-up / Pull-up / Bench / Burpee / 大量の Snatch・C&J など上半身を強く使う内容だった日は、補助トレを削る。',
          '土日の両方でCrossFitに行く週は、この土曜のボディメイクを削除する。',
        ],
      },
    ],
  },

  easyrun: {
    aim: 'ランニング能力を作る重要日。速く走る日ではなく、「楽に走れる速度」を上げるのが目的。',
    sections: [
      {
        title: 'Easy Run の強度',
        body: [
          'RPE 3〜4/10。普通に短い会話ができるくらい。ゼーハーする日ではない。',
          '最初の2週間は30〜35分。慣れたら35〜45分まで伸ばす。',
          'CrossFitで心肺の刺激を受けていても、走力にはラン特有の経済性と動作への適応がある。走ること自体に意味がある。',
        ],
      },
      {
        title: 'Stride（流し）',
        body: [
          'Easy Run のあとに15秒の Stride を4〜6本。間は60〜90秒ゆっくり歩くかジョグ。',
          '全力スプリントではなく、80〜90%くらいの気持ちよい速さ。',
        ],
      },
      {
        title: 'バーピーは技術練習であって心肺トレではない',
        body: [
          '毎回10分間、死ぬほどバーピーをする必要はない。最初は6分EMOMで毎分4〜6回、合計24〜36repだけ。',
          '毎分、最低でも20〜30秒は余る回数にすること。',
        ],
      },
      {
        title: '1repごとに見るポイント',
        bullets: [
          '胸と腰をほぼ同時に床へ',
          '腕だけでプッシュアップしない',
          '足を手の近くまで一気に戻す',
          '立ち上がるための深いスクワットを作らない',
          '不要に高くジャンプしない',
          '1repごとに息を止めない',
          '全repで同じテンポ',
        ],
      },
    ],
  },

  quality: {
    aim: '追加トレの中で最も重要な日。翌日の金曜が完全休養なので、高強度を置くならここ。',
    sections: [
      {
        title: '隔週で内容が入れ替わる',
        body: [
          '木曜は「閾値走」と「CrossFit特異的ラン＋Burpee」を隔週で交互に行う。追加のHIITを毎週何種類もやる必要はない。',
          'W1〜W2は導入期なので閾値走が続き、W3以降が交互になる。その週の具体的な内容は上の週メニューを見る。',
        ],
      },
      {
        title: 'A週: 閾値走 (Threshold)',
        body: [
          'ウォームアップ10分のあと、8分ラン×3本。間に2分の Easy Jog。',
          '強度は RPE 7程度。「きつい。でもあと1セットならできる」くらい。',
          '1本目から全力で走らない。3本ともほぼ同じ速度にする。',
        ],
      },
      {
        title: 'B週: 400m＋Burpee',
        body: [
          '5ラウンド。400m Run ＋ 8 Burpees ＋ 90秒休憩。400mは全力ではない。',
          '目標は、最速と最遅の400mの差を5秒以内にすること。',
        ],
        pairs: [
          { label: '成功例', detail: '1:42 / 1:44 / 1:44 / 1:46 / 1:45' },
          { label: '失敗例', detail: '1:30 / 1:39 / 1:51 / 2:03 / 2:08 — 単に1本目が速すぎる' },
        ],
      },
      {
        title: 'なぜこれをやるか',
        body: [
          'この能力が Barbell → Run、Burpee → Run、OHS → Run というCrossFitの組み合わせで効いてくる。',
        ],
      },
    ],
  },

  restday: {
    aim: '完全レスト。ここを守るから木曜の質を上げられる。',
    sections: [
      {
        title: 'やらないこと',
        body: [
          'トレーニングなし。散歩、軽いモビリティ、風呂まで。',
          '「木曜頑張ったし金曜も軽く腕だけ……」はやらない。',
        ],
      },
    ],
  },

  weekend: {
    aim: '固定しない日。休養、または30〜45分の非常に軽い Zone2 が第一選択。',
    sections: [
      {
        title: 'CrossFitをやりたい週',
        body: [
          'やってよい。ただしその場合、日曜に追加のラン・バーピー・筋肥大はしない。',
        ],
      },
      {
        title: '土日の両方でCrossFitをやる週',
        body: [
          '土曜のボディメイク補助を削除する。さらに日曜のCrossFitがハードだったら、月曜夜の筋肥大を半分にするか休む。',
          '「土日両方行ったから今週はトレーニング量が増える」ではなく、別のトレーニングと交換すると考える。ここがかなり重要。',
        ],
      },
    ],
  },

  review: {
    aim: '12週の結果を確認し、次の12週を組み直す日。',
    sections: [
      {
        title: '見るもの',
        body: ['体重(7日平均)・腹囲・同条件の写真・WOD出力・Run/Burpeeの失速を並べて確認する。'],
      },
    ],
  },
}

// ---------------------------------------------------------------- 全体の解説

export const PHILOSOPHY: GuideSection = {
  title: '基本思想',
  body: [
    'CrossFitを主競技とし、ランは週2回、バーピーは「高強度を増やす」のではなく技術練習、ボディメイクは週2回＋余裕があれば1回とする。',
    '追加の「キツい心肺」は木曜の1回だけ。CrossFit自体がHIIT的な高強度刺激を大量に含むので、ランまで週3回インターバルにする必要はない。',
    '朝CrossFitと夜トレが10時間前後離れるのは悪くない。持久系と筋力系を同日に組む場合も、セッションを離すことで干渉を抑えやすいことが研究されている。ただし最終的には総負荷が問題になる。',
    '通常週はCrossFit 5回を基本にする。土日の両方でCrossFitをやるのは「できる週だけ」にしたほうが、複数の目標を同時に追うこの設計には合う。',
  ],
}

export const ROLES: GuideSection = {
  title: '各トレーニングの役割',
  pairs: [
    { label: 'CrossFit', detail: '競技能力' },
    { label: 'Easy Run', detail: 'ランニングエコノミー' },
    { label: '木曜のRun', detail: 'ランのパフォーマンス' },
    { label: 'Burpee EMOM', detail: '動作効率' },
    { label: '月水土の補助', detail: '見た目' },
    { label: '食事', detail: '体脂肪を落としつつ全部を回復させる' },
  ],
}

export const LOAD_BALANCE: GuideSection = {
  title: 'オーバーワークにしないための総量',
  body: [
    'CrossFit週5〜6 ＋ 筋肥大週3 ＋ ラン週2〜3 ＋ バーピー週2 を全部そのまま高強度でやると多すぎる。',
    '特に今は脂肪も落としたい＝エネルギー収支をマイナスにするので、回復余力は増えない。エネルギー不足が大きすぎるとトレーニング適応やパフォーマンスにも悪影響が出得るため、競技を強くしながらの減量では赤字を小さく保つことが重要になる。',
  ],
  pairs: [
    { label: '高強度', detail: 'CrossFit 5回 ＋ 木曜夜 1回' },
    { label: '低強度', detail: 'Easy Run 1回' },
    { label: '筋肥大', detail: '2回必須 ＋ 1回任意' },
    { label: 'Burpee', detail: '技術練習1回 ＋ 隔週コンディショニング' },
  ],
}

export const SKIP_RULE: GuideSection = {
  title: '夜トレを中止する判断',
  body: [
    'CrossFitは内容が毎日変わるので、曜日だけでは完全には管理できない。朝のWODが次のどれかに当たり、かつ自分のRPEが9〜10だった日は、その夜に予定していたラン・バーピーを削除する。',
  ],
  pairs: [
    { label: '大量のラン', detail: '2km以上など' },
    { label: '大量バーピー', detail: '40〜50rep以上' },
    { label: '大量のスクワット系', detail: 'Wall Ball、Thruster、Lunge など' },
    { label: '高ボリュームのOlympic lifting', detail: 'Squat Snatch / Clean' },
  ],
}

export const SKIP_RULE_NOTE: GuideSection = {
  title: '筋肥大の扱い',
  body: [
    '疲れている部位と被らなければ少量はできる。',
    '「予定を守る」ことより、刺激を重複させない判断のほうがCrossFitでは重要になる。',
  ],
}

export const WHY_HARD: GuideSection = {
  title: 'Snatch → Burpee がキツい理由',
  body: [
    '必ずしも「心肺が弱い」という意味ではない。',
    'スクワットスナッチで脚・臀部・体幹・肩の固定をかなり使った直後に、バーピーで同じく脚・体幹・肩を使って87〜88kgの身体を何度も床から起こしている。局所疲労と呼吸が一気に重なっている。',
    'だから対策は「もっと地獄のWODを追加する」ではなく、ランの経済性とバーピーの1repあたりのコストを下げる方向になる。',
  ],
}

export const BURPEE_PACING: GuideSection = {
  title: 'バーピーのペース配分',
  body: [
    'バーベルを置いた瞬間からバーピーを全開にすると、3rep・5rep・10repくらいまでは速いが、その後に一気に失速することが多い。',
  ],
  bullets: [
    'バーベルを置く',
    '大きく1呼吸',
    '最初の3repを意図的に90%程度で入る',
    'そこから一定テンポ',
  ],
  pairs: [
    { label: '避けたい配分', detail: '15秒 → 20秒 → 30秒（5repずつ）' },
    { label: '目指す配分', detail: '19秒 → 20秒 → 21秒' },
  ],
}

export const BURPEE_PACING_NOTE = 'バーピーは「最高速度」ではなく、失速しない cycle time（1repあたりの時間）を作る。'

export const METRICS: GuideSection = {
  title: '体重以外で追う4指標',
  body: ['体重だけを見ると判断を誤る。毎週この4つを並べて見る。'],
  bullets: [
    '7日平均体重',
    'へそ周りの腹囲',
    '同じ照明・同じ時間の正面/横写真',
    'CrossFitのパフォーマンス',
  ],
  pairs: [
    { label: 'ラン', detail: '400/500mの反復タイムの落ち幅を見る' },
    { label: 'Burpee', detail: '10rep → 休憩 → 10rep の各セットタイムを見る。1セット目が速いことではなく、5セット目まで落ちないことを作る' },
  ],
}

export const WEIGHT_RULE: GuideSection = {
  title: '減量ペースと測り方',
  body: [
    '狙うのは週 −0.2〜0.4kg程度。',
    '毎朝、起床 → トイレ → 飲食前 の順で測る。毎日の上下は無視して7日平均だけを見る。',
  ],
  pairs: [
    { label: '2週間動かない', detail: '88.3 → 88.2 → 88.3 のように変わらなければ −150〜200kcal/日' },
    { label: '落ちすぎ', detail: '1週間で 88.3 → 87.3 のように急落し、WODも弱くなったなら食べなさすぎ' },
  ],
}

export const MEAL_GUIDE: GuideSection[] = [
  {
    title: '夕食を2分割する',
    body: [
      '夜ジムへ行く日は、17:30〜18:00 を「夕食①」、Jexerの風呂のあと 20:30〜21:00 を「夕食②」にする。',
      '夜トレ後まで全部のカロリーを我慢して、21時に1,200kcalを一度に食べる形は避ける。',
      '夕食①を入れておくことで、夜ジムの出力が落ちにくく、Jexerを出るまで空腹で苦しくならない。',
    ],
  },
  {
    title: '夕食②の考え方',
    body: [
      '寝るまでが近いので「減量だから炭水化物抜き」ではなく、胃に残りにくいものを食べる。',
      '昼と夕方にエネルギーを多めに入れておけば、21時の食事を必要以上に大きくせずに済む。',
    ],
    bullets: ['避けるもの: 揚げ物 / 脂の多い焼肉 / 大量のナッツ / 大量の生野菜 / 巨大なラーメン'],
  },
  {
    title: 'トレ後のプロテイン',
    body: [
      '夕食がすぐ食べられるなら、トレーニング終了直後に慌ててプロテインを飲む必要はない。',
      'トレ終了から帰宅・夕食まで90分以上かかるようなら、ホエイ20〜30g＋バナナ等を持っておくと便利。',
    ],
  },
  {
    title: '米を削りすぎない',
    body: [
      'CrossFitは糖質への依存度が高い運動で、CrossFitを対象とした研究でも炭水化物摂取がパフォーマンスに影響し得ることが示されている。',
      'だから「腹を割る＝米を削りまくる」にはしない。',
    ],
  },
  {
    title: '22:00就寝はトレーニングのために削らない',
    body: [
      '夜ジムが押して「あと3セットやれば完璧だけど寝るのが22:40」となるなら、3セットを捨てる。',
      '今の運動量なら、追加セットより睡眠を守るほうを優先する。',
    ],
  },
]

export const TARGET_PHYSIQUE: GuideSection = {
  title: '最終的に目指す身体と能力',
  body: [
    'これは「CrossFitが強い人が、さらに運動量を増やして痩せる」プログラムではない。狙っているのは次のタイプ。',
  ],
  bullets: [
    'Snatch / C&J は強い',
    'Barbell cycling もできる',
    '500m Run で置いていかれない',
    'Burpee で失速しない',
    '肩と腕は太い',
    '腹直筋そのものが厚い',
    'ウエストだけ絞れている',
  ],
}

export const WEEK_SHAPE: GuideSection = {
  title: '1週間の組み立て',
  pairs: [
    { label: '月', detail: '朝 CrossFit / 夜 肩・三頭・腹（中）' },
    { label: '火', detail: '朝 CrossFit / 夜 Easy Run＋短いバーピー練習（低）' },
    { label: '水', detail: '朝 CrossFit / 夜 背中・二頭・腹（中）' },
    { label: '木', detail: '朝 CrossFit / 夜 ラン強化メイン（高）' },
    { label: '金', detail: '完全レスト（休）' },
    { label: '土', detail: '朝 CrossFit / 夜 上半身ボディメイク ※任意（中）' },
    { label: '日', detail: '休養 / Zone2 / CrossFit。原則追加なし（低〜中）' },
  ],
}
