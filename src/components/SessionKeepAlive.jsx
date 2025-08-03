import { useEffect } from 'react';
import { authPersistence } from '../utils/auth-persistence';
import { api } from '../utils/api';

function SessionKeepAlive() {
  useEffect(() => {
    let lastKeepAlive = Date.now();
    const MIN_INTERVAL = 60 * 1000; // 1 minuto entre requisições

    // Mantém a sessão ativa a cada 5 minutos
    const keepAlive = async () => {
      const token = authPersistence.getToken();
      if (token) {
        try {
          // Faz uma chamada simples para manter a sessão ativa
          await api.projects();
          // Renova a expiração do token
          authPersistence.refreshExpiry();
          lastKeepAlive = Date.now();
        } catch (error) {
          // Apenas loga se não for erro de rede comum
          if (error.name !== 'TypeError' && !error.message?.includes('Failed to fetch')) {
            console.error('Keep alive failed:', error);
          }
        }
      }
    };

    // Configura intervalo de 5 minutos
    const interval = setInterval(keepAlive, 5 * 60 * 1000);

    // Também mantém ativo quando a página ganha foco (com debounce)
    const handleFocus = () => {
      const timeSinceLastKeepAlive = Date.now() - lastKeepAlive;
      if (timeSinceLastKeepAlive > MIN_INTERVAL) {
        keepAlive();
      }
    };

    window.addEventListener('focus', handleFocus);

    // Salva estado quando a página perde foco (celular bloqueado, etc)
    const handleBlur = () => {
      const token = authPersistence.getToken();
      if (token) {
        authPersistence.saveToken(token);
      }
    };

    window.addEventListener('blur', handleBlur);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Este componente não renderiza nada
  return null;
}

export default SessionKeepAlive;