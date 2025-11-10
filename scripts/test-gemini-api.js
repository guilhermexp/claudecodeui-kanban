#!/usr/bin/env node

/**
 * Script de teste para verificar a integração com Gemini API
 * Testa os endpoints:
 * - /api/ai/analyze - Análise de conteúdo
 * - /api/ai/summarize - Resumo de texto
 * - /api/tts/gemini-summarize - Geração de áudio
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 7347}`;

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

// Função para obter token JWT (simulação)
async function getAuthToken() {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test_user',
        password: 'test_password'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.token;
    }
    
    // Se falhar, usa um token dummy para teste
    return 'dummy_token_for_testing';
  } catch (error) {
    log('⚠️  Não foi possível obter token de autenticação, usando token de teste', 'yellow');
    return 'dummy_token_for_testing';
  }
}

// Teste 1: Análise de conteúdo
async function testAnalyzeEndpoint(token) {
  logSection('📊 Teste 1: Análise de Conteúdo (/api/ai/analyze)');
  
  const testContent = `
# Exemplo de Prompt
Crie um componente React que mostre uma lista de tarefas

## Variáveis
{nome}: Nome do usuário
{tema}: Tema da aplicação

## Código de exemplo
\`\`\`javascript
function TodoList() {
  const [todos, setTodos] = useState([]);
  return <div>Lista de tarefas</div>;
}
\`\`\`

## Variáveis de ambiente
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=sk-test123
SECRET_KEY=mysecret
`;

  try {
    log('Enviando conteúdo para análise...', 'cyan');
    
    const response = await fetch(`${BASE_URL}/api/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: testContent })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ Análise concluída com sucesso!', 'green');
      log(`Fonte: ${data.source}`, 'blue');
      log(`Prompts encontrados: ${data.prompts?.length || 0}`, 'blue');
      log(`Snippets encontrados: ${data.snippets?.length || 0}`, 'blue');
      log(`Variáveis de ambiente: ${data.env?.length || 0}`, 'blue');
      
      if (data.prompts?.length > 0) {
        console.log('\nPrompts:');
        data.prompts.forEach(p => console.log(`  - ${p.title}`));
      }
      
      return true;
    } else {
      log(`❌ Erro na análise: ${data.error || response.statusText}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Erro na requisição: ${error.message}`, 'red');
    return false;
  }
}

// Teste 2: Resumo de texto
async function testSummarizeEndpoint(token) {
  logSection('📝 Teste 2: Resumo de Texto (/api/ai/summarize)');
  
  const testText = `
Este é um projeto de aplicação web desenvolvido com React no frontend e Node.js no backend.
A aplicação utiliza Express para o servidor, SQLite como banco de dados, e integra com a 
Claude AI através de uma interface de linha de comando. O frontend é construído com Vite 
e usa TailwindCSS para estilização. A aplicação suporta autenticação JWT, gerenciamento 
de projetos, terminal integrado, editor de código com syntax highlighting usando CodeMirror,
e integração com Git. Também possui funcionalidades de text-to-speech usando a API do Gemini,
análise de código, e uma interface de chat overlay para interação com Claude.
`;

  try {
    log('Enviando texto para resumo...', 'cyan');
    
    const response = await fetch(`${BASE_URL}/api/ai/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        text: testText,
        language: 'pt-BR'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ Resumo gerado com sucesso!', 'green');
      log(`Modelo usado: ${data.model}`, 'blue');
      console.log('\nResumo:');
      console.log(data.summary);
      return true;
    } else {
      log(`❌ Erro no resumo: ${data.error || response.statusText}`, 'red');
      if (data.details) {
        console.log('Detalhes:', data.details);
      }
      return false;
    }
  } catch (error) {
    log(`❌ Erro na requisição: ${error.message}`, 'red');
    return false;
  }
}

// Teste 3: Geração de áudio (TTS)
async function testTTSEndpoint(token) {
  logSection('🔊 Teste 3: Geração de Áudio (TTS) (/api/tts/gemini-summarize)');
  
  const testText = `
  Olá! Este é um teste de conversão de texto em fala usando a API do Gemini.
  A aplicação está funcionando corretamente e pode gerar áudio a partir de texto.
  `;

  try {
    log('Enviando texto para conversão em áudio...', 'cyan');
    
    const response = await fetch(`${BASE_URL}/api/tts/gemini-summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        text: testText,
        voiceName: 'Zephyr',
        maxSeconds: 30
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ Áudio gerado com sucesso!', 'green');
      log(`URL do áudio: ${data.url}`, 'blue');
      
      // Tenta baixar o áudio
      if (data.url) {
        try {
          const audioResponse = await fetch(`${BASE_URL}${data.url}`);
          if (audioResponse.ok) {
            log('✅ Áudio verificado e acessível!', 'green');
          }
        } catch (e) {
          log('⚠️  Não foi possível verificar o áudio', 'yellow');
        }
      }
      
      return true;
    } else {
      log(`❌ Erro na geração de áudio: ${data.error || response.statusText}`, 'red');
      if (data.hint) {
        log(`💡 Dica: ${data.hint}`, 'yellow');
      }
      if (data.stderr) {
        console.log('Erro do Python:', data.stderr);
      }
      return false;
    }
  } catch (error) {
    log(`❌ Erro na requisição: ${error.message}`, 'red');
    return false;
  }
}

// Teste 4: Verificar configuração
async function checkConfiguration() {
  logSection('⚙️  Verificação de Configuração');
  
  const checks = {
    'GEMINI_API_KEY': !!process.env.GEMINI_API_KEY,
    'GOOGLE_API_KEY': !!process.env.GOOGLE_API_KEY,
    'JWT_SECRET': !!process.env.JWT_SECRET,
    'Servidor rodando': false,
    'Python instalado': false,
    'google-genai instalado': false
  };
  
  // Verifica se o servidor está rodando
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    checks['Servidor rodando'] = response.ok;
  } catch (error) {
    checks['Servidor rodando'] = false;
  }
  
  // Verifica Python
  try {
    const { exec } = await import('child_process');
    await new Promise((resolve) => {
      exec('python3 --version', (error) => {
        checks['Python instalado'] = !error;
        resolve();
      });
    });
  } catch (error) {
    checks['Python instalado'] = false;
  }
  
  // Verifica google-genai
  try {
    const { exec } = await import('child_process');
    await new Promise((resolve) => {
      exec('python3 -c "import google.genai"', (error) => {
        checks['google-genai instalado'] = !error;
        resolve();
      });
    });
  } catch (error) {
    checks['google-genai instalado'] = false;
  }
  
  // Exibe resultados
  let allOk = true;
  for (const [check, ok] of Object.entries(checks)) {
    if (ok) {
      log(`✅ ${check}`, 'green');
    } else {
      log(`❌ ${check}`, 'red');
      allOk = false;
    }
  }
  
  if (!checks['GEMINI_API_KEY'] && !checks['GOOGLE_API_KEY']) {
    console.log('\n⚠️  Configure uma das seguintes variáveis de ambiente:');
    console.log('   GEMINI_API_KEY=sua_chave_aqui');
    console.log('   GOOGLE_API_KEY=sua_chave_aqui');
    console.log('   Obtenha sua chave em: https://makersuite.google.com/app/apikey');
  }
  
  if (!checks['google-genai instalado']) {
    console.log('\n⚠️  Instale a biblioteca google-genai:');
    console.log('   pip3 install --user --break-system-packages google-genai');
  }
  
  return allOk;
}

// Função principal
async function main() {
  console.log(colors.bright + '\n🚀 Teste de Integração com Gemini API\n' + colors.reset);
  
  // Verificar configuração
  const configOk = await checkConfiguration();
  
  if (!configOk) {
    log('\n⚠️  Corrija os problemas de configuração antes de continuar', 'yellow');
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      log('   Use o arquivo .env.gemini-test como referência', 'yellow');
    }
    process.exit(1);
  }
  
  // Obter token de autenticação
  const token = await getAuthToken();
  
  // Executar testes
  const results = {
    analyze: await testAnalyzeEndpoint(token),
    summarize: await testSummarizeEndpoint(token),
    tts: await testTTSEndpoint(token)
  };
  
  // Resumo final
  logSection('📊 Resumo dos Testes');
  
  let passed = 0;
  let failed = 0;
  
  for (const [test, result] of Object.entries(results)) {
    if (result) {
      log(`✅ ${test}: PASSOU`, 'green');
      passed++;
    } else {
      log(`❌ ${test}: FALHOU`, 'red');
      failed++;
    }
  }
  
  console.log(`\n${colors.bright}Total: ${passed} passou, ${failed} falhou${colors.reset}`);
  
  if (failed === 0) {
    log('\n🎉 Todos os testes passaram! A integração com Gemini está funcionando.', 'green');
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique a configuração e tente novamente.', 'yellow');
  }
}

// Executar
main().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});