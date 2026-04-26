import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { TopNav } from '../../../src/renderer/src/components/TopNav'
import { useReaderStore } from '../../../src/renderer/src/store/reader'

const baseProps = {
  activeSection: 'library' as const,
  onSectionChange: vi.fn(),
  onAddFolder: vi.fn(),
}

beforeEach(() => {
  act(() => useReaderStore.setState({ scrollMode: false }))
})

describe('TopNav – settings dropdown', () => {
  it('renders a settings/gear button', () => {
    render(<TopNav {...baseProps} />)
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('dropdown is not visible initially', () => {
    render(<TopNav {...baseProps} />)
    expect(screen.queryByText('Reader Settings')).not.toBeInTheDocument()
  })

  it('clicking gear opens the dropdown', async () => {
    render(<TopNav {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByText('Reader Settings')).toBeInTheDocument()
  })

  it('dropdown shows Page and Scroll options', async () => {
    render(<TopNav {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('button', { name: 'Page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scroll' })).toBeInTheDocument()
  })

  it('clicking Scroll in dropdown sets scrollMode to true', async () => {
    render(<TopNav {...baseProps} />)
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Scroll' }))
    expect(useReaderStore.getState().scrollMode).toBe(true)
  })

  it('clicking outside closes the dropdown', async () => {
    render(
      <div>
        <TopNav {...baseProps} />
        <div data-testid="outside">outside</div>
      </div>
    )
    await userEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByText('Reader Settings')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('outside'))
    expect(screen.queryByText('Reader Settings')).not.toBeInTheDocument()
  })
})
