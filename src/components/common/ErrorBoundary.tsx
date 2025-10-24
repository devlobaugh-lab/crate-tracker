import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to external service (if available)
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, you would send this to an error reporting service
    // like Sentry, LogRocket, or Bugsnag
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      console.log('Error Report:', errorReport);

      // Example: Send to error reporting service
      // errorReportingService.captureException(error, { extra: errorReport });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
          <div className='max-w-md w-full space-y-8'>
            <div className='text-center'>
              <div className='mx-auto h-16 w-16 text-red-500'>
                <svg fill='none' viewBox='0 0 24 24' stroke='currentColor' className='h-16 w-16'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1.5}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <h1 className='mt-4 text-3xl font-bold text-gray-900'>Something went wrong</h1>
              <p className='mt-2 text-sm text-gray-600'>
                We are sorry, but something unexpected happened. Please try again.
              </p>

              <div className='mt-6 space-y-3'>
                <button
                  onClick={this.handleRetry}
                  className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Try Again
                </button>

                <button
                  onClick={this.handleReload}
                  className='w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                >
                  Reload Page
                </button>
              </div>

              {this.props.showErrorDetails && this.state.error && (
                <details className='mt-6 text-left'>
                  <summary className='cursor-pointer text-sm text-gray-500 hover:text-gray-700'>
                    Show Error Details
                  </summary>
                  <div className='mt-2 p-4 bg-gray-100 rounded-md text-xs font-mono text-gray-800 overflow-auto max-h-40'>
                    <div className='font-semibold text-red-600 mb-2'>
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    <pre className='whitespace-pre-wrap'>{this.state.error.stack}</pre>
                    {this.state.errorInfo && (
                      <div className='mt-2 pt-2 border-t border-gray-300'>
                        <div className='font-semibold text-red-600 mb-1'>Component Stack:</div>
                        <pre className='whitespace-pre-wrap'>
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary for functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
};

// Higher-order component for adding error boundaries to components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Specific error boundary for authentication errors
export const AuthErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='max-w-md w-full text-center'>
          <h2 className='text-2xl font-bold text-gray-900 mb-4'>Authentication Error</h2>
          <p className='text-gray-600 mb-6'>
            There was a problem with authentication. Please refresh the page and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700'
          >
            Refresh Page
          </button>
        </div>
      </div>
    }
    onError={(error, errorInfo) => {
      console.error('Auth Error:', error, errorInfo);
      // Could send to analytics or error reporting service
    }}
  >
    {children}
  </ErrorBoundary>
);

// Specific error boundary for Firebase errors
export const FirebaseErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='max-w-md w-full text-center'>
          <h2 className='text-2xl font-bold text-gray-900 mb-4'>Connection Error</h2>
          <p className='text-gray-600 mb-6'>
            We are having trouble connecting to our services. Please check your internet connection
            and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700'
          >
            Retry Connection
          </button>
        </div>
      </div>
    }
    onError={(error, errorInfo) => {
      console.error('Firebase Error:', error, errorInfo);
      // Check if it's a network/quota error and handle accordingly
      if (error.message?.includes('offline') || error.message?.includes('quota')) {
        // Could trigger offline mode or show different UI
      }
    }}
  >
    {children}
  </ErrorBoundary>
);
