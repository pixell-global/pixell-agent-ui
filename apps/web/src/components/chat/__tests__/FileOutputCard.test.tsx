/**
 * Tests for FileOutputCard component
 *
 * Tests the UI component that displays agent-generated file outputs in chat.
 * Verifies correct rendering of file information, icons, and action buttons.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FileOutputCard } from '../FileOutputCard'
import type { FileOutput } from '@/types'

// Mock fetch for download functionality
global.fetch = jest.fn()

describe('FileOutputCard', () => {
  const mockOnOpen = jest.fn()
  const mockOnDownload = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'file content' }),
    })
  })

  describe('Rendering', () => {
    it('should render file output with all properties', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
        size: 12345,
        summary: 'Comprehensive analysis report',
      }

      render(<FileOutputCard output={output} onOpen={mockOnOpen} />)

      expect(screen.getByText('analysis.html')).toBeInTheDocument()
      // Format is displayed lowercase but with CSS uppercase transform
      expect(screen.getByText('html')).toBeInTheDocument()
      expect(screen.getByText('Comprehensive analysis report')).toBeInTheDocument()
      expect(screen.getByText('HTML Report')).toBeInTheDocument()
      expect(screen.getByText('12.1 KB')).toBeInTheDocument()
    })

    it('should render without optional properties', () => {
      const output: FileOutput = {
        type: 'data',
        path: '/exports/data.csv',
        name: 'data.csv',
        format: 'csv',
      }

      render(<FileOutputCard output={output} />)

      expect(screen.getByText('data.csv')).toBeInTheDocument()
      // Format is displayed lowercase but with CSS uppercase transform
      expect(screen.getByText('csv')).toBeInTheDocument()
      expect(screen.getByText('CSV Data')).toBeInTheDocument()
      // Size should not be shown if not provided
      expect(screen.queryByText('KB')).not.toBeInTheDocument()
    })

    it('should display correct format labels for different file types', () => {
      const formats: Array<{ format: FileOutput['format']; label: string }> = [
        { format: 'html', label: 'HTML Report' },
        { format: 'csv', label: 'CSV Data' },
        { format: 'json', label: 'JSON Data' },
        { format: 'txt', label: 'Text File' },
        { format: 'pdf', label: 'PDF Document' },
        { format: 'xlsx', label: 'Excel Spreadsheet' },
      ]

      formats.forEach(({ format, label }) => {
        const output: FileOutput = {
          type: 'report',
          path: `/test/file.${format}`,
          name: `file.${format}`,
          format,
        }

        const { unmount } = render(<FileOutputCard output={output} />)
        expect(screen.getByText(label)).toBeInTheDocument()
        unmount()
      })
    })

    it('should format file sizes correctly', () => {
      const sizes = [
        { bytes: 512, expected: '512 B' },
        { bytes: 1024, expected: '1.0 KB' },
        { bytes: 10240, expected: '10.0 KB' },
        { bytes: 1048576, expected: '1.0 MB' },
        { bytes: 2621440, expected: '2.5 MB' },
      ]

      sizes.forEach(({ bytes, expected }) => {
        const output: FileOutput = {
          type: 'data',
          path: '/test/file.txt',
          name: 'file.txt',
          format: 'txt',
          size: bytes,
        }

        const { unmount } = render(<FileOutputCard output={output} />)
        expect(screen.getByText(expected)).toBeInTheDocument()
        unmount()
      })
    })

    it('should truncate long summary text', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/test/file.html',
        name: 'file.html',
        format: 'html',
        summary: 'This is a very long summary that should be truncated to prevent the card from becoming too tall and breaking the layout of the chat interface',
      }

      render(<FileOutputCard output={output} />)

      const summaryElement = screen.getByText(/This is a very long summary/)
      expect(summaryElement).toHaveClass('line-clamp-1')
    })
  })

  describe('Actions', () => {
    it('should call onOpen when Open button is clicked', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
      }

      render(<FileOutputCard output={output} onOpen={mockOnOpen} />)

      const openButton = screen.getByTitle('Open in viewer')
      fireEvent.click(openButton)

      expect(mockOnOpen).toHaveBeenCalledWith('/reports/analysis.html')
    })

    it('should call onDownload when Download button is clicked', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
      }

      render(<FileOutputCard output={output} onDownload={mockOnDownload} />)

      const downloadButton = screen.getByTitle('Download')
      fireEvent.click(downloadButton)

      expect(mockOnDownload).toHaveBeenCalledWith('/reports/analysis.html')
    })

    it('should not show Open button if onOpen is not provided', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
      }

      render(<FileOutputCard output={output} />)

      expect(screen.queryByTitle('Open in viewer')).not.toBeInTheDocument()
    })

    it('should trigger default download via API when onDownload is not provided', async () => {
      // Mock URL.createObjectURL and createElement
      const mockCreateObjectURL = jest.fn(() => 'blob:test-url')
      const mockRevokeObjectURL = jest.fn()
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      const output: FileOutput = {
        type: 'data',
        path: '/exports/data.csv',
        name: 'data.csv',
        format: 'csv',
      }

      render(<FileOutputCard output={output} />)

      const downloadButton = screen.getByTitle('Download')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/files/content?path=%2Fexports%2Fdata.csv'
        )
      })
    })

    it('should disable buttons when isLoading is true', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
      }

      render(<FileOutputCard output={output} onOpen={mockOnOpen} isLoading={true} />)

      const openButton = screen.getByTitle('Open in viewer')
      const downloadButton = screen.getByTitle('Download')

      expect(openButton).toBeDisabled()
      expect(downloadButton).toBeDisabled()
    })

    it('should show loading spinner when isLoading is true', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
      }

      render(<FileOutputCard output={output} onOpen={mockOnOpen} isLoading={true} />)

      // The loading spinner should be present in the Open button
      const openButton = screen.getByTitle('Open in viewer')
      expect(openButton.querySelector('svg.animate-spin')).toBeInTheDocument()
    })
  })

  describe('Styling and Layout', () => {
    it('should apply custom className', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/test/file.html',
        name: 'file.html',
        format: 'html',
      }

      const { container } = render(
        <FileOutputCard output={output} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should render card with correct base styles', () => {
      const output: FileOutput = {
        type: 'report',
        path: '/test/file.html',
        name: 'file.html',
        format: 'html',
      }

      const { container } = render(<FileOutputCard output={output} />)

      // Card should have white/10 border (dark theme styling)
      expect(container.firstChild).toHaveClass('bg-white/5', 'border-white/10')
    })
  })

  describe('Error Handling', () => {
    it('should handle download failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const output: FileOutput = {
        type: 'data',
        path: '/exports/data.csv',
        name: 'data.csv',
        format: 'csv',
      }

      render(<FileOutputCard output={output} />)

      const downloadButton = screen.getByTitle('Download')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Download failed:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('should handle API response failure gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      })

      const output: FileOutput = {
        type: 'data',
        path: '/exports/missing.csv',
        name: 'missing.csv',
        format: 'csv',
      }

      render(<FileOutputCard output={output} />)

      const downloadButton = screen.getByTitle('Download')
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Download failed:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })
  })
})

describe('FileOutputCard Integration', () => {
  it('should work correctly in a list of outputs', () => {
    const outputs: FileOutput[] = [
      {
        type: 'report',
        path: '/reports/analysis.html',
        name: 'analysis.html',
        format: 'html',
        summary: 'Main report',
      },
      {
        type: 'data',
        path: '/exports/raw_data.csv',
        name: 'raw_data.csv',
        format: 'csv',
        summary: 'Raw data export',
      },
      {
        type: 'data',
        path: '/exports/processed.json',
        name: 'processed.json',
        format: 'json',
        summary: 'Processed data',
      },
    ]

    render(
      <div>
        {outputs.map((output, index) => (
          <FileOutputCard key={index} output={output} />
        ))}
      </div>
    )

    expect(screen.getByText('analysis.html')).toBeInTheDocument()
    expect(screen.getByText('raw_data.csv')).toBeInTheDocument()
    expect(screen.getByText('processed.json')).toBeInTheDocument()

    expect(screen.getByText('HTML Report')).toBeInTheDocument()
    expect(screen.getByText('CSV Data')).toBeInTheDocument()
    expect(screen.getByText('JSON Data')).toBeInTheDocument()
  })
})
