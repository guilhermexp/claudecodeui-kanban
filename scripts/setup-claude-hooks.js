#!/usr/bin/env node

/**
 * Script para configurar hooks de notificação sonora no Claude Code CLI
 * Implementa sistema nativo de hooks para tocar sons quando Claude completa tarefas
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Sons disponíveis no macOS (podem ser expandidos)
const MACOS_SOUNDS = [
  'Basso.aiff',
  'Blow.aiff', 
  'Bottle.aiff',
  'Frog.aiff',
  'Funk.aiff',
  'Glass.aiff',
  'Hero.aiff',
  'Morse.aiff',
  'Ping.aiff',
  'Pop.aiff',
  'Purr.aiff',
  'Sosumi.aiff',
  'Submarine.aiff',
  'Tink.aiff'
];

const CUSTOM_SOUNDS = [
  'abstract-sound1.wav',
  'abstract-sound2.wav', 
  'abstract-sound3.wav',
  'abstract-sound4.wav',
  'cow-mooing.wav',
  'phone-vibration.wav',
  'rooster.wav'
];

class ClaudeHooksManager {
  constructor() {
    this.claudeConfigPath = path.join(os.homedir(), '.claude', 'config.json');
    this.customSoundsPath = path.join(process.cwd(), 'public', 'sounds');
  }

  /**
   * Verifica se um som existe no sistema
   */
  async checkSoundExists(soundPath) {
    try {
      await fs.access(soundPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lista sons disponíveis no sistema
   */
  async getAvailableSounds() {
    const sounds = {
      system: [],
      custom: []
    };

    // Verifica sons do sistema macOS
    if (process.platform === 'darwin') {
      const systemSoundsPath = '/System/Library/Sounds';
      for (const sound of MACOS_SOUNDS) {
        const soundPath = path.join(systemSoundsPath, sound);
        if (await this.checkSoundExists(soundPath)) {
          sounds.system.push({
            name: sound.replace('.aiff', ''),
            path: soundPath,
            command: `afplay "${soundPath}"`
          });
        }
      }
    }

    // Verifica sons customizados da aplicação
    for (const sound of CUSTOM_SOUNDS) {
      const soundPath = path.join(this.customSoundsPath, sound);
      if (await this.checkSoundExists(soundPath)) {
        sounds.custom.push({
          name: sound.replace('.wav', ''),
          path: soundPath,
          command: process.platform === 'darwin' ? 
            `afplay "${soundPath}"` : 
            `node -e "const audio = new Audio('file://${soundPath}'); audio.play();"`
        });
      }
    }

    return sounds;
  }

  /**
   * Carrega configuração atual do Claude
   */
  async loadClaudeConfig() {
    try {
      // Garante que o diretório .claude existe
      await fs.mkdir(path.dirname(this.claudeConfigPath), { recursive: true });
      
      const configData = await fs.readFile(this.claudeConfigPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Arquivo não existe, retorna config padrão
        return {};
      }
      throw error;
    }
  }

  /**
   * Salva configuração do Claude
   */
  async saveClaudeConfig(config) {
    await fs.writeFile(
      this.claudeConfigPath, 
      JSON.stringify(config, null, 2), 
      'utf-8'
    );
  }

  /**
   * Configura hooks de notificação sonora
   */
  async setupSoundHooks(options = {}) {
    const {
      soundType = 'system', // 'system' | 'custom' | 'notification'
      soundName = 'Glass',
      enableStopHook = true,
      enableNotificationHook = true,
      enableSubagentHook = false,
      includeVisualNotification = true,
      includeVoice = false
    } = options;

    const config = await this.loadClaudeConfig();
    const sounds = await this.getAvailableSounds();
    
    // Encontra o som selecionado
    let selectedSound = null;
    if (soundType === 'system') {
      selectedSound = sounds.system.find(s => s.name === soundName);
    } else if (soundType === 'custom') {
      selectedSound = sounds.custom.find(s => s.name === soundName);
    }

    // Comando base para tocar som
    let soundCommand = '';
    if (selectedSound) {
      soundCommand = selectedSound.command;
    } else if (soundType === 'notification' && process.platform === 'darwin') {
      soundCommand = `osascript -e 'display notification "Claude terminou!" with title "Claude Code" sound name "Glass"'`;
    }

    // Constrói comando completo
    const commands = [];
    if (soundCommand) {
      commands.push(soundCommand);
    }
    
    if (includeVoice && process.platform === 'darwin') {
      commands.push('say "Claude terminou a tarefa"');
    }

    const hookCommand = commands.join(' && ');

    // Inicializa hooks se não existir
    if (!config.hooks) {
      config.hooks = {};
    }

    // Configura Stop Hook (quando Claude termina resposta)
    if (enableStopHook && hookCommand) {
      config.hooks.Stop = config.hooks.Stop || [];
      
      // Remove hooks existentes de som para evitar duplicatas
      config.hooks.Stop = config.hooks.Stop.filter(hook => 
        !hook.hooks.some(h => 
          h.command && (h.command.includes('afplay') || h.command.includes('osascript'))
        )
      );

      config.hooks.Stop.push({
        matcher: "",
        hooks: [
          {
            type: "command",
            command: hookCommand
          }
        ]
      });
    }

    // Configura Notification Hook
    if (enableNotificationHook && hookCommand) {
      config.hooks.Notification = config.hooks.Notification || [];
      
      // Remove hooks existentes
      config.hooks.Notification = config.hooks.Notification.filter(hook => 
        !hook.hooks.some(h => 
          h.command && (h.command.includes('afplay') || h.command.includes('osascript'))
        )
      );

      config.hooks.Notification.push({
        matcher: "",
        hooks: [
          {
            type: "command", 
            command: hookCommand
          }
        ]
      });
    }

    // Configura SubagentStop Hook (opcional)
    if (enableSubagentHook && hookCommand) {
      config.hooks.SubagentStop = config.hooks.SubagentStop || [];
      
      config.hooks.SubagentStop = config.hooks.SubagentStop.filter(hook => 
        !hook.hooks.some(h => 
          h.command && (h.command.includes('afplay') || h.command.includes('osascript'))
        )
      );

      config.hooks.SubagentStop.push({
        matcher: "",
        hooks: [
          {
            type: "command",
            command: hookCommand
          }
        ]
      });
    }

    await this.saveClaudeConfig(config);
    
    return {
      success: true,
      configPath: this.claudeConfigPath,
      soundCommand: hookCommand,
      availableSounds: sounds
    };
  }

  /**
   * Remove hooks de notificação sonora
   */
  async removeSoundHooks() {
    const config = await this.loadClaudeConfig();
    
    if (config.hooks) {
      // Remove hooks de som de todos os eventos
      ['Stop', 'Notification', 'SubagentStop'].forEach(eventType => {
        if (config.hooks[eventType]) {
          config.hooks[eventType] = config.hooks[eventType].filter(hook => 
            !hook.hooks.some(h => 
              h.command && (h.command.includes('afplay') || h.command.includes('osascript') || h.command.includes('say'))
            )
          );
          
          // Remove array vazio
          if (config.hooks[eventType].length === 0) {
            delete config.hooks[eventType];
          }
        }
      });
      
      // Remove objeto hooks vazio
      if (Object.keys(config.hooks).length === 0) {
        delete config.hooks;
      }
    }

    await this.saveClaudeConfig(config);
    
    return {
      success: true,
      configPath: this.claudeConfigPath
    };
  }

  /**
   * Testa um som específico
   */
  async testSound(soundType, soundName) {
    const sounds = await this.getAvailableSounds();
    
    let sound = null;
    if (soundType === 'system') {
      sound = sounds.system.find(s => s.name === soundName);
    } else if (soundType === 'custom') {
      sound = sounds.custom.find(s => s.name === soundName);
    }

    if (sound) {
      const { exec } = await import('child_process');
      return new Promise((resolve) => {
        exec(sound.command, (error) => {
          resolve({ success: !error, command: sound.command, error });
        });
      });
    }

    return { success: false, error: 'Som não encontrado' };
  }
}

// Função utilitária para uso direto via CLI
async function setupDefaultHooks() {
  const manager = new ClaudeHooksManager();
  
  try {
    console.log('🔊 Configurando hooks de notificação sonora do Claude Code...');
    
    const result = await manager.setupSoundHooks({
      soundType: 'system',
      soundName: 'Glass',
      enableStopHook: true,
      enableNotificationHook: true,
      includeVisualNotification: true
    });

    if (result.success) {
      console.log('✅ Hooks configurados com sucesso!');
      console.log(`📁 Configuração salva em: ${result.configPath}`);
      console.log(`🎵 Comando de som: ${result.soundCommand}`);
      console.log(`\n🎯 Sons disponíveis:`);
      console.log(`   Sistema: ${result.availableSounds.system.map(s => s.name).join(', ')}`);
      console.log(`   Customizados: ${result.availableSounds.custom.map(s => s.name).join(', ')}`);
    } else {
      console.error('❌ Erro ao configurar hooks');
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executa se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDefaultHooks();
}

export default ClaudeHooksManager;