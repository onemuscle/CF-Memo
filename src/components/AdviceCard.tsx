import type { AccessoryAdvice } from '../types'

/** 判定と、その見た目のトーン */
const VERDICT: Record<AccessoryAdvice['verdict'], { label: string; tone: string }> = {
  keep: { label: '予定どおり', tone: 'ok' },
  reduce: { label: '量を減らす', tone: 'warn' },
  swap: { label: '種目を入れ替え', tone: 'warn' },
  skip: { label: '今日は中止', tone: 'stop' },
}

const AM_LOAD: Record<AccessoryAdvice['amLoad'], string> = {
  high: '朝は高負荷',
  medium: '朝は中程度',
  low: '朝は軽め',
}

/** 朝のWODを踏まえた、その日の補助トレの判定 */
export default function AdviceCard({ advice }: { advice: AccessoryAdvice }) {
  const v = VERDICT[advice.verdict]

  return (
    <div className={`advice advice-${v.tone}`}>
      <div className="advice-head">
        <span className="advice-verdict">{v.label}</span>
        <span className="advice-load">{AM_LOAD[advice.amLoad]}</span>
      </div>

      {advice.headline && <p className="advice-headline">{advice.headline}</p>}
      {advice.reason && <p className="advice-reason">{advice.reason}</p>}

      {advice.exercises.length > 0 && (
        <div className="advice-list">
          {advice.exercises.map((e, i) => (
            <div className="advice-item" key={`${e.name}-${i}`}>
              <span className="advice-name">
                {e.name}
                {e.nameJa && <span className="advice-ja">{e.nameJa}</span>}
              </span>
              <span className="advice-vol">{e.volume}</span>
              {e.change && <span className="advice-change">{e.change}</span>}
            </div>
          ))}
        </div>
      )}

      {advice.caution && <p className="advice-caution">{advice.caution}</p>}
    </div>
  )
}
