import { useEffect } from 'react';
import { authPersistence } from '../utils/auth-persistence';
import { api } from '../utils/api';

function SessionKeepAlive() {
  useEffect(() => {
    // Mantém a sessão ativa a cada 5 minutos
    const keepAlive = async () => {
      const token = authPersistence.getToken();
      if (token) {
        try {
          // Faz uma chamada simples para manter a sessão ativa
          await api.projects.list();
          // Renova a expiração do token
          authPersistence.refreshExpiry();
        } catch (error) {
          console.error('Keep alive failed:', error);
        }
      }
    };

    // Executa imediatamente
    keepAlive();

    // Configura intervalo de 5 minutos
    const interval = setInterval(keepAlive, 5 * 60 * 1000);

    // Também mantém ativo quando a página ganha foco
    const handleFocus = () => {
      keepAlive();
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