import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CertifiedCard } from './CertifiedCard'

describe('CertifiedCard', () => {
  it('認定の種類と、修了した Stage を出し、バッジを押す演出がある', () => {
    render(<CertifiedCard tier="gold" caption="Stage 3 修了" />)
    expect(screen.getByText('CERTIFIED')).toBeInTheDocument()
    expect(screen.getByText('（ゴールド認定）')).toBeInTheDocument()
    expect(screen.getByText('Stage 3 修了')).toBeInTheDocument()
    expect(screen.getByTestId('burst')).toHaveClass('text-ember')
  })
})
