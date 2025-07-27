// Auth persistence utility
const AUTH_KEY = 'auth-token';
const AUTH_EXPIRY_KEY = 'auth-token-expiry';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dias em millisegundos

export const authPersistence = {
  // Salva o token com data de expiração
  saveToken(token) {
    if (!token) return;
    
    const expiry = Date.now() + SESSION_DURATION;
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(AUTH_EXPIRY_KEY, expiry.toString());
    
    // Também salva em sessionStorage como backup
    sessionStorage.setItem(AUTH_KEY, token);
  },

  // Recupera o token se ainda válido
  getToken() {
    // Primeiro tenta localStorage
    let token = localStorage.getItem(AUTH_KEY);
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    
    // Verifica se expirou
    if (token && expiry && Date.now() > parseInt(expiry)) {
      this.clearToken();
      return null;
    }
    
    // Se não tem no localStorage, tenta sessionStorage
    if (!token) {
      token = sessionStorage.getItem(AUTH_KEY);
      if (token) {
        // Se encontrou no sessionStorage, salva no localStorage
        this.saveToken(token);
      }
    }
    
    return token;
  },

  // Limpa o token
  clearToken() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_EXPIRY_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  },

  // Verifica se tem token válido
  isAuthenticated() {
    return !!this.getToken();
  },

  // Renova a expiração quando usado
  refreshExpiry() {
    const token = this.getToken();
    if (token) {
      this.saveToken(token);
    }
  }
};