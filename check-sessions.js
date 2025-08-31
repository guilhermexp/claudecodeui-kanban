
// Buscar todas as chaves relacionadas a sessões do Codex
const keys = Object.keys(localStorage);
const codexSessions = {};
const chatHistories = {};

keys.forEach(key => {
  // Procurar por sessões salvas (formato: codex-last-session-{projectPath})
  if (key.startsWith('codex-last-session-')) {
    const projectPath = key.replace('codex-last-session-', '');
    try {
      const sessionData = JSON.parse(localStorage.getItem(key));
      codexSessions[projectPath] = sessionData;
    } catch (e) {
      console.error('Error parsing session:', key, e);
    }
  }
  
  // Procurar por históricos de chat (formato: codex-chat-history-{projectPath})
  if (key.startsWith('codex-chat-history-')) {
    const projectPath = key.replace('codex-chat-history-', '');
    try {
      const chatData = JSON.parse(localStorage.getItem(key));
      chatHistories[projectPath] = {
        messageCount: chatData.messages ? chatData.messages.length : 0,
        lastUpdate: chatData.timestamp || 'unknown'
      };
    } catch (e) {
      console.error('Error parsing chat history:', key, e);
    }
  }
});

Projects with saved sessions:');
Object.entries(codexSessions).forEach(([project, data]) => {
});


Projects with chat history:');
Object.entries(chatHistories).forEach(([project, data]) => {
});


Total projects with sessions:', Object.keys(codexSessions).length);

// Also check for other Codex-related data
const allCodexKeys = keys.filter(k => k.includes('codex') || k.includes('claude'));

All Codex/Claude related localStorage keys:', allCodexKeys.length);
allCodexKeys.forEach(key => {
  if (!key.startsWith('codex-last-session-') && !key.startsWith('codex-chat-history-')) {
  }
});
