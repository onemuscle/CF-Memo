// きょうトレのメニュー生成エンジンを、回答の全組み合わせで検証する。
//   npm run check:workout
// - 例外が出ない / 指定した時間を超えない / 空のブロックがない / 表示文に NaN・undefined がない
// - 履歴付きで作ったメニューが、共有コードから同じ内容で再現できる
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const engine = await server.ssrLoadModule('/src/workout/engine/index.ts')
const { generateWorkout, generateForToday, decodeShare, shareCode, exerciseIds, workedMuscles } = engine

const ENVS = ['gym', 'box']
const GOALS = ['lean', 'muscle', 'strength', 'stamina', 'athletic', 'health']
const LEVELS = ['beginner', 'intermediate', 'advanced']
const CONDS = ['great', 'normal', 'tired']
const MINUTES = [20, 30, 45, 60, 75, 90]
const FOCUS = [[], ['chest'], ['back', 'arms'], ['legs', 'glutes'], ['core'], ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs']]
const INJURIES = [[], ['knee'], ['lowback', 'shoulder'], ['lowback', 'knee', 'shoulder', 'wrist']]

const now = new Date()
const daysAgo = d => {
  const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const failures = []
let count = 0
let seed = 1
for (const env of ENVS)
  for (const goal of GOALS)
    for (const level of LEVELS)
      for (const condition of CONDS)
        for (const minutes of MINUTES)
          for (const focus of FOCUS)
            for (const injuries of INJURIES) {
              const a = { env, goal, focus, minutes, level, condition, injuries, scale: seed % 2 ? 'men' : 'women' }
              const label = JSON.stringify(a)
              seed++
              count++
              try {
                const prev = generateWorkout(a, seed * 7)
                const history = [
                  { id: 'x', date: daysAgo(seed % 3), doneAt: 0, title: '', env, goal, minutes, rating: ['easy', 'good', 'hard'][seed % 3], muscles: workedMuscles(prev), exerciseIds: exerciseIds(prev) },
                ]
                const w = generateForToday(a, seed, history, now)
                if (w.totalMinutes > minutes + 1) failures.push(`時間超過 ${w.totalMinutes}/${minutes}分 ${label}`)
                for (const b of w.blocks) {
                  if (!b.items.length) failures.push(`空のブロック ${b.key} ${label}`)
                  if (/NaN|undefined/.test(JSON.stringify(b))) failures.push(`表示文に NaN/undefined (${b.key}) ${label}`)
                }
                const d = decodeShare(shareCode(w))
                const again = d && generateWorkout(d.answers, d.seed, d.context)
                if (!again || JSON.stringify(again.blocks) !== JSON.stringify(w.blocks)) failures.push(`共有コードで再現できない ${label}`)
              } catch (e) {
                failures.push(`例外 ${e?.message} ${label}`)
              }
            }

await server.close()
console.log(`${count}通りの回答を検証しました`)
if (failures.length) {
  console.error(`NG: ${failures.length}件`)
  failures.slice(0, 20).forEach(f => console.error('  ' + f))
  process.exit(1)
}
console.log('OK')
