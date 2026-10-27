import { useEffect, useMemo, useRef, useState } from 'react'
import { dowOf, formatMD, shiftDate, todayISO } from '../../plan/plan'
import type { Env, Gear } from '../../workout/engine'
import { ENV_LABEL, GEAR_LABEL, GOAL_LABEL, INJURY_LABEL, LEVEL_LABEL } from '../../workout/engine/labels'
import { BackIcon, ChevronIcon } from '../../components/Icons'
import {
  ACTIVITY_LABEL,
  CARDIO_LABEL,
  DEFAULT_DAYS,
  DOW_LABEL,
  SEX_LABEL,
  TRAIN_TIME_LABEL,
  WEEK_ORDER,
  bmi,
  daysText,
  weightDirection,
  type Profile,
} from '../profile'
import { weeklyRate, weeksToTarget } from '../plan/nutrition'
import { THEMES, applyTheme, savedTheme, type Theme } from '../theme'

type Draft = Partial<Profile>

interface Option {
  value: string
  label: string
  desc?: string
  emoji?: string
  /** 選ぶと他の選択を外す (なし) */
  exclusive?: boolean
}

type ChoiceKey = 'goal' | 'sex' | 'level' | 'quiet' | 'minutes' | 'trainTime' | 'cardio' | 'activity' | 'meals' | 'weeks' | 'startDate'
type MultiKey = 'injuries' | 'places' | 'gear'

type Kind =
  | { type: 'choice'; key: ChoiceKey; options: (d: Draft, initial?: Profile) => Option[]; grid?: boolean }
  | { type: 'multi'; key: MultiKey; options: (d: Draft) => Option[]; required?: boolean }
  | { type: 'theme' | 'name' | 'body' | 'target' | 'days' | 'confirm' }

interface Step {
  id: string
  section: string
  title: (d: Draft) => string
  sub?: (d: Draft) => string
  kind: Kind
  when?: (d: Draft) => boolean
  /** 確認画面の行 */
  row?: { label: string; value: (d: Draft) => string }
}

// ---------------------------------------------------------------- 質問

const NUMBER_KEYS: ChoiceKey[] = ['minutes', 'meals', 'weeks']

function startOptions(initial?: Profile): Option[] {
  const today = todayISO()
  const tomorrow = shiftDate(today, 1)
  const toMonday = ((8 - new Date().getDay()) % 7) || 7
  const monday = shiftDate(today, toMonday)
  const fmt = (iso: string) => `${formatMD(iso)} (${dowOf(iso)})`
  const list: Option[] = []
  if (initial && initial.startDate !== today) {
    list.push({ value: initial.startDate, label: 'いまのプランの開始日のまま', desc: `${fmt(initial.startDate)} から。進み具合はそのまま`, emoji: '📌' })
  }
  list.push(
    { value: today, label: '今日から', desc: fmt(today), emoji: '⚡' },
    { value: tomorrow, label: '明日から', desc: fmt(tomorrow), emoji: '🌙' },
  )
  if (monday !== tomorrow) list.push({ value: monday, label: '次の月曜から', desc: `${fmt(monday)} · 週の区切りがわかりやすい`, emoji: '📅' })
  return list
}

