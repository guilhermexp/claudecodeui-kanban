import { useEffect, useRef, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('Cleanup');

/**
 * Universal cleanup hook to prevent memory leaks
 * Automatically tracks and cleans up event listeners, timers, and other resources
 */
export function useCleanup() {
  const cleanupTasks = useRef([]);
  const intervalIds = useRef(new Set());
  const timeoutIds = useRef(new Set());
  const eventListeners = useRef([]);
  const abortControllers = useRef(new Set());

  // Add cleanup task
  const addCleanupTask = useCallback((task, description = 'Unknown task') => {
    if (typeof task === 'function') {
      cleanupTasks.current.push({ task, description });
      log.debug(`Added cleanup task: ${description}`);
    } else {
      log.warn('Invalid cleanup task provided:', task);
    }
  }, []);

  // Managed setInterval that auto-cleans up
  const setManagedInterval = useCallback((callback, delay, description = 'Interval') => {
    const id = setInterval(callback, delay);
    intervalIds.current.add(id);
    log.debug(`Created managed interval: ${description} (${id})`);
    
    return {
      id,
      clear: () => {
        clearInterval(id);
        intervalIds.current.delete(id);
        log.debug(`Cleared managed interval: ${description} (${id})`);
      }
    };
  }, []);

  // Managed setTimeout that auto-cleans up
  const setManagedTimeout = useCallback((callback, delay, description = 'Timeout') => {
    const id = setTimeout(() => {
      callback();
      timeoutIds.current.delete(id); // Auto-remove when executed
    }, delay);
    
    timeoutIds.current.add(id);
    log.debug(`Created managed timeout: ${description} (${id})`);
    
    return {
      id,
      clear: () => {
        clearTimeout(id);
        timeoutIds.current.delete(id);
        log.debug(`Cleared managed timeout: ${description} (${id})`);
      }
    };
  }, []);

  // Managed event listener that auto-cleans up
  const addManagedEventListener = useCallback((element, event, handler, options, description = 'Event listener') => {
    if (!element || typeof element.addEventListener !== 'function') {
      log.warn('Invalid element provided for event listener:', element);
      return { remove: () => {} };
    }

    element.addEventListener(event, handler, options);
    
    const listener = { element, event, handler, options, description };
    eventListeners.current.push(listener);
    
    log.debug(`Added managed event listener: ${description} (${event} on ${element.constructor.name})`);
    
    return {
      remove: () => {
        element.removeEventListener(event, handler, options);
        const index = eventListeners.current.indexOf(listener);
        if (index > -1) {
          eventListeners.current.splice(index, 1);
          log.debug(`Removed managed event listener: ${description} (${event})`);
        }
      }
    };
  }, []);

  // Managed AbortController that auto-cleans up
  const createManagedAbortController = useCallback((description = 'AbortController') => {
    const controller = new AbortController();
    abortControllers.current.add(controller);
    
    log.debug(`Created managed AbortController: ${description}`);
    
    return {
      controller,
      signal: controller.signal,
      abort: (reason) => {
        controller.abort(reason);
        abortControllers.current.delete(controller);
        log.debug(`Aborted managed AbortController: ${description}`);
      }
    };
  }, []);

  // Manual cleanup function
  const cleanup = useCallback(() => {
    let cleanedCount = 0;

    // Clear all intervals
    intervalIds.current.forEach(id => {
      clearInterval(id);
      cleanedCount++;
    });
    intervalIds.current.clear();

    // Clear all timeouts
    timeoutIds.current.forEach(id => {
      clearTimeout(id);
      cleanedCount++;
    });
    timeoutIds.current.clear();

    // Remove all event listeners
    eventListeners.current.forEach(({ element, event, handler, options, description }) => {
      try {
        element.removeEventListener(event, handler, options);
        cleanedCount++;
      } catch (error) {
        log.warn(`Failed to remove event listener ${description}:`, error);
      }
    });
    eventListeners.current = [];

    // Abort all controllers
    abortControllers.current.forEach(controller => {
      try {
        if (!controller.signal.aborted) {
          controller.abort('Component cleanup');
          cleanedCount++;
        }
      } catch (error) {
        log.warn('Failed to abort controller:', error);
      }
    });
    abortControllers.current.clear();

    // Execute custom cleanup tasks
    cleanupTasks.current.forEach(({ task, description }) => {
      try {
        task();
        cleanedCount++;
        log.debug(`Executed cleanup task: ${description}`);
      } catch (error) {
        log.error(`Cleanup task failed (${description}):`, error);
      }
    });
    cleanupTasks.current = [];

    if (cleanedCount > 0) {
      log.info(`Cleanup completed: ${cleanedCount} resources cleaned`);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Helper functions for common patterns
  const helpers = {
    // Document/Window event listeners
    onDocument: (event, handler, options, description) => 
      addManagedEventListener(document, event, handler, options, description || `document:${event}`),
    
    onWindow: (event, handler, options, description) => 
      addManagedEventListener(window, event, handler, options, description || `window:${event}`),
    
    // Common resize handler with debouncing
    onResize: (handler, debounceMs = 150, description = 'resize handler') => {
      let timeoutId = null;
      const debouncedHandler = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(handler, debounceMs);
      };
      
      const listener = addManagedEventListener(window, 'resize', debouncedHandler, false, description);
      
      // Also cleanup the debounce timeout
      addCleanupTask(() => {
        if (timeoutId) clearTimeout(timeoutId);
      }, `${description} debounce timeout`);
      
      return listener;
    },

    // Common beforeunload handler
    onBeforeUnload: (handler, description = 'beforeunload handler') =>
      addManagedEventListener(window, 'beforeunload', handler, false, description),

    // Fetch with AbortController
    fetchWithCleanup: async (url, options = {}, description = 'fetch request') => {
      const { controller, signal } = createManagedAbortController(description);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal
        });
        abortControllers.current.delete(controller); // Remove from auto-cleanup since it completed
        return response;
      } catch (error) {
        if (error.name === 'AbortError') {
          log.debug(`Fetch aborted: ${description}`);
        } else {
          log.error(`Fetch failed: ${description}`, error);
        }
        throw error;
      }
    }
  };

  // Debug helper
  const getStats = useCallback(() => {
    return {
      intervals: intervalIds.current.size,
      timeouts: timeoutIds.current.size,
      eventListeners: eventListeners.current.length,
      abortControllers: abortControllers.current.size,
      cleanupTasks: cleanupTasks.current.length,
      total: intervalIds.current.size + 
             timeoutIds.current.size + 
             eventListeners.current.length + 
             abortControllers.current.size + 
             cleanupTasks.current.length
    };
  }, []);

  return {
    // Core functions
    addCleanupTask,
    cleanup,
    
    // Managed resources
    setManagedInterval,
    setManagedTimeout,
    addManagedEventListener,
    createManagedAbortController,
    
    // Helpers
    ...helpers,
    
    // Debug
    getStats
  };
}

