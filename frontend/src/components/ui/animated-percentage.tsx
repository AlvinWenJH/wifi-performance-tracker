import { useEffect, useState, useRef } from 'react'

interface AnimatedPercentageProps {
  value: number
  duration?: number
  decimals?: number
  className?: string
}

export function AnimatedPercentage({
  value,
  duration = 1200,
  decimals = 1,
  className = ''
}: AnimatedPercentageProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef<number>(value)

  useEffect(() => {
    if (value === displayValue) return

    setIsAnimating(true)
    startValueRef.current = displayValue
    startTimeRef.current = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - (startTimeRef.current || now)
      const progress = Math.min(elapsed / duration, 1)

      // Smooth easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)

      const currentValue = startValueRef.current + (value - startValueRef.current) * easeOutQuart
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
        setIsAnimating(false)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration, displayValue])

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const formatValue = (val: number) => {
    return val.toFixed(decimals)
  }

  return (
    <span className={`${className} ${isAnimating ? 'text-primary' : ''}`}>
      {formatValue(displayValue)}%
    </span>
  )
}