const STEPS: Step[] = [
  {
    id: 'theme',
    section: 'はじめに',
    title: () => '好きな色を選んでください',
    sub: () => 'タップするとすぐに切り替わります。あとからいつでも変えられます',
    kind: { type: 'theme' },
    row: { label: 'アプリの色', value: d => THEMES.find(t => t.key === d.theme)?.label ?? '' },
  },
  {
    id: 'name',
    section: 'はじめに',
    title: () => 'なんて呼べばいいですか?',
    sub: () => 'ニックネームでOK。空欄のままでも進めます',
    kind: { type: 'name' },
    row: { label: '呼び名', value: d => d.name || '(なし)' },
  },
  {
    id: 'goal',
    section: '目標',
    title: d => `${d.name ? `${d.name}さんが` : ''}いちばん叶えたいことは?`,
    sub: () => 'プラン全体の方向性と、食事の目安が決まります',
    kind: {
      type: 'choice',
      key: 'goal',
      options: () => [
        { value: 'lean', label: GOAL_LABEL.lean, desc: '脂肪を落としてシャープに。食事は少しだけ控えめに', emoji: '🔥' },
        { value: 'muscle', label: GOAL_LABEL.muscle, desc: '見た目が変わる筋肥大。食事は少しだけ多めに', emoji: '💪' },
        { value: 'strength', label: GOAL_LABEL.strength, desc: '扱える重量を伸ばす', emoji: '🏋️' },
        { value: 'stamina', label: GOAL_LABEL.stamina, desc: '心肺機能と持久力を上げる', emoji: '🫁' },
        { value: 'athletic', label: GOAL_LABEL.athletic, desc: 'スポーツに活きるパワーと敏捷性', emoji: '⚡' },
        { value: 'health', label: GOAL_LABEL.health, desc: '無理なく続けて体調と姿勢を整える', emoji: '🌿' },
      ],
    },
    row: { label: '目的', value: d => (d.goal ? GOAL_LABEL[d.goal] : '') },
  },
  {
    id: 'sex',
    section: 'からだ',
    title: () => '性別を教えてください',
    sub: () => '消費カロリーの計算と、CrossFit の重量の基準に使います',
    kind: {
      type: 'choice',
      key: 'sex',
      options: () => [
        { value: 'male', label: '男性', emoji: '🙋‍♂️' },
        { value: 'female', label: '女性', emoji: '🙋‍♀️' },
        { value: 'other', label: '回答しない', desc: 'カロリーは男女の中間で計算します', emoji: '🙂' },
      ],
    },
  },
  {
    id: 'body',
    section: 'からだ',
    title: () => '年齢・身長・体重は?',
    sub: () => '1日に必要なカロリーの計算に使います。データはこの端末の中にだけ保存されます',
    kind: { type: 'body' },
    row: {
      label: 'からだ',
      value: d => `${d.sex ? SEX_LABEL[d.sex] : ''} / ${d.age}歳 / ${d.height}cm / ${d.weight}kg`,
    },
  },
  {
    id: 'level',
    section: 'からだ',
    title: () => 'トレーニングの経験は?',
    sub: () => 'セット数・休憩・種目の難しさを合わせます',
    kind: {
      type: 'choice',
      key: 'level',
      options: () => [
        { value: 'beginner', label: LEVEL_LABEL.beginner, desc: '始めたばかり・久しぶり。フォームから丁寧に', emoji: '🌱' },
        { value: 'intermediate', label: LEVEL_LABEL.intermediate, desc: '半年以上続けていて、基本の種目のフォームは身についている', emoji: '🔥' },
        { value: 'advanced', label: LEVEL_LABEL.advanced, desc: '2年以上。重量や記録を計画的に伸ばしている', emoji: '🏆' },
      ],
    },
    row: { label: '経験', value: d => (d.level ? LEVEL_LABEL[d.level] : '') },
  },
  {
    id: 'target',
    section: 'からだ',
    title: d => (weightDirection(d.goal!) === 'down' ? '目標体重はありますか?' : '増やしたい体重の目安は?'),
    sub: () => '無理のないペースから、到達までの目安を出します',
    kind: { type: 'target' },
    when: d => !!d.goal && weightDirection(d.goal) !== null,
    row: { label: '目標体重', value: d => (d.targetWeight !== undefined ? `${d.targetWeight}kg` : 'なし (ペースだけ守る)') },
  },
  {
    id: 'injuries',
    section: 'からだ',
    title: () => '痛みや不安がある部位は?',
    sub: () => '負担の大きい種目を外して組みます。複数選択OK',
    kind: {
      type: 'multi',
      key: 'injuries',
      options: () => [
        { value: 'none', label: 'とくになし', emoji: '👍', exclusive: true },
        { value: 'lowback', label: INJURY_LABEL.lowback },
        { value: 'knee', label: INJURY_LABEL.knee },
        { value: 'shoulder', label: INJURY_LABEL.shoulder },
        { value: 'wrist', label: INJURY_LABEL.wrist },
      ],
    },
    row: { label: '痛み・不安', value: d => (d.injuries?.length ? d.injuries.map(i => INJURY_LABEL[i]).join('・') : 'なし') },
  },
  {
    id: 'places',
    section: '環境',
    title: () => 'どこでトレーニングしますか?',
    sub: () => '複数選択OK。組み合わせて週の予定を作ります',
    kind: {
      type: 'multi',
      key: 'places',
      required: true,
      options: () => [
        { value: 'gym', label: '施設型ジム', desc: '24時間ジム・フィットネスクラブ。マシンやダンベルが使える', emoji: '🏋️' },
        { value: 'box', label: 'CrossFit', desc: 'ボックスで WOD。クラスに出る日もここに入ります', emoji: '🔥' },
        { value: 'home', label: '自宅', desc: '道具なしでもOK', emoji: '🏠' },
        { value: 'outdoor', label: '野外', desc: '公園・河川敷。ランや鉄棒も', emoji: '🌳' },
      ],
    },
    row: { label: '場所', value: d => (d.places ?? []).map(e => ENV_LABEL[e]).join('・') },
  },
  {
    id: 'gear',
    section: '環境',
    title: () => '自宅・野外で使える道具は?',
    sub: () => 'あるものに合わせて種目を選びます。複数選択OK',
    when: d => !!d.places?.some(e => e === 'home' || e === 'outdoor'),
    kind: {
      type: 'multi',
      key: 'gear',
      options: d => [
        { value: 'none', label: 'なにもない', desc: '自重だけで組みます', emoji: '🙌', exclusive: true },
        { value: 'dumbbell', label: GEAR_LABEL.dumbbell, desc: '可変式もOK' },
        { value: 'band', label: GEAR_LABEL.band, desc: 'トレーニング用ゴムバンド' },
        { value: 'kettlebell', label: GEAR_LABEL.kettlebell },
        { value: 'bench', label: GEAR_LABEL.bench, desc: '動かない丈夫なもの' },
        { value: 'bar', label: GEAR_LABEL.bar, desc: 'ドア枠・公園の鉄棒' },
        ...(d.places?.includes('outdoor') ? [{ value: 'stairs', label: GEAR_LABEL.stairs, desc: '野外で使える' }] : []),
      ],
    },
    row: { label: '道具', value: d => (d.gear?.length ? d.gear.map(g => GEAR_LABEL[g]).join('・') : 'なし') },
  },
  {
    id: 'quiet',
    section: '環境',
    title: () => '自宅でジャンプや足音は大丈夫?',
    sub: () => '集合住宅なら静かなメニューにできます',
    when: d => !!d.places?.includes('home'),
    kind: {
      type: 'choice',
      key: 'quiet',
      options: () => [
        { value: 'false', label: '大丈夫', desc: 'ジャンプ系もOK', emoji: '👟' },
        { value: 'true', label: '静かにしたい', desc: 'ジャンプ・ダッシュなしで組む', emoji: '🤫' },
      ],
    },
    row: { label: '自宅の音', value: d => (d.quiet ? '静かに' : '気にしない') },
  },
  {
    id: 'days',
    section: 'スケジュール',
    title: () => '何曜日にトレーニングできますか?',
    sub: () => '週の日数を選んでから、曜日をタップして調整できます',
    kind: { type: 'days' },
    row: { label: '曜日', value: d => `週${d.days?.length ?? 0}日 (${daysText(d.days ?? [])})` },
  },
  {
    id: 'minutes',
    section: 'スケジュール',
    title: () => '1回にかけられる時間は?',
    sub: () => 'ウォームアップとストレッチ (合計6分) も含めた時間です',
    kind: {
      type: 'choice',
      key: 'minutes',
      grid: true,
      options: () => [
        { value: '30', label: '30分', desc: 'サクッと' },
        { value: '45', label: '45分', desc: 'ちょうどいい' },
        { value: '60', label: '60分', desc: 'しっかり' },
        { value: '75', label: '75分', desc: 'じっくり' },
        { value: '90', label: '90分', desc: 'たっぷり' },
      ],
    },
    row: { label: '1回の時間', value: d => `${d.minutes}分` },
  },
  {
    id: 'trainTime',
    section: 'スケジュール',
    title: () => 'トレーニングすることが多い時間帯は?',
    sub: () => 'トレーニング前後の食事のタイミングを合わせます',
    kind: {
      type: 'choice',
      key: 'trainTime',
      grid: true,
      options: () => [
        { value: 'morning', label: '朝', desc: '出勤・通学前', emoji: '🌅' },
        { value: 'noon', label: '昼', desc: 'お昼休みなど', emoji: '☀️' },
        { value: 'evening', label: '夕方', desc: '仕事・学校のあと', emoji: '🌇' },
        { value: 'night', label: '夜', desc: '夕食のあと', emoji: '🌙' },
      ],
    },
    row: { label: '時間帯', value: d => (d.trainTime ? TRAIN_TIME_LABEL[d.trainTime] : '') },
  },
  {
    id: 'cardio',
    section: 'スケジュール',
    title: () => 'ランやバイクなどの有酸素は?',
    sub: d =>
      (d.days?.length ?? 0) < 3
        ? '週2日以下のプランでは、筋トレの日の最後に有酸素を入れて調整します'
        : '筋トレの日とは別に、有酸素だけの日を入れるかどうか',
    kind: {
      type: 'choice',
      key: 'cardio',
      options: () => [
        { value: 'none', label: CARDIO_LABEL.none, desc: 'トレーニング日はすべて筋トレ・WOD', emoji: '🏋️' },
        { value: 'some', label: CARDIO_LABEL.some, desc: '1日だけ有酸素の日にする', emoji: '🚴' },
        { value: 'more', label: CARDIO_LABEL.more, desc: '3日に1日くらいを有酸素に。体力・減量向き', emoji: '🏃' },
      ],
    },
    row: { label: '有酸素', value: d => (d.cardio ? CARDIO_LABEL[d.cardio] : '') },
  },
  {
    id: 'activity',
    section: '食事',
    title: () => '仕事中や普段の活動量は?',
    sub: () => 'トレーニング以外の消費カロリーに使います',
    kind: {
      type: 'choice',
      key: 'activity',
      options: () => [
        { value: 'low', label: ACTIVITY_LABEL.low, desc: '座っている時間が長い', emoji: '💻' },
        { value: 'mid', label: ACTIVITY_LABEL.mid, desc: '販売・接客・1日8,000歩以上', emoji: '🚶' },
        { value: 'high', label: ACTIVITY_LABEL.high, desc: '介護・建設・配達など', emoji: '📦' },
      ],
    },
    row: { label: '活動量', value: d => (d.activity ? ACTIVITY_LABEL[d.activity] : '') },
  },
  {
    id: 'meals',
    section: '食事',
    title: () => '1日に何回食べますか?',
    sub: () => '回数に合わせて、1回ごとの量の目安を出します',
    kind: {
      type: 'choice',
      key: 'meals',
      options: () => [
        { value: '3', label: '3回', desc: '朝・昼・夜', emoji: '🍚' },
        { value: '4', label: '4回', desc: '3食 + 間食1回', emoji: '🍙' },
        { value: '5', label: '5回', desc: '3食 + 間食2回。増量向き', emoji: '🥤' },
      ],
    },
    row: { label: '食事の回数', value: d => `${d.meals}回` },
  },
  {
    id: 'weeks',
    section: 'プラン',
    title: () => 'プランの長さは?',
    sub: () => '4週間ごとに「積み上げ → 強化 → ディロード」を回します',
    kind: {
      type: 'choice',
      key: 'weeks',
      options: () => [
        { value: '4', label: '4週間', desc: 'まずは習慣づくり', emoji: '🌱' },
        { value: '8', label: '8週間', desc: '変化を実感しやすい長さ', emoji: '📈' },
        { value: '12', label: '12週間 (おすすめ)', desc: '見た目と記録がはっきり変わる', emoji: '🏆' },
      ],
    },
    row: { label: '期間', value: d => `${d.weeks}週間` },
  },
  {
    id: 'start',
    section: 'プラン',
    title: () => 'いつから始めますか?',
    kind: { type: 'choice', key: 'startDate', options: (_, initial) => startOptions(initial) },
    row: { label: '開始日', value: d => (d.startDate ? `${formatMD(d.startDate)} (${dowOf(d.startDate)})` : '') },
  },
  {
    id: 'confirm',
    section: '確認',
    title: () => 'この内容でプランを作ります',
    sub: () => '変えたい項目はタップすると直せます',
    kind: { type: 'confirm' },
  },
]

