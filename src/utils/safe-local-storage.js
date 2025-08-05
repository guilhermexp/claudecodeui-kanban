/**
 * Safe localStorage wrapper that handles quota exceeded errors
 * and provides fallback behavior
 */

export const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      // localStorage.getItem failed
      return null;
    }
  },
  
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        // Try to clear old items or compress data
        // localStorage quota exceeded
      }
      // localStorage.setItem failed
      return false;
    }
  },
  
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      // localStorage.removeItem failed
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      // localStorage.clear failed
      return false;
    }
  }
};

export default safeLocalStorage;