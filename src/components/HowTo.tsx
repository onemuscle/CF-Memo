// 種目の「やり方」と、初めての人向けのメニューの見かた。CF MEMO と Fitto で使う。

import { useState } from 'react'
import type { BlockKind, Item } from '../workout/engine'
import type { GuideSection } from '../plan/guideData'
import { SectionBlock, SubFold } from './TodayPage'

/** 種目のやり方 (手順・フォームのポイント) と動画検索。初心者は最初から開いておく */
export function ItemHowTo({ item, defaultOpen = false }: { item: Item; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!item.cues?.length) return null
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()} やり方`)}`
  return (
    <div className={`howto ${open ? 'open' : ''}`}>
      <button className="howto-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? 'やり方を閉じる' : 'やり方を見る'}
      </button>
      {open && (
        <>
          <ol className="howto-steps">
            {item.cues.map(c => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <a className="howto-video" href={video} target="_blank" rel="noreferrer">
            ▶ 動画で動きを確認する
          </a>
        </>
      )}
    </div>
  )
}

/** 初めての人向けに、ブロックごとの目的を一言で */
export const BLOCK_HINT: Partial<Record<BlockKind, string>> = {
  warmup: 'ケガを防ぐための準備運動です。体が温まって、息が少し上がればOK。省略しないでください',
  strength: '今日のメインです。重さよりフォームを優先し、セットの間はしっかり休みましょう',
  main: '今日のメインです。重さよりフォームを優先し、セットの間はしっかり休みましょう',
  accessory: 'メインで使い切れなかった筋肉を、軽めの重さで丁寧に鍛えます',
  wod: '決められた形式で、時間内に全力で動く時間です。きつければ回数や重さを減らしてOK',
  finisher: '最後の仕上げです。フォームが崩れたら、休みながらでかまいません',
  cooldown: 'がんばった筋肉をゆっくり伸ばして終わります。反動をつけず、呼吸を止めないで',
}

export const BEGINNER_GUIDE: GuideSection[] = [
  {
    title: 'メニューの読み方',
    pairs: [
      { label: '3セット × 10回', detail: '10回続けて行うのを1セットとして、休憩をはさんで3回くり返します' },
      { label: '休憩 90秒', detail: 'セットとセットの間に休む時間です。呼吸を整えて次のセットへ' },
      { label: 'RIR2', detail: '「あと2回できる」余力を残して終える、という意味です。毎回限界までやらなくて大丈夫' },
      { label: 'A1 / A2', detail: 'スーパーセットです。A1を1セット → A2を1セット → 休憩、を交互にくり返します' },
      { label: '左右各', detail: '片側ずつ、その回数を行います' },
    ],
  },
  {
    title: '重さの決め方',
    bullets: [
      '最初は軽めから。決められた回数をフォームを崩さずにできて、「あと2〜3回はできそう」な重さが目安です',
      '最後の2回がきついくらいがちょうどいい重さです',
      '余裕があれば次のセットで少しだけ重く、フォームが崩れたら軽くします',
      'マシンのピンの位置やダンベルの重さはメモしておくと、次回すぐに始められます',
    ],
  },
  {
    title: 'フォームの基本',
    bullets: [
      '呼吸は「下ろすときに吸って、持ち上げるときに吐く」。息を止めないようにしましょう',
      '反動を使わず、2秒で持ち上げて2〜3秒かけてゆっくり下ろします',
      '筋肉が「きつい」のは正常ですが、関節が「痛い」ときはすぐに中止してください',
      '各種目の「やり方を見る」から手順と動画を確認できます。鏡で自分のフォームを見るのもおすすめです',
    ],
  },
  {
    title: 'ウォームアップとストレッチ',
    bullets: [
      'ウォームアップは体温を上げて関節を動かし、ケガを防ぐための準備です',
      'ストレッチは反動をつけず、「痛気持ちいい」手前で止めて、そのままキープします',
      '息を吐きながら伸ばすと、筋肉がゆるみやすくなります',
      '1か所20〜30秒が目安。左右があるものは両方行いましょう',
    ],
  },
]

/** 初めての人向けのメニューの見かた (折りたたみ) */
export function BeginnerGuide() {
  return (
    <SubFold title="はじめての方へ: メニューの見かたとフォームの基本">
      {BEGINNER_GUIDE.map(s => (
        <SectionBlock key={s.title} section={s} />
      ))}
    </SubFold>
  )
}
