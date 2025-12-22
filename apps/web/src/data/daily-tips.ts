export type TipCategory = 'productivity' | 'feature' | 'shortcut' | 'best-practice'

export interface DailyTip {
  id: string
  text: string
  category: TipCategory
}

/**
 * Array of tips that rotate daily
 * Add new tips here to expand the rotation
 */
export const DAILY_TIPS: DailyTip[] = [
  {
    id: 'tip-1',
    text: 'Press Shift+Enter to enable Plan Mode for complex tasks that need clarification.',
    category: 'shortcut',
  },
  {
    id: 'tip-2',
    text: 'Use @filename to mention and include file contents in your chat messages.',
    category: 'feature',
  },
  {
    id: 'tip-3',
    text: 'Attach files directly by clicking the paperclip icon or drag-and-drop.',
    category: 'feature',
  },
  {
    id: 'tip-4',
    text: 'Different agents have specialized capabilities - try switching agents for specific tasks.',
    category: 'best-practice',
  },
  {
    id: 'tip-5',
    text: 'Your conversation history is saved automatically - access it from the History tab.',
    category: 'feature',
  },
  {
    id: 'tip-6',
    text: 'For research tasks, specialized agents can analyze community discussions and sentiment.',
    category: 'best-practice',
  },
  {
    id: 'tip-7',
    text: 'The Activity panel on the right shows real-time progress of your agent tasks.',
    category: 'feature',
  },
  {
    id: 'tip-8',
    text: 'You can download generated reports and outputs directly from the Activity panel.',
    category: 'feature',
  },
  {
    id: 'tip-9',
    text: 'Be specific in your prompts - the more context you provide, the better the results.',
    category: 'best-practice',
  },
  {
    id: 'tip-10',
    text: 'Use the Navigator panel to browse and select files to include in your conversations.',
    category: 'feature',
  },
  {
    id: 'tip-11',
    text: 'Long-running tasks continue in the background - check the Activity panel for updates.',
    category: 'productivity',
  },
  {
    id: 'tip-12',
    text: 'Start a new chat tab with the + button to work on multiple tasks simultaneously.',
    category: 'productivity',
  },
]

/**
 * Get today's tip based on the current date
 * Same tip shows all day, changes at midnight
 */
export function getTodaysTip(): DailyTip {
  const today = new Date()
  const startOfYear = new Date(today.getFullYear(), 0, 0)
  const diff = today.getTime() - startOfYear.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))

  const tipIndex = dayOfYear % DAILY_TIPS.length
  return DAILY_TIPS[tipIndex]
}

/**
 * Get a random tip (for testing or manual refresh)
 */
export function getRandomTip(): DailyTip {
  const randomIndex = Math.floor(Math.random() * DAILY_TIPS.length)
  return DAILY_TIPS[randomIndex]
}

/**
 * Get all tips (for settings/preferences UI)
 */
export function getAllTips(): DailyTip[] {
  return DAILY_TIPS
}
