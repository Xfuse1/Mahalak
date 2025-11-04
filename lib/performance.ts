// Performance monitoring utilities
export function measurePerformance(metricName: string, callback: () => void) {
  if (typeof window === 'undefined') return

  const startTime = performance.now()
  callback()
  const endTime = performance.now()
  const duration = endTime - startTime

  if (process.env.NODE_ENV === 'development') {
    console.log(`⚡ ${metricName}: ${duration.toFixed(2)}ms`)
  }
}

// Report Web Vitals
export function reportWebVitals(metric: any) {
  if (process.env.NODE_ENV === 'development') {
    console.log(metric)
  }
  
  // You can send to analytics service here
  // Example: sendToAnalytics(metric)
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