/** 進捗の区切り (確認を除く) */
const SECTIONS = [...new Set(STEPS.map(s => s.section))].filter(s => s !== '確認')

// ---------------------------------------------------------------- 入力チェック

const RANGE = {
  age: [13, 90],
  height: [120, 220],
  weight: [30, 200],
} as const

function inRange(v: number | undefined, [lo, hi]: readonly [number, number]): boolean {
  return v !== undefined && Number.isFinite(v) && v >= lo && v <= hi
}

function valid(step: Step, d: Draft): boolean {
  const k = step.kind
  switch (k.type) {
    case 'choice':
      return d[k.key] !== undefined
    case 'multi':
      return d[k.key] !== undefined && (!k.required || (d[k.key] as unknown[]).length > 0)
    case 'body':
      return inRange(d.age, RANGE.age) && inRange(d.height, RANGE.height) && inRange(d.weight, RANGE.weight)
    case 'target': {
      if (d.targetWeight === undefined) return true
      const dir = weightDirection(d.goal!)
      return inRange(d.targetWeight, RANGE.weight) && (dir === 'down' ? d.targetWeight < d.weight! : d.targetWeight > d.weight!)
    }
    case 'days':
      return !!d.days && d.days.length >= 1 && d.days.length <= 6
    default:
      return true
  }
}

