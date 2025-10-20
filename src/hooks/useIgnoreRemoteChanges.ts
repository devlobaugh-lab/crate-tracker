import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook to manage ignoreRemoteChanges timeout functionality
 * Provides a single timeout manager to prevent multiple timeouts
 */
export function useIgnoreRemoteChanges(setIgnoreRemoteChanges: (ignore: boolean) => void): (delay?: number) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setIgnoreWithTimeout = useCallback((delay = 1000) => {
    // Clear any existing timeout first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set ignore to true immediately for this operation
    setIgnoreRemoteChanges(true);

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setIgnoreRemoteChanges(false);
      timeoutRef.current = null;
    }, delay);
  }, [setIgnoreRemoteChanges]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return setIgnoreWithTimeout;
}
