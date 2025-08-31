import express from 'express';
import ClaudeHooksManager from '../../scripts/setup-claude-hooks.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const log = createLogger('CLAUDE-HOOKS');
const hooksManager = new ClaudeHooksManager();

/**
 * GET /api/claude-hooks/sounds - Lista sons disponíveis
 */
router.get('/sounds', async (req, res) => {
  try {
    const sounds = await hooksManager.getAvailableSounds();
    res.json({
      success: true,
      sounds
    });
  } catch (error) {
    log.error(`Erro ao listar sons: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/claude-hooks/config - Obtém configuração atual dos hooks
 */
router.get('/config', async (req, res) => {
  try {
    const config = await hooksManager.loadClaudeConfig();
    
    // Extrai informações dos hooks de som
    const soundHooksInfo = {
      stopHook: false,
      notificationHook: false,
      subagentHook: false,
      currentSound: null
    };

    if (config.hooks) {
      // Verifica se há hooks de som configurados
      ['Stop', 'Notification', 'SubagentStop'].forEach(eventType => {
        if (config.hooks[eventType]) {
          const hasSound = config.hooks[eventType].some(hook => 
            hook.hooks.some(h => 
              h.command && (h.command.includes('afplay') || h.command.includes('osascript'))
            )
          );
          
          if (hasSound) {
            if (eventType === 'Stop') soundHooksInfo.stopHook = true;
            if (eventType === 'Notification') soundHooksInfo.notificationHook = true;
            if (eventType === 'SubagentStop') soundHooksInfo.subagentHook = true;
            
            // Extrai nome do som atual
            if (!soundHooksInfo.currentSound) {
              const soundHook = config.hooks[eventType].find(hook => 
                hook.hooks.some(h => h.command && h.command.includes('afplay'))
              );
              if (soundHook) {
                const command = soundHook.hooks.find(h => h.command && h.command.includes('afplay'))?.command;
                if (command) {
                  const match = command.match(/afplay ".*\/([^\/]+)\.aiff?"/);
                  if (match) {
                    soundHooksInfo.currentSound = match[1];
                  }
                }
              }
            }
          }
        }
      });
    }

    res.json({
      success: true,
      config: soundHooksInfo,
      fullConfig: config
    });
  } catch (error) {
    log.error(`Erro ao obter configuração: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/claude-hooks/setup - Configura hooks de som
 */
router.post('/setup', async (req, res) => {
  try {
    const options = req.body;
    const result = await hooksManager.setupSoundHooks(options);
    
    res.json(result);
  } catch (error) {
    log.error(`Erro ao configurar hooks: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/claude-hooks/remove - Remove hooks de som
 */
router.delete('/remove', async (req, res) => {
  try {
    const result = await hooksManager.removeSoundHooks();
    
    res.json(result);
  } catch (error) {
    log.error(`Erro ao remover hooks: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/claude-hooks/test-sound - Testa um som específico
 */
router.post('/test-sound', async (req, res) => {
  try {
    const { soundType, soundName } = req.body;
    const result = await hooksManager.testSound(soundType, soundName);
    
    res.json(result);
  } catch (error) {
    log.error(`Erro ao testar som: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