function toProfile(d: Draft, initial?: Profile): Profile {
  const dir = weightDirection(d.goal!)
  return {
    version: 1,
    name: (d.name ?? '').trim(),
    goal: d.goal!,
    sex: d.sex!,
    age: d.age!,
    height: d.height!,
    weight: d.weight!,
    targetWeight: dir ? d.targetWeight : undefined,
    level: d.level!,
    places: d.places!,
    gear: d.places!.some(e => e === 'home' || e === 'outdoor') ? (d.gear ?? []) : [],
    quiet: d.places!.includes('home') ? !!d.quiet : false,
    days: [...d.days!].sort(),
    minutes: d.minutes!,
    trainTime: d.trainTime!,
    cardio: d.cardio!,
    injuries: d.injuries ?? [],
    activity: d.activity!,
    meals: d.meals!,
    weeks: d.weeks!,
    startDate: d.startDate!,
    createdAt: initial?.createdAt ?? Date.now(),
    theme: d.theme ?? 'black',
  }
}

const NEW_DRAFT: Draft = { name: '', age: 30, height: 165, weight: 60, days: DEFAULT_DAYS[3] }

// ---------------------------------------------------------------- 画面

interface Props {
  /** 編集時は今のプロフィール */
  initial?: Profile
  onDone: (p: Profile) => void
  onExit: () => void
}

