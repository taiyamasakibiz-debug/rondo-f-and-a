import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CertifiedCard } from './CertifiedCard'

describe('CertifiedCard', () => {
  it('認定の種類とラボの名前を出し、バッジを押す演出がある', () => {
    render(<CertifiedCard tier="gold" labName="CVP ラボ" />)
    expect(screen.getByText('CERTIFIED')).toBeInTheDocument()
    expect(screen.getByText('（ゴールド認定）')).toBeInTheDocument()
    expect(screen.getByText('CVP ラボ')).toBeInTheDocument()
    expect(screen.getByTestId('burst')).toHaveClass('text-ember')
  })
})
