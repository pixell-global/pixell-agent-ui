/**
 * Credit Manager Tests
 */

// Mock the database BEFORE importing modules
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  set: jest.fn(),
  values: jest.fn(),
  limit: jest.fn(),
  $returningId: jest.fn(),
}

jest.mock('@pixell/db-mysql', () => ({
  db: mockDb,
}))

jest.mock('@pixell/db-mysql/schema', () => ({
  creditBalances: { orgId: 'orgId' },
  billableActions: { orgId: 'orgId' },
}))

import {
  getCreditBalance,
  initializeCreditBalance,
  checkCredits,
  deductCredits,
  addTopupCredits,
  resetCreditsForNewPeriod,
  getCreditUsagePercentage,
} from '../credit-manager'

describe('Credit Manager', () => {
  const mockOrgId = 'org-123'
  const mockUserId = 'user-456'
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCreditBalance', () => {
    it('should return credit balance for organization', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50,
        includedMedium: 20,
        includedLarge: 10,
        includedXl: 5,
        usedSmall: 10,
        usedMedium: 5,
        usedLarge: 2,
        usedXl: 1,
        topupCredits: '100.00',
        topupCreditsUsed: '25.50',
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
        autoTopupEnabled: false,
        autoTopupThreshold: 50,
        autoTopupAmount: 500,
        lastWarning80At: null,
        lastWarning100At: null,
        lastResetAt: now,
        updatedAt: now,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await getCreditBalance(mockOrgId)
      expect(result).toEqual(mockBalance)
    })

    it('should return null when no balance found', async () => {
      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      })

      const result = await getCreditBalance(mockOrgId)
      expect(result).toBeNull()
    })
  })

  describe('initializeCreditBalance', () => {
    it('should create initial balance for free tier', async () => {
      const insertMock = jest.fn().mockResolvedValue({})
      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: insertMock,
      })

      await initializeCreditBalance(mockOrgId, 'free', now, periodEnd)

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: mockOrgId,
          includedSmall: 10,
          includedMedium: 4,
          includedLarge: 2,
          includedXl: 1,
          usedSmall: 0,
          usedMedium: 0,
          usedLarge: 0,
          usedXl: 0,
          topupCredits: '0',
          topupCreditsUsed: '0',
        })
      )
    })

    it('should create initial balance for starter tier', async () => {
      const insertMock = jest.fn().mockResolvedValue({})
      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: insertMock,
      })

      await initializeCreditBalance(mockOrgId, 'starter', now, periodEnd)

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          includedSmall: 50,
          includedMedium: 20,
          includedLarge: 10,
          includedXl: 5,
        })
      )
    })

    it('should set billing period correctly', async () => {
      const insertMock = jest.fn().mockResolvedValue({})
      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: insertMock,
      })

      await initializeCreditBalance(mockOrgId, 'pro', now, periodEnd)

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          billingPeriodStart: now,
          billingPeriodEnd: periodEnd,
        })
      )
    })
  })

  describe('checkCredits', () => {
    it('should allow action when sufficient tier credits available', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50,
        usedSmall: 10,
        includedMedium: 20,
        usedMedium: 5,
        includedLarge: 10,
        usedLarge: 2,
        includedXl: 5,
        usedXl: 1,
        topupCredits: '0',
        topupCreditsUsed: '0',
        billingPeriodStart: new Date(now.getTime() - 1000),
        billingPeriodEnd: new Date(now.getTime() + 1000),
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await checkCredits(mockOrgId, 'small')
      expect(result.allowed).toBe(true)
      expect(result.remainingCredits?.small).toBe(40)
    })

    it('should allow action when tier credits exhausted but topup available', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedMedium: 20,
        usedMedium: 20, // All tier credits used
        includedSmall: 50,
        usedSmall: 50,
        includedLarge: 10,
        usedLarge: 10,
        includedXl: 5,
        usedXl: 5,
        topupCredits: '100.00', // But has top-up
        topupCreditsUsed: '0',
        billingPeriodStart: new Date(now.getTime() - 1000),
        billingPeriodEnd: new Date(now.getTime() + 1000),
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await checkCredits(mockOrgId, 'medium') // Costs 2.5 credits
      expect(result.allowed).toBe(true)
      expect(result.remainingCredits?.topup).toBe(100)
    })

    it('should deny action when no credits available', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50,
        usedSmall: 50,
        includedMedium: 20,
        usedMedium: 20,
        includedLarge: 10,
        usedLarge: 10,
        includedXl: 5,
        usedXl: 5,
        topupCredits: '0',
        topupCreditsUsed: '0',
        billingPeriodStart: new Date(now.getTime() - 1000),
        billingPeriodEnd: new Date(now.getTime() + 1000),
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await checkCredits(mockOrgId, 'small')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Insufficient credits')
    })

    it('should deny action when insufficient topup credits', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedXl: 5,
        usedXl: 5,
        includedSmall: 50,
        usedSmall: 50,
        includedMedium: 20,
        usedMedium: 20,
        includedLarge: 10,
        usedLarge: 10,
        topupCredits: '10.00',
        topupCreditsUsed: '0',
        billingPeriodStart: new Date(now.getTime() - 1000),
        billingPeriodEnd: new Date(now.getTime() + 1000),
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await checkCredits(mockOrgId, 'xl') // Costs 15 credits, only 10 available
      expect(result.allowed).toBe(false)
    })

    it('should deny action when balance not found', async () => {
      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      })

      const result = await checkCredits(mockOrgId, 'small')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No credit balance found')
    })

    it('should deny action when outside billing period', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50,
        usedSmall: 10,
        includedMedium: 20,
        usedMedium: 5,
        includedLarge: 10,
        usedLarge: 2,
        includedXl: 5,
        usedXl: 1,
        topupCredits: '0',
        topupCreditsUsed: '0',
        billingPeriodStart: new Date(now.getTime() + 10000), // Future
        billingPeriodEnd: new Date(now.getTime() + 100000),
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await checkCredits(mockOrgId, 'small')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Billing period mismatch')
    })
  })

  describe('deductCredits', () => {
    it('should deduct tier credits when available', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50,
        usedSmall: 10,
        includedMedium: 20,
        usedMedium: 5,
        includedLarge: 10,
        usedLarge: 2,
        includedXl: 5,
        usedXl: 1,
        topupCredits: '0',
        topupCreditsUsed: '0',
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnThis(),
        $returningId: jest.fn().mockResolvedValue({ id: 123 }),
      })

      const updateMock = jest.fn().mockReturnThis()
      ;(mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: updateMock.mockResolvedValue({}),
      })

      const result = await deductCredits(mockOrgId, mockUserId, 'small', {
        actionKey: 'test-action',
      })

      expect(result.success).toBe(true)
      expect(result.billableActionId).toBe(123)
    })

    it('should deduct topup credits when tier credits exhausted', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedMedium: 20,
        usedMedium: 20, // All used
        includedSmall: 50,
        usedSmall: 50,
        includedLarge: 10,
        usedLarge: 10,
        includedXl: 5,
        usedXl: 5,
        topupCredits: '100.00',
        topupCreditsUsed: '10.00',
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnThis(),
        $returningId: jest.fn().mockResolvedValue({ id: 123 }),
      })

      const updateMock = jest.fn().mockReturnThis()
      ;(mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: updateMock.mockResolvedValue({}),
      })

      const result = await deductCredits(mockOrgId, mockUserId, 'medium', {})
      expect(result.success).toBe(true)
    })

    it('should fail when insufficient credits', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50,
        usedSmall: 50,
        includedMedium: 20,
        usedMedium: 20,
        includedLarge: 10,
        usedLarge: 10,
        includedXl: 5,
        usedXl: 5,
        topupCredits: '0',
        topupCreditsUsed: '0',
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const result = await deductCredits(mockOrgId, mockUserId, 'small', {})
      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient credits')
    })

    it('should create billable action record', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedLarge: 10,
        usedLarge: 2,
        includedSmall: 50,
        usedSmall: 10,
        includedMedium: 20,
        usedMedium: 5,
        includedXl: 5,
        usedXl: 1,
        topupCredits: '0',
        topupCreditsUsed: '0',
        billingPeriodStart: now,
        billingPeriodEnd: periodEnd,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const insertMock = jest.fn().mockReturnThis()
      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: insertMock,
        $returningId: jest.fn().mockResolvedValue({ id: 456 }),
      })

      ;(mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue({}),
      })

      await deductCredits(mockOrgId, mockUserId, 'large', {
        agentId: 'agent-789',
        agentName: 'Test Agent',
        actionKey: 'large-action',
        description: 'Test large action',
        idempotencyKey: 'idem-123',
      })

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: mockOrgId,
          userId: mockUserId,
          actionTier: 'large',
          creditsUsed: '5',
          agentId: 'agent-789',
          agentName: 'Test Agent',
          actionKey: 'large-action',
          description: 'Test large action',
          idempotencyKey: 'idem-123',
        })
      )
    })
  })

  describe('addTopupCredits', () => {
    it('should add credits to existing balance', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        topupCredits: '50.00',
        topupCreditsUsed: '10.00',
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const updateMock = jest.fn().mockReturnThis()
      ;(mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: updateMock.mockResolvedValue({}),
      })

      await addTopupCredits(mockOrgId, 100)

      expect(updateMock).toHaveBeenCalled()
    })

    it('should throw error when balance not found', async () => {
      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      })

      await expect(addTopupCredits(mockOrgId, 100)).rejects.toThrow('No credit balance found')
    })
  })

  describe('resetCreditsForNewPeriod', () => {
    it('should reset tier credits and period dates', async () => {
      const newStart = new Date()
      const newEnd = new Date(newStart.getTime() + 30 * 24 * 60 * 60 * 1000)

      const updateMock = jest.fn().mockResolvedValue({})
      ;(mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: updateMock,
      })

      await resetCreditsForNewPeriod(mockOrgId, 'pro', newStart, newEnd)

      expect(updateMock).toHaveBeenCalled()
    })
  })

  describe('getCreditUsagePercentage', () => {
    it('should calculate usage percentage correctly', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 50, // 50 * 1 = 50 credits
        usedSmall: 25, // 25 * 1 = 25 credits used
        includedMedium: 20, // 20 * 2.5 = 50 credits
        usedMedium: 10, // 10 * 2.5 = 25 credits used
        includedLarge: 10, // 10 * 5 = 50 credits
        usedLarge: 0,
        includedXl: 5, // 5 * 15 = 75 credits
        usedXl: 0,
        // Total: 225 credits, used: 50 = 22.22%
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const percentage = await getCreditUsagePercentage(mockOrgId)
      expect(percentage).toBeCloseTo(22.22, 1)
    })

    it('should return 0 when balance not found', async () => {
      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      })

      const percentage = await getCreditUsagePercentage(mockOrgId)
      expect(percentage).toBe(0)
    })

    it('should return 0 when no credits included', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 0,
        usedSmall: 0,
        includedMedium: 0,
        usedMedium: 0,
        includedLarge: 0,
        usedLarge: 0,
        includedXl: 0,
        usedXl: 0,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const percentage = await getCreditUsagePercentage(mockOrgId)
      expect(percentage).toBe(0)
    })

    it('should cap at 100% when overused', async () => {
      const mockBalance = {
        orgId: mockOrgId,
        includedSmall: 10,
        usedSmall: 20, // Over limit
        includedMedium: 4,
        usedMedium: 0,
        includedLarge: 2,
        usedLarge: 0,
        includedXl: 1,
        usedXl: 0,
      }

      ;(mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBalance]),
      })

      const percentage = await getCreditUsagePercentage(mockOrgId)
      expect(percentage).toBe(100)
    })
  })
})
