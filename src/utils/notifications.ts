import toast from 'react-hot-toast';
import logger from './logger';

// Notification types for structured logging
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// Structured error logging interface
export interface ErrorLogEntry {
  type: NotificationType;
  message: string;
  details?: any;
  context?: string;
  userId?: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

// Error aggregator for development debugging
class ErrorAggregator {
  private errors: ErrorLogEntry[] = [];
  private readonly maxErrors = 50; // Keep last 50 errors

  addError(entry: ErrorLogEntry): void {
    this.errors.unshift(entry);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // In development, also log to console
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${entry.type.toUpperCase()}: ${entry.message}`);
      if (entry.details) console.log('Details:', entry.details);
      if (entry.context) console.log('Context:', entry.context);
      console.log('Timestamp:', entry.timestamp);
      console.groupEnd();
    }
  }

  getErrors(): ErrorLogEntry[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  getErrorsByType(type: NotificationType): ErrorLogEntry[] {
    return this.errors.filter(error => error.type === type);
  }
}

// Global error aggregator instance
export const errorAggregator = new ErrorAggregator();

// Notification utility functions
export const notifications = {
  /**
   * Show a success notification
   */
  success: (message: string, details?: any) => {
    logger.log(`✅ ${message}`, details);
    toast.success(message);

    errorAggregator.addError({
      type: NotificationType.SUCCESS,
      message,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  },

  /**
   * Show an error notification
   */
  error: (message: string, details?: any, context?: string) => {
    logger.error(`❌ ${message}`, details || context || '');
    toast.error(message);

    errorAggregator.addError({
      type: NotificationType.ERROR,
      message,
      details,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  },

  /**
   * Show a warning notification
   */
  warning: (message: string, details?: any) => {
    logger.warn(`⚠️ ${message}`, details);
    toast(message, {
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#1f2937',
      },
    });

    errorAggregator.addError({
      type: NotificationType.WARNING,
      message,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  },

  /**
   * Show an info notification
   */
  info: (message: string, details?: any) => {
    logger.log(`ℹ️ ${message}`, details);
    toast(message, {
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#f3f4f6',
      },
    });

    errorAggregator.addError({
      type: NotificationType.INFO,
      message,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  },

  /**
   * Handle async operation with automatic success/error notifications
   */
  asyncOperation: async <T>(
    operation: () => Promise<T>,
    successMessage?: string,
    errorMessage?: string,
    context?: string
  ): Promise<T | null> => {
    try {
      const result = await operation();
      if (successMessage) {
        notifications.success(successMessage);
      }
      return result;
    } catch (error) {
      const message = errorMessage || (error as Error).message || 'Operation failed';
      notifications.error(message, error, context);
      return null;
    }
  },

  /**
   * Handle Firebase errors with specific messaging
   */
  firebaseError: (error: any, context?: string) => {
    const errorCode = error?.code;
    let message = 'An unexpected error occurred';

    // Provide user-friendly messages for common Firebase errors
    switch (errorCode) {
      case 'permission-denied':
        message = 'You do not have permission to perform this action';
        break;
      case 'unavailable':
        message = 'Service is temporarily unavailable. Please try again later';
        break;
      case 'resource-exhausted':
        message = 'Service quota exceeded. Please try again later';
        break;
      case 'deadline-exceeded':
        message = 'Request timed out. Please check your connection and try again';
        break;
      case 'cancelled':
        message = 'Request was cancelled';
        break;
      case 'not-found':
        message = 'The requested resource was not found';
        break;
      case 'already-exists':
        message = 'This item already exists';
        break;
      case 'failed-precondition':
        message = 'Operation cannot be performed in the current state';
        break;
      default:
        if (error?.message) {
          message = error.message;
        }
    }

    notifications.error(message, error, context);
  },

  /**
   * Handle validation errors
   */
  validationError: (message: string, details?: any) => {
    notifications.error(`Validation Error: ${message}`, details, 'validation');
  },

  /**
   * Handle network errors
   */
  networkError: (message: string = 'Network connection error') => {
    notifications.warning(message);
  },

  /**
   * Handle offline mode notifications
   */
  offlineMode: (
    message: string = 'Working offline - changes will sync when connection is restored'
  ) => {
    notifications.info(message);
  },

  /**
   * Handle sync completion
   */
  syncComplete: (message: string = 'Data synchronized successfully') => {
    notifications.success(message);
  },
};

// Development debugging utilities
export const debugUtils = {
  /**
   * Get all logged errors for debugging
   */
  getAllErrors: () => errorAggregator.getErrors(),

  /**
   * Get error count
   */
  getErrorCount: () => errorAggregator.getErrorCount(),

  /**
   * Get errors by type
   */
  getErrorsByType: (type: NotificationType) => errorAggregator.getErrorsByType(type),

  /**
   * Clear all logged errors
   */
  clearErrors: () => errorAggregator.clearErrors(),

  /**
   * Log current application state for debugging
   */
  logAppState: (state: any, context?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔍 App State Debug${context ? ` - ${context}` : ''}`);
      console.log('State:', state);
      console.log('Timestamp:', new Date().toISOString());
      console.log('URL:', window.location.href);
      console.groupEnd();
    }
  },
};

// ErrorLogEntry type is already exported above as interface
