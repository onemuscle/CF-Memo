// シード付き乱数。同じ回答 + 同じシードなら同じメニューになるので、
// 共有URLにシードを載せれば相手の端末でも同じメニューを再現できる。

export type Rng = () => number

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

/** スコアが高いほど選ばれやすい重み付き抽選 (スコア0以下は除外) */
export function weighted<T>(rng: Rng, list: readonly T[], score: (x: T) => number): T | undefined {
  const scored = list.map(x => [x, Math.max(0, score(x))] as const).filter(([, s]) => s > 0)
  const total = scored.reduce((sum, [, s]) => sum + s, 0)
  if (total <= 0) return undefined
  let r = rng() * total
  for (const [x, s] of scored) {
    r -= s
    if (r <= 0) return x
  }
  return scored[scored.length - 1][0]
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