// Hook for tracking component lifecycle (debug purposes)
export function useLifecycleTracker(componentName) {
  const mountTime = useRef(Date.now());
  
  useEffect(() => {
    log.info(`🟢 ${componentName} mounted`);
    
    return () => {
      const lifeTime = Date.now() - mountTime.current;
      log.info(`🔴 ${componentName} unmounted (lived ${lifeTime}ms)`);
    };
  }, [componentName]);
}

// Hook for detecting memory leaks (development only)
export function useMemoryLeakDetector(componentName, checkInterval = 30000) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const detector = {
      initialMemory: null,
      checkCount: 0,
      maxChecks: 10 // Check for 5 minutes max
    };

    const checkMemory = () => {
      if (detector.checkCount >= detector.maxChecks) return;
      
      try {
        if (performance.memory) {
          const current = performance.memory.usedJSHeapSize;
          
          if (detector.initialMemory === null) {
            detector.initialMemory = current;
          } else {
            const increase = current - detector.initialMemory;
            const increasePercent = (increase / detector.initialMemory) * 100;
            
            if (increasePercent > 50) { // 50% increase threshold
              log.warn(`🚨 Potential memory leak in ${componentName}:`, {
                initial: `${(detector.initialMemory / 1024 / 1024).toFixed(2)}MB`,
                current: `${(current / 1024 / 1024).toFixed(2)}MB`,
                increase: `${(increase / 1024 / 1024).toFixed(2)}MB`,
                increasePercent: `${increasePercent.toFixed(1)}%`
              });
            }
          }
          
          detector.checkCount++;
        }
      } catch (error) {
        // Ignore errors, memory API might not be available
      }
    };

    const interval = setInterval(checkMemory, checkInterval);
    
    // Initial check
    checkMemory();

    return () => clearInterval(interval);
  }, [componentName, checkInterval]);
}
