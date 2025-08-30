/**
 * Vibe Kanban Cleanup Service
 * 
 * Sistema de limpeza automática de processos órfãos do Vibe Kanban
 * Previne sobrecarga do servidor e acúmulo de processos em background
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import Logger from './lib/logger.js';

const execAsync = promisify(exec);

class VibeKanbanCleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = null;
    this.orphanProcesses = new Set();
    this.lastCleanup = null;
    this.logger = new Logger('VibeKanbanCleanup');
    
    // Configurações
    this.config = {
      checkInterval: 600000, // 10 minutos (reduzido de 2min para diminuir overhead)
      processTimeout: 900000, // 15 minutos para considerar órfão (mais conservador)
      maxOrphanCount: 10, // Máximo de processos órfãos antes de limpeza forçada
      vibeKanbanPort: 8081,
      logLevel: 'warn', // Reduzir logs para apenas warnings e erros
      skipHealthCheckIfNotRunning: true, // Nova opção para evitar checks desnecessários
      skipCleanupIfNoOrphans: true // Pular limpeza se não há processos órfãos
    };
    
    // Padrões de processos do Vibe Kanban para identificar
    this.vibeProcessPatterns = [
      /cargo.*run.*vibe-kanban/i,
      /target\/release\/vibe-kanban/i,
      /vibe-kanban.*backend/i,
      /rust.*vibe.*kanban/i
    ];
  }

  /**
   * Inicia o serviço de limpeza
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Service already running', {
        event: 'service_already_running',
        isRunning: this.isRunning,
        lastCleanup: this.lastCleanup
      });
      return;
    }

    this.logger.info('Starting Vibe Kanban cleanup service', {
      event: 'service_start',
      config: this.config,
      processPatterns: this.vibeProcessPatterns.length
    });
    this.isRunning = true;
    
    // Limpeza inicial
    this.performCleanup();
    
    // Configurar verificação periódica
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.checkInterval);
  }

  /**
   * Para o serviço de limpeza
   */
  stop() {
    if (!this.isRunning) {
      this.logger.debug('Service already stopped', {
        event: 'service_already_stopped'
      });
      return;
    }
    
    this.logger.info('Stopping cleanup service', {
      event: 'service_stop',
      lastCleanup: this.lastCleanup,
      orphanProcessCount: this.orphanProcesses.size
    });
    this.isRunning = false;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Realiza a limpeza de processos órfãos
   */
  async performCleanup() {
    const startTime = Date.now();
    
    try {
      // 1. Verificar se porta Vibe Kanban está em uso
      const isPortInUse = await this.checkPortUsage(this.config.vibeKanbanPort);
      
      // 2. Se porta está funcionando e configuração permite pular, fazer verificação simples
      if (isPortInUse && this.config.skipCleanupIfNoOrphans) {
        // Quick check: apenas contar processos
        const vibeProcesses = await this.findVibeKanbanProcesses();
        
        // Se há apenas 1 processo (normal) e porta está funcionando, pular limpeza completa
        if (vibeProcesses.length <= 2) {
          const duration = Date.now() - startTime;
          this.logger.debug('Skipped cleanup - system healthy', {
            event: 'cleanup_skipped',
            duration: `${duration}ms`,
            reason: 'system_healthy',
            statistics: {
              portInUse: true,
              totalProcesses: vibeProcesses.length,
              orphanProcesses: 0,
              cleanedProcesses: 0
            }
          });
          this.lastCleanup = new Date();
          return;
        }
      }
      
      this.logger.info('Starting cleanup check', {
        event: 'cleanup_start',
        timestamp: new Date().toISOString()
      });
      
      // 3. Listar processos relacionados ao Vibe Kanban
      const vibeProcesses = await this.findVibeKanbanProcesses();
      
      // 4. Identificar processos órfãos
      const orphanProcesses = await this.identifyOrphanProcesses(vibeProcesses, isPortInUse);
      
      // 5. Limpar processos órfãos se necessário
      if (orphanProcesses.length > 0) {
        await this.cleanOrphanProcesses(orphanProcesses);
        
        // 6. Apenas limpar arquivos e verificar DB se houve limpeza de processos
        await this.cleanTemporaryFiles();
        await this.checkDatabaseHealth();
      }
      
      this.lastCleanup = new Date();
      const duration = Date.now() - startTime;
      
      // Só logar como INFO se houve ação, senão usar DEBUG
      const logLevel = orphanProcesses.length > 0 ? 'info' : 'debug';
      this.logger[logLevel]('Cleanup completed successfully', {
        event: 'cleanup_complete',
        duration: `${duration}ms`,
        statistics: {
          portInUse: isPortInUse,
          totalProcesses: vibeProcesses.length,
          orphanProcesses: orphanProcesses.length,
          cleanedProcesses: orphanProcesses.length
        }
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Cleanup failed', {
        event: 'cleanup_error',
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Verifica se uma porta está em uso
   */
  async checkPortUsage(port) {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} -t`);
      return stdout.trim().length > 0;
    } catch (error) {
      // lsof retorna erro se porta não está em uso
      return false;
    }
  }

  /**
   * Encontra todos os processos relacionados ao Vibe Kanban
   */
  async findVibeKanbanProcesses() {
    try {
      const { stdout } = await execAsync('ps aux');
      const processes = [];
      
      const lines = stdout.split('\n').slice(1); // Remove header
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;
        
        const pid = parts[1];
        const command = parts.slice(10).join(' ');
        
        // Verificar se processo corresponde aos padrões do Vibe Kanban
        const isVibeProcess = this.vibeProcessPatterns.some(pattern => 
          pattern.test(command)
        );
        
        if (isVibeProcess) {
          processes.push({
            pid: parseInt(pid),
            command,
            startTime: this.parseProcessStartTime(parts[8])
          });
        }
      }
      
      if (this.config.logLevel === 'debug') {
        this.logger.debug('Found Vibe Kanban processes', {
          event: 'processes_found',
          count: processes.length,
          processes: processes.map(p => ({ pid: p.pid, command: p.command.substring(0, 50) + '...' }))
        });
      }
      
      return processes;
    } catch (error) {
      this.logger.error('Failed to find Vibe Kanban processes', {
        event: 'process_discovery_error',
        error: error.message,
        stack: error.stack
      });
      return [];
    }
  }

  /**
   * Identifica processos órfãos
   */
  async identifyOrphanProcesses(processes, isPortInUse) {
    const orphans = [];
    const now = Date.now();
    
    for (const process of processes) {
      const processAge = now - process.startTime;
      
      // Critérios para considerar órfão:
      // 1. Processo rodando há mais que o timeout configurado
      // 2. Porta não está sendo usada (servidor não está respondendo)
      // 3. Processo não responde a verificações de saúde
      
      const isOld = processAge > this.config.processTimeout;
      const isUnresponsive = !isPortInUse && isOld;
      
      if (isUnresponsive) {
        // Verificação adicional: tentar ping no processo
        const isResponsive = await this.pingProcess(process.pid);
        
        if (!isResponsive) {
          orphans.push(process);
        }
      }
    }
    
    // Se temos muitos processos, considerar limpeza mais agressiva
    if (processes.length > this.config.maxOrphanCount) {
      this.logger.warn('Too many Vibe processes detected', {
        event: 'excessive_processes',
        processCount: processes.length,
        maxAllowed: this.config.maxOrphanCount,
        action: 'marking_older_as_orphans'
      });
      
      // Ordenar por tempo e marcar os mais antigos
      const sorted = processes.sort((a, b) => a.startTime - b.startTime);
      const excess = sorted.slice(0, processes.length - 3); // Manter apenas 3 mais recentes
      
      orphans.push(...excess);
    }
    
    this.logger.debug('Orphan process identification completed', {
      event: 'orphan_identification_complete',
      totalProcesses: processes.length,
      orphanProcesses: orphans.length,
      criteria: {
        processTimeout: this.config.processTimeout,
        portInUse: isPortInUse
      }
    });
    
    return orphans;
  }

  /**
   * Tenta fazer ping em um processo para verificar se está responsivo
   */
  async pingProcess(pid) {
    try {
      // Tentar enviar signal 0 (não mata o processo, apenas verifica existência)
      await execAsync(`kill -0 ${pid}`);
      
      // Se chegou aqui, processo existe. Verificar se responde a HTTP
      if (this.config.vibeKanbanPort) {
        try {
          const response = await fetch(`http://localhost:${this.config.vibeKanbanPort}/health`, {
            timeout: 2000
          });
          return response.ok;
        } catch {
          return false;
        }
      }
      
      return false; // Processo existe mas não responde
    } catch {
      return false; // Processo não existe mais
    }
  }

  /**
   * Limpa processos órfãos identificados
   */
  async cleanOrphanProcesses(orphans) {
    if (orphans.length === 0) {
      this.logger.debug('No orphan processes to clean', {
        event: 'no_orphans_found'
      });
      return;
    }
    
    this.logger.info('Starting orphan process cleanup', {
      event: 'orphan_cleanup_start',
      orphanCount: orphans.length,
      processes: orphans.map(p => ({ pid: p.pid, command: p.command.substring(0, 50) + '...' }))
    });
    
    for (const orphan of orphans) {
      try {
        this.logger.info('Terminating orphan process', {
          event: 'process_termination_start',
          pid: orphan.pid,
          command: orphan.command.substring(0, 100) + '...'
        });
        
        // Tentar terminação graceful primeiro (SIGTERM)
        await execAsync(`kill ${orphan.pid}`);
        
        // Aguardar um pouco para terminação graceful
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar se ainda está rodando
        const stillRunning = await this.pingProcess(orphan.pid);
        
        if (stillRunning) {
          // Forçar terminação (SIGKILL)
          this.logger.warn('Force killing unresponsive process', {
            event: 'process_force_kill',
            pid: orphan.pid,
            reason: 'graceful_termination_failed'
          });
          await execAsync(`kill -9 ${orphan.pid}`);
        }
        
        this.logger.info('Successfully cleaned orphan process', {
          event: 'process_cleaned',
          pid: orphan.pid,
          method: stillRunning ? 'force_kill' : 'graceful'
        });
        
      } catch (error) {
        this.logger.error('Failed to clean orphan process', {
          event: 'process_cleanup_error',
          pid: orphan.pid,
          error: error.message,
          command: orphan.command.substring(0, 100) + '...'
        });
      }
    }
  }

  /**
   * Limpa arquivos temporários e caches do Vibe Kanban
   */
  async cleanTemporaryFiles() {
    const vibeKanbanPath = path.join(process.cwd(), 'vibe-kanban');
    const tempPaths = [
      path.join(vibeKanbanPath, 'target', 'debug'),
      path.join(vibeKanbanPath, 'target', 'tmp'),
      path.join(vibeKanbanPath, 'backend', 'logs'),
      path.join(vibeKanbanPath, '*.log')
    ];
    
    for (const tempPath of tempPaths) {
      try {
        const stats = await fs.stat(tempPath).catch(() => null);
        if (stats) {
          if (stats.isDirectory()) {
            // Limpar arquivos temporários antigos (mais de 1 dia)
            const files = await fs.readdir(tempPath);
            const now = Date.now();
            
            for (const file of files) {
              const filePath = path.join(tempPath, file);
              const fileStats = await fs.stat(filePath);
              const fileAge = now - fileStats.mtime.getTime();
              
              if (fileAge > 24 * 60 * 60 * 1000) { // 1 dia
                await fs.rm(filePath, { recursive: true, force: true });
                this.logger.debug('Cleaned temporary file', {
                  event: 'temp_file_cleaned',
                  filePath,
                  fileAge: `${Math.round(fileAge / 1000 / 60 / 60)}h`
                });
              }
            }
          }
        }
      } catch (error) {
        // Ignorar erros de limpeza de arquivos temporários
      }
    }
  }

  /**
   * Verifica a saúde do banco de dados do Vibe Kanban
   */
  async checkDatabaseHealth() {
    try {
      const dbPath = path.join(process.cwd(), 'vibe-kanban', 'backend', 'database.sqlite');
      
      const stats = await fs.stat(dbPath).catch(() => null);
      if (!stats) return;
      
      // Verificar tamanho do banco (se muito grande, pode precisar de manutenção)
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > 100) { // 100MB threshold
        this.logger.warn('Database size exceeds threshold', {
          event: 'database_size_warning',
          sizeMB: sizeMB.toFixed(2),
          threshold: '100MB',
          recommendation: 'consider_maintenance'
        });
      } else {
        this.logger.debug('Database health check passed', {
          event: 'database_health_ok',
          sizeMB: sizeMB.toFixed(2)
        });
      }
      
      // Check database integrity using SQLite PRAGMA commands
      try {
        const db = await import('better-sqlite3').then(m => m.default);
        const database = new db(dbPath);
        
        // Run integrity check
        const integrityCheck = database.prepare('PRAGMA integrity_check').get();
        if (integrityCheck && integrityCheck.integrity_check !== 'ok') {
          this.logger.error('Database integrity check failed', {
            event: 'database_integrity_failure',
            result: integrityCheck
          });
        }
        
        // Check foreign key integrity
        const foreignKeyCheck = database.prepare('PRAGMA foreign_key_check').all();
        if (foreignKeyCheck && foreignKeyCheck.length > 0) {
          this.logger.warn('Foreign key violations found', {
            event: 'foreign_key_violations',
            violations: foreignKeyCheck.length
          });
        }
        
        database.close();
      } catch (integrityError) {
        // SQLite module may not be available, skip integrity checks
        this.logger.debug('Database integrity check skipped', {
          event: 'integrity_check_skipped',
          reason: integrityError.message
        });
      }
      
    } catch (error) {
      this.logger.warn('Database health check failed', {
        event: 'database_health_check_error',
        error: error.message,
        dbPath: path.join(process.cwd(), 'vibe-kanban', 'backend', 'database.sqlite')
      });
    }
  }

  /**
   * Parse do tempo de início do processo
   */
  parseProcessStartTime(timeStr) {
    // Simplificado: usar timestamp atual menos um valor aproximado
    // Em implementação real, seria necessário parsing mais sofisticado do ps output
    return Date.now() - (60000); // Assume 1 minuto atrás por padrão
  }

  /**
   * Status do serviço de limpeza
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup,
      config: this.config,
      orphanProcessCount: this.orphanProcesses.size
    };
  }

  /**
   * Limpeza manual forçada
   */
  async forceCleanup() {
    this.logger.info('Performing forced cleanup', {
      event: 'force_cleanup_start',
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup
    });
    await this.performCleanup();
    this.logger.info('Forced cleanup completed', {
      event: 'force_cleanup_complete',
      timestamp: new Date().toISOString()
    });
  }
}

// Singleton instance
const cleanupService = new VibeKanbanCleanupService();

export default cleanupService;