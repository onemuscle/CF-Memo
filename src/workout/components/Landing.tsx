import { useMemo, useState } from 'react'
import { generateWorkout, type Answers, type Env, type HistoryEntry } from '../engine'
import { CONDITION_LABEL, ENV_LABEL, GOAL_LABEL, LEVEL_LABEL, musclesText } from '../engine/labels'
import type { Current } from '../storage'
import { thisWeekCount, weekStreak } from '../stats'
import { CalendarIcon, FlameIcon, PlayIcon } from './Icons'
import { progressOf } from './Result'

interface Props {
  last: Answers | null
  current: Current | null
  history: HistoryEntry[]
  goal: number
  onStart: () => void
  onQuick: (a: Answers) => void
  onResume: () => void
  onHistory: () => void
}

const BASE = { level: 'intermediate', condition: 'normal', injuries: [], scale: 'men', gear: [], quiet: false } as const

const SAMPLES: Record<Env, { answers: Answers; seed: number; note?: string }> = {
  gym: { answers: { ...BASE, env: 'gym', goal: 'lean', focus: ['glutes', 'back'], minutes: 45, injuries: [], gear: [] }, seed: 20261006 },
  box: { answers: { ...BASE, env: 'box', goal: 'athletic', focus: [], minutes: 60, injuries: [], gear: [] }, seed: 777 },
  home: {
    answers: { ...BASE, env: 'home', goal: 'lean', focus: [], minutes: 30, injuries: [], gear: ['band'], quiet: true },
    seed: 3030,
    note: 'チューブあり・静かに',
  },
  outdoor: {
    answers: { ...BASE, env: 'outdoor', goal: 'stamina', focus: [], minutes: 45, injuries: [], gear: ['bar', 'bench', 'stairs'] },
    seed: 4545,
    note: '鉄棒・ベンチ・坂道あり',
  },
}

export const FAQ = [
  {
    q: '本当に無料ですか? 会員登録は必要?',
    a: '完全無料・登録不要です。回答や記録はあなたの端末のブラウザ内にだけ保存され、サーバーには送信されません。',
  },
  {
    q: 'どうやってメニューを決めているの?',
    a: '目的ごとの回数・セット・休憩の設計 (筋肥大なら8〜15回で余力1〜2回など)、部位ごとの種目の優先順、1回あたりの適正なセット数の上限、体調・痛み・前回のきつさによる調整を組み合わせ、選んだ時間に収まるように組み立てています。',
  },
  {
    q: 'ウォームアップやストレッチも入っていますか?',
    a: 'はい。毎回、その日に使う部位に合わせたウォームアップ (4分) とクールダウンのストレッチ (2分)、計6分が最初と最後に入ります。選んだ時間にはこの6分も含まれます。',
  },
  {
    q: '自宅や公園でも使えますか?',
    a: 'はい。自宅なら手持ちの道具 (なし / ダンベル / チューブ / 椅子 / 懸垂バーなど) と「ジャンプや足音を控えたいか」を、野外なら鉄棒・ベンチ・坂道などの有無を聞いて、その場でできる種目だけで組みます。道具がなくても、回数とテンポで負荷をかける自重メニューになります。',
  },
  {
    q: 'CrossFit の WOD にも対応していますか?',
    a: 'はい。ストレングス → WOD → 補強のクラス形式で組み、AMRAP / EMOM / For Time / インターバルなどを目的と時間から選びます。各種目には Rx・Scaled・初心者の3段階を載せ、あなたに合う設定に★を付けます。',
  },
  {
    q: '毎回同じメニューになりませんか?',
    a: '直近1週間にやった種目は選ばれにくくなり、「おまかせ」を選ぶと最近鍛えていない部位を優先します。気に入らなければ「別のメニュー」や種目ごとの入れ替えもできます。',
  },
  {
    q: 'ケガや痛みがある場合は?',
    a: '腰・ひざ・肩・手首に不安がある場合は、負担が大きい種目を自動で外します。ただし医療的な判断の代わりにはなりません。痛みがある場合は医師・専門家に相談してください。',
  },
]

