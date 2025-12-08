import {
  QuestionSchema,
  ClarificationNeededSchema,
  ClarificationResponseSchema,
  PlanProposedSchema,
  PlanApprovalSchema,
  createClarificationNeeded,
  createPlanProposed,
} from '../types'
import type {
  Question,
  ClarificationNeeded,
  PlanProposed,
} from '../types'

describe('Plan Mode Protocol Types', () => {
  describe('QuestionSchema', () => {
    it('should validate a single_choice question', () => {
      const question: Question = {
        questionId: 'q1',
        questionType: 'single_choice',
        question: 'What niche are you looking for?',
        header: 'Niche',
        options: [
          { id: 'beauty', label: 'Beauty', description: 'Makeup, skincare' },
          { id: 'fitness', label: 'Fitness' },
        ],
        allowFreeText: true,
      }

      const result = QuestionSchema.safeParse(question)
      expect(result.success).toBe(true)
    })

    it('should validate a free_text question', () => {
      const question: Question = {
        questionId: 'q2',
        questionType: 'free_text',
        question: 'Describe what you are looking for',
        placeholder: 'Enter your requirements...',
      }

      const result = QuestionSchema.safeParse(question)
      expect(result.success).toBe(true)
    })

    it('should validate a numeric_range question', () => {
      const question: Question = {
        questionId: 'q3',
        questionType: 'numeric_range',
        question: 'Minimum follower count?',
        min: 1000,
        max: 1000000,
        step: 1000,
        default: '50000',
      }

      const result = QuestionSchema.safeParse(question)
      expect(result.success).toBe(true)
    })
  })

  describe('ClarificationNeededSchema', () => {
    it('should validate a clarification request', () => {
      const clarification: ClarificationNeeded = {
        type: 'clarification_needed',
        clarificationId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: 'tik-agent',
        questions: [
          {
            questionId: 'niche',
            questionType: 'single_choice',
            question: 'What niche?',
            options: [{ id: 'beauty', label: 'Beauty' }],
          },
        ],
        context: 'I need more info to find influencers',
        timeoutMs: 300000,
      }

      const result = ClarificationNeededSchema.safeParse(clarification)
      expect(result.success).toBe(true)
    })

    it('should reject empty questions array', () => {
      const invalid = {
        type: 'clarification_needed',
        clarificationId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: 'tik-agent',
        questions: [], // Empty - should fail
      }

      const result = ClarificationNeededSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject more than 4 questions', () => {
      const invalid = {
        type: 'clarification_needed',
        clarificationId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: 'tik-agent',
        questions: [
          { questionId: 'q1', questionType: 'yes_no', question: 'Q1?' },
          { questionId: 'q2', questionType: 'yes_no', question: 'Q2?' },
          { questionId: 'q3', questionType: 'yes_no', question: 'Q3?' },
          { questionId: 'q4', questionType: 'yes_no', question: 'Q4?' },
          { questionId: 'q5', questionType: 'yes_no', question: 'Q5?' }, // 5th - should fail
        ],
      }

      const result = ClarificationNeededSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('ClarificationResponseSchema', () => {
    it('should validate a response with string answers', () => {
      const response = {
        type: 'clarification_response',
        clarificationId: '550e8400-e29b-41d4-a716-446655440000',
        answers: [
          { questionId: 'niche', value: 'beauty' },
          { questionId: 'followers', value: '50000' },
        ],
      }

      const result = ClarificationResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('should validate a response with array answers (multiple_choice)', () => {
      const response = {
        type: 'clarification_response',
        clarificationId: '550e8400-e29b-41d4-a716-446655440000',
        answers: [
          { questionId: 'categories', value: ['beauty', 'lifestyle', 'fashion'] },
        ],
      }

      const result = ClarificationResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })

  describe('PlanProposedSchema', () => {
    it('should validate a plan proposal', () => {
      const plan: PlanProposed = {
        type: 'plan_proposed',
        planId: '550e8400-e29b-41d4-a716-446655440000',
        agentId: 'tik-agent',
        title: 'Finding beauty influencers',
        steps: [
          { id: '1', description: 'Search TikTok', status: 'pending' },
          { id: '2', description: 'Filter results', status: 'pending', dependencies: ['1'] },
          { id: '3', description: 'Verify accounts', status: 'pending', dependencies: ['2'] },
        ],
        autoStartAfterMs: 5000,
        requiresApproval: false,
        message: "Here's my plan...",
      }

      const result = PlanProposedSchema.safeParse(plan)
      expect(result.success).toBe(true)
    })
  })

  describe('PlanApprovalSchema', () => {
    it('should validate plan approval', () => {
      const approval = {
        type: 'plan_approval',
        planId: '550e8400-e29b-41d4-a716-446655440000',
        approved: true,
      }

      const result = PlanApprovalSchema.safeParse(approval)
      expect(result.success).toBe(true)
    })

    it('should validate plan rejection with modifications', () => {
      const rejection = {
        type: 'plan_approval',
        planId: '550e8400-e29b-41d4-a716-446655440000',
        approved: false,
        modifications: {
          skipStep: '2',
          addConstraint: 'Only verified accounts',
        },
      }

      const result = PlanApprovalSchema.safeParse(rejection)
      expect(result.success).toBe(true)
    })
  })

  describe('Helper functions', () => {
    it('createClarificationNeeded should create valid clarification', () => {
      const clarification = createClarificationNeeded('tik-agent', [
        {
          questionId: 'niche',
          questionType: 'single_choice',
          question: 'What niche?',
          options: [{ id: 'beauty', label: 'Beauty' }],
        },
      ], {
        context: 'Need more info',
        message: 'Please clarify',
      })

      expect(clarification.type).toBe('clarification_needed')
      expect(clarification.agentId).toBe('tik-agent')
      expect(clarification.questions).toHaveLength(1)
      expect(clarification.clarificationId).toBeDefined()

      const result = ClarificationNeededSchema.safeParse(clarification)
      expect(result.success).toBe(true)
    })

    it('createPlanProposed should create valid plan', () => {
      const plan = createPlanProposed('tik-agent', 'Search Plan', [
        { id: '1', description: 'Step 1' },
        { id: '2', description: 'Step 2' },
      ], {
        autoStartAfterMs: 3000,
        message: 'Ready to execute',
      })

      expect(plan.type).toBe('plan_proposed')
      expect(plan.agentId).toBe('tik-agent')
      expect(plan.title).toBe('Search Plan')
      expect(plan.steps).toHaveLength(2)
      expect(plan.steps[0].status).toBe('pending')
      expect(plan.autoStartAfterMs).toBe(3000)

      const result = PlanProposedSchema.safeParse(plan)
      expect(result.success).toBe(true)
    })
  })
})
