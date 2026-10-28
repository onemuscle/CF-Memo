// みんな向け版 (FIT MEMO) のプラン生成を、プロフィールの組み合わせで検証する。
//   npm run check:plan
// - 例外が出ない / 選んだ曜日の数だけトレーニング日がある / 選んでいない場所を使わない
// - 1日のメニューが指定した時間を超えない / 空のブロックがない / 表示文に NaN・undefined がない
// - 食事の目安が基礎代謝を下回らず、1日の配分の合計が目安とほぼ一致する
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const planMod = await server.ssrLoadModule('/src/app/plan/plan.ts')
const workoutMod = await server.ssrLoadModule('/src/app/plan/workout.ts')
const nutrition = await server.ssrLoadModule('/src/app/plan/nutrition.ts')
const { buildPlan, dayPlan, isTraining } = planMod
const { dayWorkout } = workoutMod
const { targetsFor, dayMeals, bmrOf, weightAt } = nutrition

const GOALS = ['lean', 'muscle', 'strength', 'stamina', 'athletic', 'health']
const LEVELS = ['beginner', 'intermediate', 'advanced']
const PLACES = [['gym'], ['box'], ['home'], ['outdoor'], ['box', 'gym'], ['box', 'home'], ['home', 'outdoor'], ['gym', 'box', 'home', 'outdoor']]
const DAYS = [[3], [2, 5], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 5, 6], [1, 2, 3, 4, 5, 6], [0, 6]]
const CARDIO = ['none', 'some', 'more']
const MINUTES = [30, 60, 90]
const BODIES = [
  { sex: 'male', age: 25, height: 175, weight: 85, targetWeight: 78 },
  { sex: 'female', age: 52, height: 155, weight: 47 },
  { sex: 'other', age: 38, height: 165, weight: 64, targetWeight: 70 },
]
const EXTRAS = [
  { injuries: [], gear: [], quiet: false, trainTime: 'evening', meals: 3, activity: 'low', weeks: 12 },
  { injuries: ['knee', 'lowback'], gear: ['dumbbell', 'bench', 'stairs'], quiet: true, trainTime: 'morning', meals: 5, activity: 'high', weeks: 8 },
  { injuries: ['shoulder', 'wrist'], gear: ['band', 'bar'], quiet: false, trainTime: 'night', meals: 4, activity: 'mid', weeks: 4 },
  { injuries: [], gear: ['dumbbell'], quiet: false, trainTime: 'noon', meals: 1, activity: 'low', weeks: 4, gymStyle: 'dumbbell' },
  { injuries: ['knee'], gear: [], quiet: true, trainTime: 'night', meals: 2, activity: 'mid', weeks: 8, gymStyle: 'machine' },
  { injuries: [], gear: ['kettlebell'], quiet: false, trainTime: 'morning', meals: 6, activity: 'high', weeks: 4, gymStyle: 'hybrid' },
]

const BAD_TEXT = /NaN|undefined|null|\[object/
const failures = []
let profiles = 0
let days = 0

function fail(p, date, msg) {
  if (failures.length < 30) failures.push(`${JSON.stringify(p)} ${date ?? ''}: ${msg}`)
}

let n = 0
for (const goal of GOALS)
  for (const level of LEVELS)
    for (const places of PLACES)
      for (const dayList of DAYS)
        for (const cardio of CARDIO)
          for (const minutes of MINUTES) {
            n++
            const body = BODIES[n % BODIES.length]
            const extra = EXTRAS[(n >> 1) % EXTRAS.length]
            const profile = {
              version: 1,
              name: '',
              goal,
              level,
              places,
              days: dayList,
              cardio,
              minutes,
              ...body,
              ...extra,
              targetWeight: goal === 'lean' || goal === 'muscle' ? body.targetWeight : undefined,
              startDate: '2026-11-02',
              createdAt: 1700000000000 + n,
            }
            profiles++
            let plan
            try {
              plan = buildPlan(profile)
            } catch (e) {
              fail(profile, null, `buildPlan threw ${e.stack}`)
              continue
            }

            const training = Object.values(plan.template).filter(isTraining)
            if (training.length !== dayList.length) fail(profile, null, `training days ${training.length} != ${dayList.length}`)
            for (const s of training) {
              if (!places.includes(s.env))
                fail(profile, null, `session ${s.type} uses env ${s.env} not in ${places}`)
            }

            for (let w = 1; w <= profile.weeks; w++) {
              const wt = weightAt(profile, w)
              if (!Number.isFinite(wt) || wt < 30) fail(profile, null, `weightAt(${w}) = ${wt}`)
            }

            // 1週目・ディロード週・最終週を中心に、全日を確認する
            for (let i = 0; i <= plan.totalDays; i++) {
              const date = new Date(2026, 10, 2 + i)
              const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
              const day = dayPlan(plan, iso)
              if (!day) {
                fail(profile, iso, 'no dayPlan inside period')
                continue
              }
              days++
              const conds = i % 7 === 0 ? ['auto', 'tired', 'great'] : ['auto']
              for (const cond of conds) {
                let w
                try {
                  w = dayWorkout(plan, day, cond, i % 3 === 0 ? 1 : 0)
                } catch (e) {
                  fail(profile, iso, `dayWorkout threw ${e.stack}`)
                  continue
                }
                if (!w) {
                  if (isTraining(day.session)) fail(profile, iso, 'training day without workout')
                  continue
                }
                if (w.totalMinutes > minutes + 1) fail(profile, iso, `${w.totalMinutes}min > ${minutes}min (${day.session.type})`)
                if (w.blocks.some(b => b.items.length === 0)) fail(profile, iso, 'empty block')
                const text = JSON.stringify([w.title, w.subtitle, w.blocks, w.why, w.cautions, w.next])
                if (BAD_TEXT.test(text)) fail(profile, iso, `bad text ${text.match(BAD_TEXT)[0]} in ${w.title}`)
              }

              const t = targetsFor(profile, day.session)
              if (![t.kcal, t.p, t.f, t.c].every(x => Number.isFinite(x) && x > 0)) fail(profile, iso, `targets ${JSON.stringify(t)}`)
              if (t.kcal < Math.floor(bmrOf(profile) / 50) * 50) fail(profile, iso, `kcal ${t.kcal} below BMR`)
              const meals = dayMeals(profile, day.session, t)
              if (meals.slots.length !== profile.meals) fail(profile, iso, `meal slots ${meals.slots.length}`)
              for (const k of ['p', 'f', 'c']) {
                const sum = meals.slots.reduce((a, m) => a + m[k], 0)
                if (Math.abs(sum - t[k]) > 5 * meals.slots.length) fail(profile, iso, `meal ${k} sum ${sum} vs ${t[k]}`)
              }
              if (BAD_TEXT.test(JSON.stringify(meals))) fail(profile, iso, 'bad text in meals')
            }
          }

await server.close()

console.log(`checked ${profiles} profiles / ${days} days`)
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('OK')