export default function Landing({ last, current, history, goal, onStart, onQuick, onResume, onHistory }: Props) {
  const [sampleEnv, setSampleEnv] = useState<Env>('gym')
  const sampleDef = SAMPLES[sampleEnv]
  const sampleA = sampleDef.answers
  const sample = useMemo(() => generateWorkout(sampleDef.answers, sampleDef.seed), [sampleDef])
  const week = thisWeekCount(history)
  const streak = weekStreak(history, goal)
  const resumable = current && current.startedAt && Date.now() - current.startedAt < 1000 * 60 * 60 * 12
  const prog = current ? progressOf(current.workout, current.done) : undefined

  return (
    <div className="landing">
      <header className="nav">
        <span className="brand">
          KYO<span>TORE</span>
          <small>きょうトレ</small>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onHistory}>
          <CalendarIcon size={16} /> 記録
        </button>
      </header>

      <section className="hero">
        <p className="hero-eyebrow">ジム / CrossFit / 自宅 / 野外 対応・無料</p>
        <h1 className="hero-h1">
          今日やるべきメニューが、
          <br />
          <em>30秒</em>でわかる。
        </h1>
        <p className="hero-lead">
          目的・鍛えたい部位・使える時間・今日の体調に答えるだけ。トレーナーの考え方で、ウォームアップからストレッチまで
          <strong>時間ぴったり</strong>のメニューを組み立てます。
        </p>
        <button className="btn btn-primary btn-xl" onClick={onStart}>
          今日のメニューを作る <span aria-hidden>→</span>
        </button>
        <p className="hero-micro">登録不要 · タップだけ · 約30秒</p>
      </section>

      {(resumable || last || history.length > 0) && (
        <section className="returning">
          {history.length > 0 && (
            <div className="returning-stats">
              <span>
                今週 <strong>{week}</strong>/{goal}回
              </span>
              <span className="streak">
                <FlameIcon size={16} /> <strong>{streak}</strong>週連続
              </span>
              <span>
                累計 <strong>{history.length}</strong>回
              </span>
            </div>
          )}
          {resumable && current && (
            <button className="resume-card" onClick={onResume}>
              <span className="resume-kicker">続きから再開</span>
              <span className="resume-title">{current.workout.title}</span>
              {prog && prog.total > 0 && (
                <span className="resume-meta">
                  {prog.finished}/{prog.total} セット完了
                </span>
              )}
              <PlayIcon size={22} />
            </button>
          )}
          {last && (
            <div className="quick-card">
              <div>
                <div className="quick-kicker">前回と同じ条件で作る</div>
                <div className="quick-chips">
                  {ENV_LABEL[last.env]} · {GOAL_LABEL[last.goal]} · {last.focus.length ? musclesText(last.focus) : 'おまかせ'} · {last.minutes}分 ·{' '}
                  {LEVEL_LABEL[last.level]}
                </div>
              </div>
              <div className="quick-actions">
                <button className="btn btn-primary btn-sm" onClick={() => onQuick({ ...last, condition: 'normal' })}>
                  {CONDITION_LABEL.normal}で作る
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onQuick({ ...last, condition: 'tired' })}>
                  疲れ気味で作る
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="section">
        <h2 className="section-title">
          <span>HOW IT WORKS</span>3ステップで今日のメニュー
        </h2>
        <ol className="steps">
          <li>
            <b>1</b>
            <div>
              <strong>かんたんな質問に答える</strong>
              <p>場所 (ジム・CrossFit・自宅・野外)、なりたい姿、部位、時間、レベル、体調、痛み。すべてタップだけ。</p>
            </div>
          </li>
          <li>
            <b>2</b>
            <div>
              <strong>あなた専用のメニューが完成</strong>
              <p>種目・セット・回数・休憩・重量の目安まで。なぜこのメニューなのか、トレーナーの解説付き。</p>
            </div>
          </li>
          <li>
            <b>3</b>
            <div>
              <strong>タイマーを使ってそのまま実行</strong>
              <p>休憩タイマー・AMRAP / EMOM タイマー内蔵。終わったら記録して、次回はさらに最適化。</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="section">
        <h2 className="section-title">
          <span>SAMPLE</span>こんなメニューが出てきます
        </h2>
        <div className="seg" role="tablist">
          {(['gym', 'box', 'home', 'outdoor'] as Env[]).map(e => (
            <button key={e} role="tab" aria-selected={sampleEnv === e} className={sampleEnv === e ? 'on' : ''} onClick={() => setSampleEnv(e)}>
              {ENV_LABEL[e]}
            </button>
          ))}
        </div>
        <div className={`sample env-${sampleEnv}`}>
          <div className="sample-cond">
            条件: {GOAL_LABEL[sampleA.goal]} · {sampleA.focus.length ? musclesText(sampleA.focus) : 'おまかせ'} · {sampleA.minutes}分 ·{' '}
            {LEVEL_LABEL[sampleA.level]}
            {sampleDef.note && ` · ${sampleDef.note}`}
          </div>
          <div className="sample-title">{sample.title}</div>
          <div className="sample-sub">{sample.subtitle}</div>
          {sample.blocks.map(b => (
            <div key={b.key} className="sample-block">
              <div className="sample-block-head">
                <span>{b.label}</span>
                <span>{b.minutes}分</span>
              </div>
              <div className="sample-items">
                {b.items.slice(0, b.kind === 'warmup' || b.kind === 'cooldown' ? 2 : 4).map((it, i) => (
                  <div key={i}>
                    <span>{it.name}</span>
                    <span>{it.prescription}</span>
                  </div>
                ))}
                {b.items.length > (b.kind === 'warmup' || b.kind === 'cooldown' ? 2 : 4) && <div className="sample-more">…ほか</div>}
              </div>
            </div>
          ))}
          <div className="sample-why">
            <b>トレーナーの解説</b>
            {sample.why[sample.why.length - 1]}
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          <span>FEATURES</span>続けられる理由
        </h2>
        <div className="features">
          {FEATURES.map(f => (
            <div key={f.title} className="feature">
              <div className="feature-icon" aria-hidden>
                {f.icon}
              </div>
              <strong>{f.title}</strong>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          <span>LOGIC</span>メニューを組み立てるルール
        </h2>
        <div className="logic">
          {LOGIC.map(l => (
            <details key={l.title}>
              <summary>{l.title}</summary>
              <p>{l.body}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          <span>FAQ</span>よくある質問
        </h2>
        <div className="logic">
          {FAQ.map(f => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-final">
        <h2>迷う時間を、鍛える時間に。</h2>
        <p>ジムに着いてから「今日なにやろう」で10分使っていませんか?</p>
        <button className="btn btn-primary btn-xl" onClick={onStart}>
          無料で今日のメニューを作る
        </button>
      </section>

      <footer className="footer">
        <p>© きょうトレ (KYOTORE)</p>
        <p>
          本サービスのメニューは一般的なトレーニング理論に基づく目安であり、医療上の助言ではありません。体調・痛みに不安がある場合は医師・専門家に相談してください。
        </p>
        <p>回答・記録はすべて端末内に保存され、外部には送信されません。</p>
      </footer>
    </div>
  )
}

const FEATURES = [
  { icon: '⏱', title: '時間ぴったり設計', body: '20〜90分の中で、ウォームアップとストレッチ (6分) を含めて収まるよう、種目数とセット数を自動で調整。足りない日はスーパーセットに。' },
  { icon: '🩺', title: '体調と痛みに合わせる', body: '疲れ気味の日は量と強度を下げ、腰・ひざ・肩・手首に不安があれば負担の大きい種目を外します。' },
  { icon: '🔁', title: '前回から自動で最適化', body: '最近鍛えた部位・やった種目・前回の「きつさ」を覚えて、次のメニューに反映。おまかせなら部位ローテーションも自動。' },
  { icon: '🔥', title: 'CrossFit の WOD も', body: 'AMRAP・EMOM・For Time・インターバル・タバタ。Rx / Scaled / 初心者の3段階と目標ラウンド数・ペース配分付き。' },
  { icon: '📣', title: 'タイマー内蔵', body: 'セット間の休憩タイマー、WODタイマー、ガイド付きウォームアップ。カウントダウン音と画面スリープ防止つき。' },
  { icon: '📈', title: '記録と週間目標', body: '完了を記録すると、週の目標達成・連続記録・部位バランスが見える。記録は画像にしてシェアもできます。' },
]

const LOGIC = [
  { title: '目的ごとに回数・休憩を変える', body: '筋力は低回数 (3〜6回) と長い休憩、筋肥大は8〜15回で余力1〜2回、引き締めは休憩の短いスーパーセットとフィニッシャー、スタミナはサーキットとインターバル。' },
  { title: '大きな種目から順番に', body: 'パワー種目 → 多関節種目 (スクワット・プレス・ロウなど) → 単関節種目 → 体幹の順。疲れる前に重いものを扱うのが、効果とケガ予防の両方に効きます。' },
  { title: '1部位のセット数に上限', body: '1回のトレーニングで1部位にかけるセット数はレベルに応じて上限を設定。時間が余っても無理に詰め込まず、回復を助ける有酸素に回します。' },
  { title: '余力 (RIR) で重量を決める', body: '「あと何回できるか」で重量を選ぶので、1RMを知らなくてもOK。バーベル種目は1RMを入れるとkgで目安を表示します。' },
  { title: '漸進性過負荷 (ダブルプログレッション)', body: '全セットで回数の上限をこなせたら次回は重量を1段階上げる。シンプルで確実に伸びる進め方を毎回提案します。' },
]
