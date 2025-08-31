#!/usr/bin/env node

/**
 * CLI para configurar Claude Code Hooks de forma simples
 * 
 * Uso:
 * npm run setup-hooks              # Configura hooks padrão (som Glass)
 * npm run setup-hooks -- --sound Ping  # Configura com som específico
 * npm run setup-hooks -- --disable     # Remove hooks
 * npm run setup-hooks -- --test Glass  # Testa um som
 */

import ClaudeHooksManager from './setup-claude-hooks.js';

const manager = new ClaudeHooksManager();
const command = process.argv[2];
const args = process.argv.slice(3);

async function handleCommand() {
  try {
    switch (command) {
      case 'enable':
        await enableHooks();
        break;
      case 'disable':
        await disableHooks();
        break;
      case 'list':
        await listSounds();
        break;
      case 'test':
        await testSound(args[0], args[1]);
        break;
      case 'status':
        await showStatus();
        break;
      default:
        showHelp();
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function enableHooks() {
  
  const result = await manager.setupSoundHooks({
    soundType: 'system',
    soundName: 'Glass',
    enableStopHook: true,
    enableNotificationHook: true,
    includeVisualNotification: true
  });

  if (result.success) {
  } else {
    console.error('❌ Failed to enable notifications');
  }
}

async function disableHooks() {
  
  const result = await manager.removeSoundHooks();

  if (result.success) {
  } else {
    console.error('❌ Failed to disable notifications');
  }
}

async function listSounds() {
  
  const sounds = await manager.getAvailableSounds();

  if (sounds.system.length > 0) {
    sounds.system.forEach(sound => {
    });
  }

  if (sounds.custom.length > 0) {
    sounds.custom.forEach(sound => {
    });
  }

  if (sounds.system.length === 0 && sounds.custom.length === 0) {
  }
}

async function testSound(sound, type = 'system') {
  if (!sound) {
    console.error('❌ Please provide a sound name');
    return;
  }
  
  
  const result = await manager.testSound(type, sound);

  if (result.success) {
  } else {
    console.error('❌ Failed to play sound:', result.error);
  }
}

async function showStatus() {
  
  const config = await manager.loadClaudeConfig();
  
  if (config.hooks) {
    const hasStopHook = config.hooks.Stop?.some(hook => 
      hook.hooks.some(h => h.command && (h.command.includes('afplay') || h.command.includes('osascript')))
    );
    const hasNotificationHook = config.hooks.Notification?.some(hook => 
      hook.hooks.some(h => h.command && (h.command.includes('afplay') || h.command.includes('osascript')))
    );

    
    if (hasStopHook || hasNotificationHook) {
      ['Stop', 'Notification'].forEach(eventType => {
        if (config.hooks[eventType]) {
          config.hooks[eventType].forEach((hook, index) => {
            const soundHook = hook.hooks.find(h => h.command && h.command.includes('afplay'));
            if (soundHook) {
              const match = soundHook.command.match(/afplay ".*\/([^\/]+)\.aiff?"/);
              if (match) {
              }
            }
          });
        }
      });
    }
  } else {
  }
  
}

function showHelp() {
🔊 Claude Code Hooks CLI

Usage:
  npm run hooks:enable   - Enable sound notifications (Glass)
  npm run hooks:disable  - Disable sound notifications  
  npm run hooks:list     - List available sounds
  npm run hooks:status   - Show current configuration
  npm run hooks:test <sound> [type] - Test a sound

Examples:
  npm run hooks:test Glass system
  npm run hooks:test abstract-sound1 custom
`);
}

// Run the command
handleCommand();