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
  console.log('🔊 Enabling Claude Code sound notifications...');
  
  const result = await manager.setupSoundHooks({
    soundType: 'system',
    soundName: 'Glass',
    enableStopHook: true,
    enableNotificationHook: true,
    includeVisualNotification: true
  });

  if (result.success) {
    console.log('✅ Sound notifications enabled!');
    console.log(`🎵 Using system sound: Glass`);
    console.log(`📁 Config: ${result.configPath}`);
  } else {
    console.error('❌ Failed to enable notifications');
  }
}

async function disableHooks() {
  console.log('🔇 Disabling Claude Code sound notifications...');
  
  const result = await manager.removeSoundHooks();

  if (result.success) {
    console.log('✅ Sound notifications disabled');
    console.log(`📁 Config: ${result.configPath}`);
  } else {
    console.error('❌ Failed to disable notifications');
  }
}

async function listSounds() {
  console.log('🎵 Available sounds:');
  
  const sounds = await manager.getAvailableSounds();

  if (sounds.system.length > 0) {
    console.log('\n📢 System Sounds (macOS):');
    sounds.system.forEach(sound => {
      console.log(`  • ${sound.name}`);
    });
  }

  if (sounds.custom.length > 0) {
    console.log('\n🎨 Custom Sounds:');
    sounds.custom.forEach(sound => {
      console.log(`  • ${sound.name}`);
    });
  }

  if (sounds.system.length === 0 && sounds.custom.length === 0) {
    console.log('  No sounds available');
  }
}

async function testSound(sound, type = 'system') {
  if (!sound) {
    console.error('❌ Please provide a sound name');
    console.log('Usage: npm run hooks:test <sound-name> [type]');
    return;
  }
  
  console.log(`🔊 Testing ${type} sound: ${sound}`);
  
  const result = await manager.testSound(type, sound);

  if (result.success) {
    console.log('✅ Sound played successfully');
  } else {
    console.error('❌ Failed to play sound:', result.error);
  }
}

async function showStatus() {
  console.log('📊 Claude Code Hooks Status:');
  
  const config = await manager.loadClaudeConfig();
  
  if (config.hooks) {
    const hasStopHook = config.hooks.Stop?.some(hook => 
      hook.hooks.some(h => h.command && (h.command.includes('afplay') || h.command.includes('osascript')))
    );
    const hasNotificationHook = config.hooks.Notification?.some(hook => 
      hook.hooks.some(h => h.command && (h.command.includes('afplay') || h.command.includes('osascript')))
    );

    console.log(`  Stop Hook: ${hasStopHook ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  Notification Hook: ${hasNotificationHook ? '✅ Enabled' : '❌ Disabled'}`);
    
    if (hasStopHook || hasNotificationHook) {
      console.log('\n🎵 Configured sounds:');
      ['Stop', 'Notification'].forEach(eventType => {
        if (config.hooks[eventType]) {
          config.hooks[eventType].forEach((hook, index) => {
            const soundHook = hook.hooks.find(h => h.command && h.command.includes('afplay'));
            if (soundHook) {
              const match = soundHook.command.match(/afplay ".*\/([^\/]+)\.aiff?"/);
              if (match) {
                console.log(`    ${eventType}: ${match[1]}`);
              }
            }
          });
        }
      });
    }
  } else {
    console.log('  ❌ No hooks configured');
  }
  
  console.log(`\n📁 Config file: ${manager.claudeConfigPath}`);
}

function showHelp() {
  console.log(`
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