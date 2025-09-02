#!/usr/bin/env node

import { 
  getProjects, 
  getSessions,
  getSessionMessages,
  renameProject,
  isProjectEmpty,
  getProjectManager,
  clearProjectDirectoryCache,
  ProjectError,
  ValidationError,
  NotFoundError
} from './server/projects.js';
import chalk from 'chalk';

// Helper para logs coloridos
const log = {
  test: (msg) => console.log(chalk.cyan(`\n📋 ${msg}`)),
  success: (msg) => console.log(chalk.green(`   ✅ ${msg}`)),
  error: (msg) => console.log(chalk.red(`   ❌ ${msg}`)),
  info: (msg) => console.log(chalk.gray(`   ℹ️  ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`   ⚠️  ${msg}`))
};

console.log(chalk.bold.magenta('\n🧪 SUITE COMPLETA DE TESTES - MÓDULO PROJECTS REFATORADO\n'));
console.log(chalk.gray('═'.repeat(60)));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(testName, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    log.success(testName);
    return true;
  } catch (error) {
    failedTests++;
    log.error(`${testName}: ${error.message}`);
    return false;
  }
}

async function testSuite() {
  const startTime = Date.now();

  // ========== TESTE 1: LISTAGEM DE PROJETOS ==========
  log.test('TESTE 1: Listagem de Projetos');
  
  let projects = [];
  await runTest('Deve carregar lista de projetos', async () => {
    projects = await getProjects();
    if (!Array.isArray(projects)) throw new Error('Projects não é um array');
    if (projects.length === 0) throw new Error('Nenhum projeto encontrado');
  });

  await runTest('Projetos devem ter estrutura correta', async () => {
    const project = projects[0];
    if (!project.name) throw new Error('Campo name ausente');
    if (!project.path) throw new Error('Campo path ausente');
    if (!project.displayName) throw new Error('Campo displayName ausente');
    if (!project.sessionMeta) throw new Error('Campo sessionMeta ausente');
  });

  await runTest('Projetos devem estar ordenados por atividade recente', async () => {
    for (let i = 1; i < Math.min(projects.length, 5); i++) {
      const prevTime = new Date(projects[i-1].lastActivity || 0);
      const currTime = new Date(projects[i].lastActivity || 0);
      if (prevTime < currTime) {
        throw new Error('Projetos não estão ordenados corretamente');
      }
    }
  });

  log.info(`Total de projetos encontrados: ${projects.length}`);

  // ========== TESTE 2: CARREGAMENTO DE SESSÕES ==========
  log.test('TESTE 2: Carregamento de Sessões');

  if (projects.length > 0) {
    const testProject = projects[0];
    
    await runTest('Deve carregar sessões de um projeto', async () => {
      const result = await getSessions(testProject.name, 5, 0);
      if (!result.sessions) throw new Error('Campo sessions ausente');
      if (typeof result.total !== 'number') throw new Error('Campo total ausente');
      if (typeof result.hasMore !== 'boolean') throw new Error('Campo hasMore ausente');
    });

    await runTest('Paginação deve funcionar corretamente', async () => {
      const page1 = await getSessions(testProject.name, 2, 0);
      const page2 = await getSessions(testProject.name, 2, 2);
      
      if (page1.sessions.length > 0 && page2.sessions.length > 0) {
        const id1 = page1.sessions[0].id;
        const id2 = page2.sessions[0].id;
        if (id1 === id2) throw new Error('Paginação retornando mesmos dados');
      }
    });

    await runTest('Sessões devem ter campos de data', async () => {
      const result = await getSessions(testProject.name, 1, 0);
      if (result.sessions.length > 0) {
        const session = result.sessions[0];
        if (!session.updated_at) throw new Error('Campo updated_at ausente');
        if (!session.created_at) throw new Error('Campo created_at ausente');
        if (!session.lastActivity) throw new Error('Campo lastActivity ausente');
      }
    });
  }

  // ========== TESTE 3: VALIDAÇÃO DE SEGURANÇA ==========
  log.test('TESTE 3: Validação de Segurança');

  await runTest('Deve bloquear path traversal em nomes de projeto', async () => {
    try {
      await getSessions('../../etc/passwd', 1, 0);
      throw new Error('Path traversal não foi bloqueado');
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw new Error('Erro incorreto para path traversal');
      }
    }
  });

  await runTest('Deve bloquear caracteres nulos', async () => {
    try {
      await getSessions('test\x00malicious', 1, 0);
      // Se não lançar erro, o teste falha
      throw new Error('Caracteres nulos não foram bloqueados');
    } catch (error) {
      if (error.message === 'Caracteres nulos não foram bloqueados') throw error;
      // Esperado - validação funcionou
    }
  });

  await runTest('Deve validar IDs de sessão', async () => {
    try {
      if (projects.length > 0) {
        await getSessionMessages(projects[0].name, '../../../etc/passwd');
        throw new Error('ID de sessão malicioso não foi bloqueado');
      }
    } catch (error) {
      if (error.message === 'ID de sessão malicioso não foi bloqueado') throw error;
      // Esperado - validação funcionou
    }
  });

  await runTest('Deve limitar tamanho de requisições', async () => {
    const result = await getSessions(projects[0]?.name || 'test', 200, 0);
    if (result.sessions.length > 100) {
      throw new Error('Limite de sessões por requisição não aplicado');
    }
  });

  // ========== TESTE 4: PERFORMANCE DO CACHE ==========
  log.test('TESTE 4: Performance do Cache');

  const manager = getProjectManager();

  await runTest('Cache deve acelerar segunda chamada', async () => {
    clearProjectDirectoryCache();
    
    const start1 = Date.now();
    await getProjects();
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await getProjects();
    const time2 = Date.now() - start2;
    
    if (time2 >= time1) {
      throw new Error(`Cache não melhorou performance: ${time1}ms vs ${time2}ms`);
    }
    
    log.info(`Primeira chamada: ${time1}ms, Segunda (cached): ${time2}ms`);
  });

  await runTest('Cache deve ter estatísticas disponíveis', async () => {
    const stats = manager.getCacheStats();
    if (!stats || typeof stats !== 'object') {
      throw new Error('Cache stats não disponível');
    }
    
    const cacheTypes = Object.keys(stats);
    log.info(`Caches ativos: ${cacheTypes.join(', ')}`);
  });

  await runTest('Cache deve invalidar corretamente', async () => {
    const statsBefore = manager.getCacheStats();
    manager.clearCache();
    const statsAfter = manager.getCacheStats();
    
    const hasItems = Object.values(statsAfter).some(cache => cache.size > 0);
    if (hasItems) {
      throw new Error('Cache não foi limpo completamente');
    }
  });

  // ========== TESTE 5: OPERAÇÕES CRUD ==========
  log.test('TESTE 5: Operações CRUD');

  if (projects.length > 0) {
    const testProject = projects[0];
    const originalName = testProject.displayName;

    await runTest('Deve verificar se projeto está vazio', async () => {
      const isEmpty = await isProjectEmpty(testProject.name);
      if (typeof isEmpty !== 'boolean') {
        throw new Error('isProjectEmpty deve retornar boolean');
      }
    });

    await runTest('Deve renomear display name do projeto', async () => {
      const newName = `Test_${Date.now()}`;
      await renameProject(testProject.name, newName);
      
      // Verificar se mudou
      const updatedProjects = await getProjects();
      const updated = updatedProjects.find(p => p.name === testProject.name);
      
      if (!updated || updated.displayName !== newName) {
        // Restaurar nome original
        await renameProject(testProject.name, originalName);
        throw new Error('Rename não funcionou');
      }
      
      // Restaurar nome original
      await renameProject(testProject.name, originalName);
    });

    await runTest('Deve lidar com mensagens de sessão', async () => {
      const result = await getSessions(testProject.name, 1, 0);
      if (result.sessions.length > 0) {
        const messages = await getSessionMessages(testProject.name, result.sessions[0].id);
        if (!Array.isArray(messages)) {
          throw new Error('getSessionMessages deve retornar array');
        }
      }
    });
  }

  // ========== TESTE 6: TRATAMENTO DE ERROS ==========
  log.test('TESTE 6: Tratamento de Erros');

  await runTest('Deve usar classes de erro customizadas', async () => {
    // Testar se as classes de erro existem
    if (!ProjectError) throw new Error('ProjectError não existe');
    if (!ValidationError) throw new Error('ValidationError não existe');
    if (!NotFoundError) throw new Error('NotFoundError não existe');
    
    // Testar herança
    const validationError = new ValidationError('test');
    if (!(validationError instanceof ProjectError)) {
      throw new Error('ValidationError não herda de ProjectError');
    }
  });

  await runTest('Deve tratar projetos inexistentes gracefully', async () => {
    const result = await getSessions('projeto-inexistente-xyz-123', 5, 0);
    if (!result || result.sessions === undefined) {
      throw new Error('Deve retornar estrutura vazia para projeto inexistente');
    }
    if (result.total !== 0) {
      throw new Error('Total deve ser 0 para projeto inexistente');
    }
  });

  // ========== TESTE 7: LIMITES E SANITIZAÇÃO ==========
  log.test('TESTE 7: Limites e Sanitização');

  await runTest('Deve aplicar limites de paginação', async () => {
    if (projects.length > 0) {
      const result = await getSessions(projects[0].name, 999, 0);
      if (result.limit > 100) {
        throw new Error('Limite máximo não aplicado');
      }
    }
  });

  await runTest('Deve sanitizar offset negativo', async () => {
    if (projects.length > 0) {
      const result = await getSessions(projects[0].name, 5, -10);
      if (result.offset < 0) {
        throw new Error('Offset negativo não sanitizado');
      }
    }
  });

  // ========== RESUMO DOS TESTES ==========
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(chalk.gray('\n' + '═'.repeat(60)));
  console.log(chalk.bold.cyan('\n📊 RESUMO DOS TESTES\n'));
  
  console.log(chalk.white(`   Total de testes: ${totalTests}`));
  console.log(chalk.green(`   Passou: ${passedTests}`));
  console.log(chalk.red(`   Falhou: ${failedTests}`));
  console.log(chalk.gray(`   Tempo total: ${duration}ms`));
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  if (failedTests === 0) {
    console.log(chalk.bold.green(`\n🎉 TODOS OS TESTES PASSARAM! (${successRate}% de sucesso)\n`));
  } else {
    console.log(chalk.bold.yellow(`\n⚠️  ALGUNS TESTES FALHARAM (${successRate}% de sucesso)\n`));
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

// Executar suite de testes
testSuite().catch(error => {
  console.error(chalk.bold.red('\n💥 ERRO FATAL NA EXECUÇÃO DOS TESTES:'), error);
  process.exit(1);
});