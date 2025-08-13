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

const execAsync = promisify(exec);

class VibeKanbanCleanupService {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = null;
    this.orphanProcesses = new Set();
    this.lastCleanup = null;
    
    // Configurações
    this.config = {
      checkInterval: 30000, // 30 segundos
      processTimeout: 300000, // 5 minutos para considerar órfão
      maxOrphanCount: 10, // Máximo de processos órfãos antes de limpeza forçada
      vibeKanbanPort: 8081,
      logLevel: 'info'
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
      console.log('[CLEANUP-SERVICE] Service already running');
      return;
    }

    console.log('[CLEANUP-SERVICE] Starting Vibe Kanban cleanup service');
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
    if (!this.isRunning) return;
    
    console.log('[CLEANUP-SERVICE] Stopping cleanup service');
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
    try {
      console.log('[CLEANUP-SERVICE] Performing cleanup check...');
      
      // 1. Verificar se porta Vibe Kanban está em uso
      const isPortInUse = await this.checkPortUsage(this.config.vibeKanbanPort);
      
      // 2. Listar processos relacionados ao Vibe Kanban
      const vibeProcesses = await this.findVibeKanbanProcesses();
      
      // 3. Identificar processos órfãos
      const orphanProcesses = await this.identifyOrphanProcesses(vibeProcesses, isPortInUse);
      
      // 4. Limpar processos órfãos se necessário
      if (orphanProcesses.length > 0) {
        await this.cleanOrphanProcesses(orphanProcesses);
      }
      
      // 5. Limpar arquivos temporários e caches
      await this.cleanTemporaryFiles();
      
      // 6. Verificar integridade do banco de dados
      await this.checkDatabaseHealth();
      
      this.lastCleanup = new Date();
      
    } catch (error) {
      console.error('[CLEANUP-SERVICE] Cleanup failed:', error);
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
      
      return processes;
    } catch (error) {
      console.error('[CLEANUP-SERVICE] Failed to find Vibe Kanban processes:', error);
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
      console.warn(`[CLEANUP-SERVICE] Too many Vibe processes (${processes.length}), marking older ones as orphans`);
      
      // Ordenar por tempo e marcar os mais antigos
      const sorted = processes.sort((a, b) => a.startTime - b.startTime);
      const excess = sorted.slice(0, processes.length - 3); // Manter apenas 3 mais recentes
      
      orphans.push(...excess);
    }
    
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
    if (orphans.length === 0) return;
    
    console.log(`[CLEANUP-SERVICE] Cleaning ${orphans.length} orphan processes`);
    
    for (const orphan of orphans) {
      try {
        console.log(`[CLEANUP-SERVICE] Terminating orphan process PID:${orphan.pid} - ${orphan.command}`);
        
        // Tentar terminação graceful primeiro (SIGTERM)
        await execAsync(`kill ${orphan.pid}`);
        
        // Aguardar um pouco para terminação graceful
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar se ainda está rodando
        const stillRunning = await this.pingProcess(orphan.pid);
        
        if (stillRunning) {
          // Forçar terminação (SIGKILL)
          console.log(`[CLEANUP-SERVICE] Force killing process PID:${orphan.pid}`);
          await execAsync(`kill -9 ${orphan.pid}`);
        }
        
        console.log(`[CLEANUP-SERVICE] Successfully cleaned orphan process PID:${orphan.pid}`);
        
      } catch (error) {
        console.warn(`[CLEANUP-SERVICE] Failed to clean process PID:${orphan.pid}:`, error.message);
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
                console.log(`[CLEANUP-SERVICE] Cleaned temp file: ${filePath}`);
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
        console.warn(`[CLEANUP-SERVICE] Database size is ${sizeMB.toFixed(2)}MB - consider maintenance`);
      }
      
      // TODO: Adicionar verificações de integridade quando tiver acesso ao banco
      
    } catch (error) {
      console.warn('[CLEANUP-SERVICE] Database health check failed:', error.message);
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
    console.log('[CLEANUP-SERVICE] Performing forced cleanup...');
    await this.performCleanup();
    console.log('[CLEANUP-SERVICE] Forced cleanup completed');
  }
}

// Singleton instance
const cleanupService = new VibeKanbanCleanupService();

export default cleanupService;