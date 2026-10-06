import type { Condition, Env, Goal, Injury, Level, Muscle, Rating } from './types'

export const ENV_LABEL: Record<Env, string> = {
  gym: '施設型ジム',
  box: 'CrossFit',
}

export const GOAL_LABEL: Record<Goal, string> = {
  lean: '引き締まった体',
  muscle: '筋肉を大きく',
  strength: '強くなる',
  stamina: 'バテない体力',
  athletic: '動ける体',
  health: '健康・姿勢改善',
}

export const GOAL_SHORT: Record<Goal, string> = {
  lean: '引き締め',
  muscle: '筋肥大',
  strength: '筋力',
  stamina: 'スタミナ',
  athletic: 'アスリート',
  health: '健康',
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: '胸',
  back: '背中',
  shoulders: '肩',
  arms: '腕',
  core: '腹筋・体幹',
  glutes: 'お尻',
  legs: '脚',
}

export const MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'glutes', 'legs']

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: '初心者',
  intermediate: '中級者',
  advanced: '上級者',
}

export const CONDITION_LABEL: Record<Condition, string> = {
  great: '絶好調',
  normal: 'ふつう',
  tired: '疲れ気味',
}

export const INJURY_LABEL: Record<Injury, string> = {
  lowback: '腰',
  knee: 'ひざ',
  shoulder: '肩',
  wrist: '手首',
}

export const RATING_LABEL: Record<Rating, string> = {
  easy: '余裕だった',
  good: 'ちょうどいい',
  hard: 'きつかった',
}

/** 部位のリストを「胸・背中」のように並べる */
export function musclesText(list: Muscle[]): string {
  return list.map(m => MUSCLE_LABEL[m]).join('・')
}
