/**
 * Tests for HtmlViewer component
 *
 * Tests the sandboxed HTML report viewer used for displaying agent-generated
 * HTML reports with full styling. Verifies rendering, zoom controls, and
 * basic functionality.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { HtmlViewer } from '../HtmlViewer'

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock URL object methods
const mockCreateObjectURL = jest.fn(() => 'blob:test-url')
const mockRevokeObjectURL = jest.fn()
global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

describe('HtmlViewer', () => {
  const sampleHtmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Report</title>
        <style>
          body { font-family: Arial, sans-serif; }
          .header { background: #1a1a1a; color: white; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="header"><h1>Reddit Analysis Report</h1></div>
        <p>Analysis of 500 posts.</p>
      </body>
    </html>
  `

  beforeEach(() => {
    jest.clearAllMocks()
    // Default successful response
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, content: sampleHtmlContent }),
    })

    // Reset fullscreen state
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner while fetching content', async () => {
      // Create a promise that won't resolve immediately
      let resolvePromise: (value: unknown) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      ;(global.fetch as jest.Mock).mockReturnValue(pendingPromise)

      render(<HtmlViewer path="/reports/analysis.html" />)

      expect(screen.getByText('Loading report...')).toBeInTheDocument()

      // Cleanup
      act(() => {
        resolvePromise!({
          ok: true,
          json: () => Promise.resolve({ success: true, content: sampleHtmlContent }),
        })
      })
    })

    it('should fetch content from correct API endpoint', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/content?path=%2Freports%2Fanalysis.html'
        )
      })
    })

    it('should encode special characters in path', async () => {
      render(<HtmlViewer path="/reports/my report (final).html" />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/content?path=%2Freports%2Fmy%20report%20(final).html'
        )
      })
    })
  })

  describe('Content Rendering', () => {
    it('should render HTML content in sandboxed iframe', async () => {
      render(<HtmlViewer path="/reports/analysis.html" title="Analysis Report" />)

      await waitFor(() => {
        const iframe = document.querySelector('iframe')
        expect(iframe).toBeInTheDocument()
        expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin')
        expect(iframe).toHaveAttribute('srcDoc', sampleHtmlContent)
        expect(iframe).toHaveAttribute('title', 'Analysis Report')
      })
    })

    it('should display file title in toolbar', async () => {
      render(<HtmlViewer path="/reports/analysis.html" title="Custom Title" />)

      await waitFor(() => {
        expect(screen.getByText('Custom Title')).toBeInTheDocument()
      })
    })

    it('should extract filename from path if no title provided', async () => {
      render(<HtmlViewer path="/reports/my-analysis.html" />)

      await waitFor(() => {
        expect(screen.getByText('my-analysis.html')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })

      render(<HtmlViewer path="/reports/missing.html" />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load file: Not Found')).toBeInTheDocument()
      })
    })

    it('should display error when API returns error response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'File not found' }),
      })

      render(<HtmlViewer path="/reports/missing.html" />)

      await waitFor(() => {
        expect(screen.getByText('File not found')).toBeInTheDocument()
      })
    })

    it('should display error when fetch throws', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('should show retry button on error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      })

      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i })
        expect(retryButton).toBeInTheDocument()
      })
    })
  })

  describe('Zoom Controls', () => {
    it('should start at 100% zoom', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument()
      })
    })

    it('should increase zoom when zoom in clicked', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      const zoomInButton = screen.getByTitle('Zoom in')
      fireEvent.click(zoomInButton)

      expect(screen.getByText('125%')).toBeInTheDocument()
    })

    it('should decrease zoom when zoom out clicked', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      const zoomOutButton = screen.getByTitle('Zoom out')
      fireEvent.click(zoomOutButton)

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('should not zoom beyond 200%', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      const zoomInButton = screen.getByTitle('Zoom in')

      // Click zoom in 5 times (100 -> 125 -> 150 -> 175 -> 200)
      for (let i = 0; i < 5; i++) {
        fireEvent.click(zoomInButton)
      }

      expect(screen.getByText('200%')).toBeInTheDocument()
      expect(zoomInButton).toBeDisabled()
    })

    it('should not zoom below 50%', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      const zoomOutButton = screen.getByTitle('Zoom out')

      // Click zoom out 3 times (100 -> 75 -> 50)
      for (let i = 0; i < 3; i++) {
        fireEvent.click(zoomOutButton)
      }

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(zoomOutButton).toBeDisabled()
    })
  })

  describe('Toolbar Controls', () => {
    it('should have download button', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      expect(screen.getByTitle('Download')).toBeInTheDocument()
    })

    it('should have print button', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      expect(screen.getByTitle('Print')).toBeInTheDocument()
    })

    it('should have refresh button', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      expect(screen.getByTitle('Refresh')).toBeInTheDocument()
    })

    it('should have fullscreen button', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      expect(screen.getByTitle('Fullscreen')).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    it('should refresh content when refresh clicked', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        expect(document.querySelector('iframe')).toBeInTheDocument()
      })

      // Clear mock to check second call
      ;(global.fetch as jest.Mock).mockClear()
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, content: '<html>Updated</html>' }),
      })

      const refreshButton = screen.getByTitle('Refresh')
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Security', () => {
    it('should have sandbox attribute on iframe', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        const iframe = document.querySelector('iframe')
        expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin')
      })
    })

    it('should not allow scripts in sandboxed iframe', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        const iframe = document.querySelector('iframe')
        const sandbox = iframe?.getAttribute('sandbox')
        expect(sandbox).not.toContain('allow-scripts')
      })
    })

    it('should use srcdoc instead of src for content', async () => {
      render(<HtmlViewer path="/reports/analysis.html" />)

      await waitFor(() => {
        const iframe = document.querySelector('iframe')
        expect(iframe).toHaveAttribute('srcDoc')
        expect(iframe).not.toHaveAttribute('src')
      })
    })
  })

  describe('Styling and Layout', () => {
    it('should apply custom className', async () => {
      render(
        <HtmlViewer path="/reports/analysis.html" className="custom-viewer-class" />
      )

      await waitFor(() => {
        const container = document.querySelector('.custom-viewer-class')
        expect(container).toBeInTheDocument()
      })
    })
  })
})

describe('HtmlViewer Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle complete report viewing workflow', async () => {
    const agentReport = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui; margin: 0; padding: 0; }
            .report-header { background: #667eea; color: white; padding: 40px; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>Market Analysis Report</h1>
          </div>
        </body>
      </html>
    `

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, content: agentReport }),
    })

    render(<HtmlViewer path="/workspace/reports/market-analysis-2024-q4.html" />)

    // Verify loading state
    expect(screen.getByText('Loading report...')).toBeInTheDocument()

    // Wait for content to load
    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeInTheDocument()
    })

    // Verify title extraction from path
    expect(screen.getByText('market-analysis-2024-q4.html')).toBeInTheDocument()

    // Verify all toolbar controls are present
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument()
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument()
    expect(screen.getByTitle('Refresh')).toBeInTheDocument()
    expect(screen.getByTitle('Print')).toBeInTheDocument()
    expect(screen.getByTitle('Download')).toBeInTheDocument()
    expect(screen.getByTitle('Fullscreen')).toBeInTheDocument()

    // Verify iframe has proper security attributes
    const iframe = document.querySelector('iframe')
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin')
    expect(iframe).toHaveAttribute('srcDoc', agentReport)

    // Test zoom workflow
    fireEvent.click(screen.getByTitle('Zoom in'))
    expect(screen.getByText('125%')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Zoom out'))
    fireEvent.click(screen.getByTitle('Zoom out'))
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
