/**
 * Billing Detector Unit Tests
 *
 * Tests for the billing detection logic that identifies billable actions
 * from SSE events.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSessionEvents,
  processSSEEvent,
  detectBillingClaims,
  getPrimaryBillingClaim,
  SessionEvents,
} from '../../services/billing-detector'

describe('BillingDetector', () => {
  let session: SessionEvents

  beforeEach(() => {
    session = createSessionEvents()
  })

  describe('createSessionEvents', () => {
    it('should create an empty session events container', () => {
      expect(session.fileOutputs).toEqual([])
      expect(session.scheduledPosts).toEqual([])
      expect(session.monitorEvents).toEqual([])
      expect(session.sdkBillingEvents).toEqual([])
      expect(session.taskCompleted).toBe(false)
      expect(session.taskFailed).toBe(false)
    })
  })

  describe('processSSEEvent', () => {
    describe('SDK billing events', () => {
      it('should capture SDK billing event with complete action', () => {
        processSSEEvent(session, {
          type: 'billing_event',
          billing: {
            type: 'research',
            action: 'complete',
            metadata: { pages: 12 },
          },
        })

        expect(session.sdkBillingEvents).toHaveLength(1)
        expect(session.sdkBillingEvents[0]).toEqual({
          type: 'research',
          action: 'complete',
          metadata: { pages: 12 },
        })
      })

      it('should capture SDK billing event with start action', () => {
        processSSEEvent(session, {
          type: 'billing_event',
          billing: {
            type: 'ideation',
            action: 'start',
          },
        })

        expect(session.sdkBillingEvents).toHaveLength(1)
        expect(session.sdkBillingEvents[0].action).toBe('start')
      })
    })

    describe('File output events', () => {
      it('should capture file_output event with explicit type', () => {
        processSSEEvent(session, {
          type: 'file_output',
          fileType: 'report',
          name: 'analysis.html',
          format: 'html',
          size: 15000,
          content: '<html>...</html>',
        })

        expect(session.fileOutputs).toHaveLength(1)
        expect(session.fileOutputs[0]).toEqual({
          type: 'report',
          name: 'analysis.html',
          format: 'html',
          size: 15000,
          content: '<html>...</html>',
        })
      })

      it('should capture event with name and content (implicit file)', () => {
        processSSEEvent(session, {
          name: 'content-ideas.json',
          content: '{"ideas": []}',
        })

        expect(session.fileOutputs).toHaveLength(1)
        expect(session.fileOutputs[0].name).toBe('content-ideas.json')
      })

      it('should calculate size from content length when size not provided', () => {
        const content = 'x'.repeat(500)
        processSSEEvent(session, {
          name: 'data.txt',
          content,
        })

        expect(session.fileOutputs[0].size).toBe(500)
      })
    })

    describe('Scheduled post events', () => {
      it('should capture scheduled_post event', () => {
        processSSEEvent(session, {
          type: 'scheduled_post',
          platform: 'reddit',
          postId: 'post-123',
          scheduledTime: '2025-01-15T10:00:00Z',
        })

        expect(session.scheduledPosts).toHaveLength(1)
        expect(session.scheduledPosts[0]).toEqual({
          platform: 'reddit',
          postId: 'post-123',
          scheduledTime: '2025-01-15T10:00:00Z',
        })
      })
    })

    describe('Monitor events', () => {
      it('should capture monitor_created event', () => {
        processSSEEvent(session, {
          type: 'monitor_created',
          monitorId: 'mon-123',
          monitorType: 'keyword',
        })

        expect(session.monitorEvents).toHaveLength(1)
        expect(session.monitorEvents[0]).toEqual({
          monitorId: 'mon-123',
          action: 'created',
          type: 'keyword',
        })
      })

      it('should capture monitor_deleted event', () => {
        processSSEEvent(session, {
          type: 'monitor_deleted',
          monitorId: 'mon-456',
        })

        expect(session.monitorEvents).toHaveLength(1)
        expect(session.monitorEvents[0].action).toBe('deleted')
      })
    })

    describe('Task completion status', () => {
      it('should track task completion', () => {
        processSSEEvent(session, { state: 'completed' })
        expect(session.taskCompleted).toBe(true)
        expect(session.taskFailed).toBe(false)
      })

      it('should track task failure', () => {
        processSSEEvent(session, { state: 'failed' })
        expect(session.taskFailed).toBe(true)
        expect(session.taskCompleted).toBe(false)
      })
    })
  })

  describe('detectBillingClaims', () => {
    describe('SDK billing claims (highest priority)', () => {
      it('should return SDK billing claim when complete action is present', () => {
        session.sdkBillingEvents.push({
          type: 'research',
          action: 'complete',
          metadata: { dataPoints: 100 },
        })

        const claims = detectBillingClaims(session)

        expect(claims).toHaveLength(1)
        expect(claims[0]).toMatchObject({
          type: 'research',
          source: 'sdk',
          confidence: 1.0,
        })
      })

      it('should only use completed SDK events, not start events', () => {
        session.sdkBillingEvents.push({
          type: 'research',
          action: 'start',
        })

        const claims = detectBillingClaims(session)
        expect(claims).toHaveLength(0)
      })

      it('should not detect from outputs when SDK is authoritative', () => {
        session.sdkBillingEvents.push({
          type: 'research',
          action: 'complete',
        })
        session.fileOutputs.push({
          type: 'report',
          name: 'report.html',
          size: 20000,
        })

        const claims = detectBillingClaims(session)

        // Should only have SDK claim, not file output claim
        expect(claims).toHaveLength(1)
        expect(claims[0].source).toBe('sdk')
      })
    })

    describe('File output detection', () => {
      it('should detect research from report file output', () => {
        session.fileOutputs.push({
          type: 'report',
          name: 'competitor-analysis.html',
          format: 'html',
          size: 15000,
        })
        session.taskCompleted = true

        const claims = detectBillingClaims(session)

        expect(claims).toHaveLength(1)
        expect(claims[0]).toMatchObject({
          type: 'research',
          source: 'file_output',
          confidence: 0.9,
        })
      })

      it('should detect research from analysis file', () => {
        session.fileOutputs.push({
          type: 'analysis',
          name: 'market-insights.pdf',
          size: 25000,
        })

        const claims = detectBillingClaims(session)
        expect(claims[0].type).toBe('research')
      })

      it('should detect ideation from content file', () => {
        session.fileOutputs.push({
          type: 'content-calendar',
          name: 'social-content.json',
          size: 5000,
        })

        const claims = detectBillingClaims(session)
        expect(claims[0].type).toBe('ideation')
      })

      it('should detect ideation from ideas file', () => {
        session.fileOutputs.push({
          type: 'ideas',
          name: 'post-ideas.json',
          size: 3000,
        })

        const claims = detectBillingClaims(session)
        expect(claims[0].type).toBe('ideation')
      })

      it('should detect research from CSV files', () => {
        session.fileOutputs.push({
          type: 'unknown',
          name: 'data.csv',
          format: 'csv',
          size: 10000,
        })

        const claims = detectBillingClaims(session)
        expect(claims[0].type).toBe('research')
      })

      it('should detect research from XLSX files', () => {
        session.fileOutputs.push({
          type: 'unknown',
          name: 'spreadsheet.xlsx',
          format: 'xlsx',
          size: 8000,
        })

        const claims = detectBillingClaims(session)
        expect(claims[0].type).toBe('research')
      })

      it('should not bill for empty outputs', () => {
        session.fileOutputs.push({
          type: 'report',
          name: 'empty.html',
          size: 0,
        })

        const claims = detectBillingClaims(session)
        expect(claims).toHaveLength(0)
      })
    })


    describe('Scheduled post detection', () => {
      it('should detect auto_posting from scheduled posts', () => {
        session.scheduledPosts.push({
          platform: 'reddit',
          scheduledTime: '2025-01-15T10:00:00Z',
        })

        const claims = detectBillingClaims(session)

        expect(claims).toHaveLength(1)
        expect(claims[0]).toMatchObject({
          type: 'auto_posting',
          source: 'scheduled_post',
          confidence: 1.0,
        })
      })

      it('should include platform list in metadata', () => {
        session.scheduledPosts.push(
          { platform: 'reddit', scheduledTime: '2025-01-15T10:00:00Z' },
          { platform: 'twitter', scheduledTime: '2025-01-15T11:00:00Z' },
          { platform: 'reddit', scheduledTime: '2025-01-15T12:00:00Z' }
        )

        const claims = detectBillingClaims(session)
        expect(claims[0].metadata.platforms).toEqual(['reddit', 'twitter'])
      })
    })

    describe('Monitor detection', () => {
      it('should detect monitors from monitor_created events', () => {
        session.monitorEvents.push({
          monitorId: 'mon-123',
          action: 'created',
          type: 'keyword',
        })

        const claims = detectBillingClaims(session)

        expect(claims).toHaveLength(1)
        expect(claims[0]).toMatchObject({
          type: 'monitors',
          source: 'monitor_event',
          confidence: 1.0,
        })
      })

      it('should not bill for monitor deletions', () => {
        session.monitorEvents.push({
          monitorId: 'mon-456',
          action: 'deleted',
        })

        const claims = detectBillingClaims(session)
        expect(claims).toHaveLength(0)
      })

      it('should include monitor count in metadata', () => {
        session.monitorEvents.push(
          { monitorId: 'mon-1', action: 'created' },
          { monitorId: 'mon-2', action: 'created' },
          { monitorId: 'mon-3', action: 'deleted' }
        )

        const claims = detectBillingClaims(session)
        expect(claims[0].metadata.monitorCount).toBe(2)
      })
    })

    describe('Task failure handling', () => {
      it('should not bill for failed tasks with no output', () => {
        session.taskFailed = true
        session.sdkBillingEvents.push({
          type: 'research',
          action: 'start',
        })

        const claims = detectBillingClaims(session)
        expect(claims).toHaveLength(0)
      })

      it('should still bill for failed tasks with file output', () => {
        session.taskFailed = true
        session.fileOutputs.push({
          type: 'report',
          name: 'partial-report.html',
          size: 10000,
        })

        const claims = detectBillingClaims(session)
        expect(claims).toHaveLength(1)
      })
    })

    describe('Multiple claim types', () => {
      it('should return multiple claims for different action types', () => {
        // File output (research)
        session.fileOutputs.push({
          type: 'report',
          name: 'analysis.html',
          size: 15000,
        })

        // Scheduled posts
        session.scheduledPosts.push({
          platform: 'reddit',
          scheduledTime: '2025-01-15T10:00:00Z',
        })

        // Monitor created
        session.monitorEvents.push({
          monitorId: 'mon-123',
          action: 'created',
        })

        const claims = detectBillingClaims(session)

        expect(claims).toHaveLength(3)
        expect(claims.map(c => c.type).sort()).toEqual(['auto_posting', 'monitors', 'research'])
      })
    })
  })

  describe('getPrimaryBillingClaim', () => {
    it('should return null when no claims', () => {
      const claim = getPrimaryBillingClaim(session)
      expect(claim).toBeNull()
    })

    it('should return highest confidence claim', () => {
      // SDK claim (confidence 1.0)
      session.sdkBillingEvents.push({
        type: 'research',
        action: 'complete',
      })

      const claim = getPrimaryBillingClaim(session)
      expect(claim?.confidence).toBe(1.0)
    })

    it('should prefer SDK over file output', () => {
      session.sdkBillingEvents.push({
        type: 'ideation',
        action: 'complete',
      })
      // This won't be detected since SDK is authoritative
      session.fileOutputs.push({
        type: 'report',
        name: 'report.html',
        size: 20000,
      })

      const claim = getPrimaryBillingClaim(session)
      expect(claim?.source).toBe('sdk')
      expect(claim?.type).toBe('ideation')
    })
  })
})
