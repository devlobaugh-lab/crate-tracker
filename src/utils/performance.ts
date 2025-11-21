/**
 * Performance monitoring utilities
 * Tracks basic performance metrics using native browser APIs
 */

import logger from './logger';

// Bundle size and navigation timing tracking
export function logPerformanceMetrics(): void {
  // Use performance API if available to track navigation timing
  if (typeof performance !== 'undefined' && performance.timing) {
    const timing = performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
    const firstPaint = timing.responseStart - timing.navigationStart;

    logger.log('📊 Performance metrics:', {
      'Time to First Byte': `${firstPaint}ms`,
      'DOM Ready': `${domReady}ms`,
      'Page Load': `${loadTime}ms`,
    });
  }

  // Log bundle information if available
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    logger.log('📦 Bundle info:', {
      mode: import.meta.env.MODE,
      dev: import.meta.env.DEV,
      prod: import.meta.env.PROD,
    });
  }
}

// Memory usage tracking (for debugging)
export function logMemoryUsage(): void {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory;
    logger.log('🧠 Memory usage:', {
      used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
      total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
      limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
    });
  }
}

// Performance observer for long tasks
export function initLongTaskObserver(): void {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            // Tasks longer than 50ms
            logger.warn('🐌 Long task detected:', {
              duration: `${entry.duration}ms`,
              startTime: entry.startTime,
            });
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      logger.warn('Long task observer not available:', error);
    }
  }
}

// Basic Core Web Vitals using Performance Observer
export function initBasicWebVitalsTracking(): void {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      // Track Largest Contentful Paint
      const lcpObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        logger.log('📊 LCP (Largest Contentful Paint):', `${lastEntry.startTime}ms`);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // Track First Input Delay
      const fidObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          logger.log(
            '📊 FID (First Input Delay):',
            `${(entry as any).processingStart - entry.startTime}ms`
          );
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Track Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        logger.log('📊 CLS (Cumulative Layout Shift):', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      logger.warn('Basic Web Vitals tracking not available:', error);
    }
  }
}

// Initialize all performance monitoring
export function initPerformanceMonitoring(): void {
  logPerformanceMetrics();
  initBasicWebVitalsTracking();
  initLongTaskObserver();

  // Log memory usage periodically in development
  if (import.meta.env?.DEV) {
    setInterval(logMemoryUsage, 30000); // Every 30 seconds
  }
}