export default function Onboarding({ initial, onDone, onExit }: Props) {
  const [d, setD] = useState<Draft>(() =>
    initial ? { ...initial, theme: initial.theme ?? savedTheme() } : { ...NEW_DRAFT, theme: savedTheme() },
  )
  // 一度答えた質問 (確認画面から直しに行ったとき、未回答の質問だけ続けて聞くため)
  const [seen, setSeen] = useState<Set<string>>(() => new Set(initial ? STEPS.map(s => s.id) : []))
  const [index, setIndex] = useState(() => (initial ? STEPS.length - 1 : 0))
  const [fromConfirm, setFromConfirm] = useState(!!initial)
  const timer = useRef<number>()

  const steps = useMemo(() => STEPS.filter(s => !s.when || s.when(d)), [d])
  const step = steps[Math.min(index, steps.length - 1)]
  const confirmAt = steps.length - 1
  const ok = valid(step, d)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step.id])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function goNext(draft: Draft = d, seenBase: Set<string> = seen) {
    const list = STEPS.filter(s => !s.when || s.when(draft))
    const at = list.findIndex(s => s.id === step.id)
    const nextSeen = new Set(seenBase).add(step.id)
    setSeen(nextSeen)
    if (step.kind.type === 'confirm') {
      onDone(toProfile(draft, initial))
      return
    }
    if (fromConfirm) {
      // 直しに来たときは、条件が変わって増えた未回答の質問だけ聞いてから確認画面に戻る
      const pending = list.findIndex((s, i) => i > at && !nextSeen.has(s.id) && s.kind.type !== 'confirm')
      setIndex(pending >= 0 ? pending : list.length - 1)
      return
    }
    setIndex(Math.min(at + 1, list.length - 1))
  }

  function goBack() {
    window.clearTimeout(timer.current)
    if (fromConfirm && step.kind.type !== 'confirm') {
      setIndex(confirmAt)
      return
    }
    if (index === 0) onExit()
    else setIndex(index - 1)
  }

  function jump(id: string) {
    setFromConfirm(true)
    setIndex(steps.findIndex(s => s.id === id))
  }

  function update(patch: Draft, advance = false, seenBase: Set<string> = seen) {
    const next = { ...d, ...patch }
    setD(next)
    if (advance) {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => goNext(next, seenBase), 220)
    }
  }

  function chooseSingle(key: ChoiceKey, value: string) {
    const v = NUMBER_KEYS.includes(key) ? Number(value) : key === 'quiet' ? value === 'true' : value
    const patch: Draft = { [key]: v }
    // 性別を初めて選んだら、身長・体重の初期値をそれらしい値にする
    if (key === 'sex' && !seen.has('body')) {
      Object.assign(patch, value === 'male' ? { height: 172, weight: 68 } : value === 'female' ? { height: 158, weight: 52 } : { height: 165, weight: 60 })
    }
    // 目的を変えたら目標体重は決め直す (確認画面から直したときも聞き直す)
    let seenBase = seen
    if (key === 'goal' && value !== d.goal) {
      patch.targetWeight = undefined
      seenBase = new Set(seen)
      seenBase.delete('target')
    }
    update(patch, true, seenBase)
  }

  // 条件で質問の数が変わっても戻らないよう、全質問の中での位置で進捗を出す
  const secIdx = SECTIONS.indexOf(step.section)
  const progress = Math.round((STEPS.findIndex(s => s.id === step.id) / (STEPS.length - 1)) * 100)

  return (
    <div className="ob">
      <header className="ob-head">
        <button className="icon-btn" onClick={goBack} aria-label="戻る">
          <BackIcon size={20} />
        </button>
        <div className="ob-progress">
          <div className="ob-progress-top">
            <span className="ob-section">{step.section}</span>
            <span className="ob-dots" aria-hidden>
              {SECTIONS.map((sec, i) => (
                <i key={sec} className={secIdx < 0 || i <= secIdx ? 'on' : ''} />
              ))}
            </span>
          </div>
          <div className="ob-bar">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <main className="ob-main" key={step.id}>
        <h1 className="ob-title">{step.title(d)}</h1>
        {step.sub && <p className="ob-sub">{step.sub(d)}</p>}

        <div className="ob-body">
          {step.kind.type === 'choice' && (
            <ChoiceList
              options={step.kind.options(d, initial)}
              grid={step.kind.grid}
              selected={d[step.kind.key] === undefined ? [] : [String(d[step.kind.key])]}
              onPick={v => chooseSingle((step.kind as { key: ChoiceKey }).key, v)}
            />
          )}
          {step.kind.type === 'multi' && <MultiStep kind={step.kind} d={d} update={update} />}
          {step.kind.type === 'theme' && (
            <ThemePicker
              value={d.theme ?? 'black'}
              onChange={theme => {
                applyTheme(theme)
                update({ theme })
              }}
            />
          )}
          {step.kind.type === 'name' && (
            <input
              className="input ob-input"
              value={d.name ?? ''}
              maxLength={20}
              placeholder="例: たろう"
              autoComplete="nickname"
              onChange={e => update({ name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && goNext()}
            />
          )}
          {step.kind.type === 'body' && <BodyStep d={d} update={update} />}
          {step.kind.type === 'target' && <TargetStep d={d} update={update} />}
          {step.kind.type === 'days' && <DaysStep d={d} update={update} />}
          {step.kind.type === 'confirm' && <ConfirmList steps={steps} d={d} onJump={jump} />}
        </div>
      </main>

      <footer className="ob-foot">
        <button className="btn-primary wide ob-next" disabled={!ok} onClick={() => goNext()}>
          {step.kind.type === 'confirm'
            ? initial
              ? 'この内容でプランを作り直す'
              : 'この内容でプランを作る'
            : fromConfirm
              ? '決定'
              : step.kind.type === 'name' && !d.name
                ? 'スキップ'
                : '次へ'}
        </button>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------- 部品

function ChoiceList({
  options,
  selected,
  onPick,
  grid,
}: {
  options: Option[]
  selected: string[]
  onPick: (v: string) => void
  grid?: boolean
}) {
  return (
    <div className={`ob-options ${grid ? 'grid' : ''}`}>
      {options.map(o => {
        const on = selected.includes(o.value)
        return (
          <button key={o.value} className={`ob-option ${on ? 'on' : ''}`} onClick={() => onPick(o.value)} aria-pressed={on}>
            {o.emoji && <span className="ob-emoji">{o.emoji}</span>}
            <span className="ob-option-text">
              <b>{o.label}</b>
              {o.desc && <small>{o.desc}</small>}
            </span>
            <i className="ob-check" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

function MultiStep({
  kind,
  d,
  update,
}: {
  kind: Extract<Kind, { type: 'multi' }>
  d: Draft
  update: (p: Draft, advance?: boolean) => void
}) {
  const options = kind.options(d)
  const values = d[kind.key] as string[] | undefined
  const exclusive = options.find(o => o.exclusive)
  // 空配列 = 「なし」を選んだ状態 (未回答は undefined)
  const selected = values === undefined ? [] : values.length ? values : exclusive ? [exclusive.value] : []

  function pick(v: string) {
    const opt = options.find(o => o.value === v)!
    if (opt.exclusive) {
      update({ [kind.key]: [] }, true)
      return
    }
    const cur = values ?? []
    const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
    const patch: Draft = { [kind.key]: next.length || exclusive ? next : undefined }
    // 場所から自宅・野外を外したら、そこでしか使わない道具は外す
    if (kind.key === 'places') {
      const places = next as Env[]
      if (!places.includes('outdoor') && d.gear) patch.gear = d.gear.filter((g: Gear) => g !== 'stairs')
    }
    update(patch)
  }

  return <ChoiceList options={options} selected={selected} onPick={pick} grid={kind.key !== 'places'} />
}

function Stepper({
  label,
  unit,
  value,
  step,
  range,
  onChange,
}: {
  label: string
  unit: string
  value: number | undefined
  step: number
  range: readonly [number, number]
  onChange: (v: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  useEffect(() => {
    // ボタンで変えた値を入力欄に反映する (入力中の文字は崩さない)
    if (value !== undefined && Number(text) !== value) setText(String(value))
  }, [value])

  const bump = (dir: 1 | -1) => {
    const base = value ?? range[0]
    const next = Math.round((base + step * dir) * 10) / 10
    onChange(Math.min(range[1], Math.max(range[0], next)))
  }
  const bad = text !== '' && !inRange(Number(text), range)

  return (
    <div className={`ob-stepper ${bad ? 'bad' : ''}`}>
      <span className="ob-stepper-label">{label}</span>
      <div className="ob-stepper-row">
        <button className="ob-stepper-btn" onClick={() => bump(-1)} aria-label={`${label}を減らす`}>
          −
        </button>
        <label className="ob-stepper-value">
          <input
            inputMode={step < 1 ? 'decimal' : 'numeric'}
            value={text}
            onChange={e => {
              const t = e.target.value.replace(/[^0-9.]/g, '')
              setText(t)
              const n = Number(t)
              onChange(t === '' || !Number.isFinite(n) ? undefined : n)
            }}
            aria-label={label}
          />
          <span>{unit}</span>
        </label>
        <button className="ob-stepper-btn" onClick={() => bump(1)} aria-label={`${label}を増やす`}>
          +
        </button>
      </div>
      {bad && (
        <span className="ob-stepper-hint">
          {range[0]}〜{range[1]}
          {unit}で入力してください
        </span>
      )}
    </div>
  )
}

function BodyStep({ d, update }: { d: Draft; update: (p: Draft) => void }) {
  const ok = inRange(d.height, RANGE.height) && inRange(d.weight, RANGE.weight)
  return (
    <div className="ob-steppers">
      <Stepper label="年齢" unit="歳" value={d.age} step={1} range={RANGE.age} onChange={v => update({ age: v })} />
      <Stepper label="身長" unit="cm" value={d.height} step={1} range={RANGE.height} onChange={v => update({ height: v })} />
      <Stepper label="体重" unit="kg" value={d.weight} step={0.5} range={RANGE.weight} onChange={v => update({ weight: v })} />
      {ok && <p className="ob-note">BMI {bmi({ height: d.height!, weight: d.weight! }).toFixed(1)}</p>}
    </div>
  )
}

function TargetStep({ d, update }: { d: Draft; update: (p: Draft) => void }) {
  const dir = weightDirection(d.goal!)!
  const has = d.targetWeight !== undefined
  const suggested = Math.round(d.weight! * (dir === 'down' ? 0.93 : 1.05) * 2) / 2
  const preview = { ...d, targetWeight: d.targetWeight } as Profile
  const rate = weeklyRate(preview)
  const weeks = weeksToTarget(preview)
  const wrongWay = has && (dir === 'down' ? d.targetWeight! >= d.weight! : d.targetWeight! <= d.weight!)
  const tooLow = has && dir === 'down' && bmi({ height: d.height!, weight: d.targetWeight! }) < 18.5

  return (
    <>
      <ChoiceList
        options={[
          { value: 'yes', label: '目標体重を決める', emoji: '🎯' },
          { value: 'no', label: '決めずにペースだけ守る', desc: dir === 'down' ? '週0.5%ずつ、ゆっくり落とします' : '筋肉が増えるペースでゆっくり増やします', emoji: '🐢' },
        ]}
        selected={[has ? 'yes' : 'no']}
        onPick={v => update({ targetWeight: v === 'yes' ? (d.targetWeight ?? suggested) : undefined })}
      />
      {has && (
        <Stepper
          label="目標体重"
          unit="kg"
          value={d.targetWeight}
          step={0.5}
          range={RANGE.weight}
          onChange={v => update({ targetWeight: v })}
        />
      )}
      <div className="ob-insight">
        {wrongWay ? (
          <p>目標は今の体重 ({d.weight}kg) より{dir === 'down' ? '軽く' : '重く'}してください。</p>
        ) : rate === 0 ? (
          <p>今の体重 (BMI {bmi({ height: d.height!, weight: d.weight! }).toFixed(1)}) では減量はおすすめしません。体重は維持しながら体を引き締めるプランにします。</p>
        ) : (
          <>
            <p>
              ペースは <b>週 {rate > 0 ? '+' : ''}{rate}kg</b>。
              {weeks !== undefined && <>約 <b>{weeks}週間</b> で到達する見込みです。</>}
            </p>
            <p className="ob-insight-sub">
              {dir === 'down'
                ? '体重の0.5%/週は、筋肉を残したまま脂肪を落とせる上限の目安です。'
                : '筋肉が増えるペースはゆっくり。これ以上速く増やすと増えるのは主に脂肪です。'}
            </p>
          </>
        )}
        {tooLow && <p className="ob-warn">目標がBMI18.5未満になります。健康のため、もう少し高めの目標をおすすめします。</p>}
      </div>
    </>
  )
}

function DaysStep({ d, update }: { d: Draft; update: (p: Draft) => void }) {
  const days = d.days ?? []
  const toggle = (day: number) =>
    update({ days: days.includes(day) ? days.filter(x => x !== day) : [...days, day] })
  return (
    <>
      <div className="ob-presets" role="group" aria-label="週の日数">
        {[2, 3, 4, 5, 6].map(n => (
          <button key={n} className={`chip ${days.length === n ? 'chip-on' : ''}`} onClick={() => update({ days: DEFAULT_DAYS[n] })}>
            週{n}日
          </button>
        ))}
      </div>
      <div className="ob-week">
        {WEEK_ORDER.map(day => (
          <button
            key={day}
            className={`ob-day ${days.includes(day) ? 'on' : ''} ${day === 0 ? 'sun' : day === 6 ? 'sat' : ''}`}
            onClick={() => toggle(day)}
            aria-pressed={days.includes(day)}
          >
            {DOW_LABEL[day]}
          </button>
        ))}
      </div>
      <div className="ob-insight">
        {days.length === 0 ? (
          <p>1日以上選んでください。</p>
        ) : days.length > 6 ? (
          <p className="ob-warn">筋肉は休んでいる間に育ちます。週に1日は休養日を残してください。</p>
        ) : (
          <p>
            <b>週{days.length}日</b> ({daysText(days)})。{DAYS_NOTE[days.length]}
          </p>
        )}
      </div>
    </>
  )
}

const DAYS_NOTE: Record<number, string> = {
  1: '週1日でも続ければ体は変わります。全身をまとめて鍛えます。',
  2: '全身を2パターンに分けて交互に行います。',
  3: '続けやすさと効果のバランスがいちばん良い日数です。',
  4: '上半身と下半身を分けて、1回の質を高められます。',
  5: '部位を分けて、しっかりボリュームを積めます。',
  6: '上級者向け。睡眠と食事をいつも以上に大切に。',
}

function ConfirmList({ steps, d, onJump }: { steps: Step[]; d: Draft; onJump: (id: string) => void }) {
  const rows = steps.filter(s => s.row)
  return (
    <ul className="ob-confirm">
      {rows.map(s => (
        <li key={s.id}>
          <button onClick={() => onJump(s.id)}>
            <span className="ob-confirm-label">{s.row!.label}</span>
            <span className="ob-confirm-value">{s.row!.value(d)}</span>
            <ChevronIcon size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** 最初に表示する案内 */
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="ob welcome">
      <div className="welcome-hero">
        <div className="logo welcome-logo">
          FIT<span>MEMO</span>
        </div>
        <p className="logo-sub">TRAIN · EAT · REST</p>
        <h1 className="welcome-title">
          あなた専用の
          <br />
          トレーニングプランを。
        </h1>
        <p className="welcome-sub">いくつかの質問に答えるだけで、毎日のメニューと食事の目安が決まります。</p>
      </div>
      <ul className="welcome-points">
        <li>
          <span>🗓️</span>
          <div>
            <b>今日やることが1画面でわかる</b>
            <small>4〜12週間のプランを、曜日・場所・時間に合わせて自動で作成</small>
          </div>
        </li>
        <li>
          <span>🍽️</span>
          <div>
            <b>食事の目安もセットで</b>
            <small>カロリー・PFC・食べるタイミングを、目的と体格から計算</small>
          </div>
        </li>
        <li>
          <span>🔒</span>
          <div>
            <b>登録不要・データは端末の中だけ</b>
            <small>回答も記録もこのブラウザにだけ保存されます</small>
          </div>
        </li>
      </ul>
      <footer className="ob-foot">
        <button className="btn-primary wide ob-next" onClick={onStart}>
          はじめる (約2分)
        </button>
      </footer>
    </div>
  )
}

/** 色テーマの選択 (オンボーディングとプラン画面で使う) */
export function ThemePicker({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="theme-grid" role="radiogroup" aria-label="アプリの色">
      {THEMES.map(t => (
        <button
          key={t.key}
          role="radio"
          aria-checked={value === t.key}
          className={`theme-opt ${value === t.key ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          <span className="theme-preview" style={{ background: t.swatch.bg }}>
            <span className="theme-preview-card" style={{ background: t.swatch.card }}>
              <i style={{ background: t.swatch.text }} />
              <i style={{ background: t.swatch.text, opacity: 0.4 }} />
              <b style={{ background: t.swatch.accent }} />
            </span>
          </span>
          <span className="theme-name">{t.label}</span>
          <small className="theme-desc">{t.desc}</small>
        </button>
      ))}
    </div>
  )
}
