import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeSwitcher } from '../../../src/renderer/src/components/ThemeSwitcher'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.style.removeProperty('--color-accent')
})

describe('ThemeSwitcher', () => {
  it('renders a "Change theme" button', () => {
    render(<ThemeSwitcher />)
    expect(screen.getByRole('button', { name: /change theme/i })).toBeInTheDocument()
  })

  it('popover is not visible initially', () => {
    render(<ThemeSwitcher />)
    expect(screen.queryByRole('button', { name: /teal/i })).not.toBeInTheDocument()
  })

  it('clicking the button opens the accent color popover', async () => {
    render(<ThemeSwitcher />)
    await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
    expect(screen.getByRole('button', { name: /teal/i })).toBeInTheDocument()
  })

  it('selecting an accent color sets the CSS custom property', async () => {
    render(<ThemeSwitcher />)
    await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
    await userEvent.click(screen.getByRole('button', { name: /indigo/i }))
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#818cf8')
  })

  it('selecting an accent color saves it to localStorage', async () => {
    render(<ThemeSwitcher />)
    await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
    await userEvent.click(screen.getByRole('button', { name: /amber/i }))
    expect(localStorage.getItem('opencomic-accent')).toBe('#fbbf24')
  })

  it('selecting an accent color closes the popover', async () => {
    render(<ThemeSwitcher />)
    await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
    await userEvent.click(screen.getByRole('button', { name: /rose/i }))
    expect(screen.queryByRole('button', { name: /teal/i })).not.toBeInTheDocument()
  })
})
