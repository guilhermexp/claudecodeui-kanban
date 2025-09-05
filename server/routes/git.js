import express from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';
import { extractProjectDirectory } from '../projects.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const log = createLogger('GIT');
const execAsync = promisify(exec);

// Helper function to check if project is standalone mode
function isStandaloneProject(projectName) {
  return projectName === 'claude/standalone' || 
         projectName.includes('standalone') ||
         projectName === 'claude-standalone';
}

// Helper function to get the actual project path from the encoded project name
async function getActualProjectPath(projectName) {
  try {
    return await extractProjectDirectory(projectName);
  } catch (error) {
    log.error(`Error extracting project directory for ${projectName}: ${error.message}`);
    // Fallback to the old method
    return projectName.replace(/-/g, '/');
  }
}

// Helper function to validate git repository and return git root
async function validateGitRepository(projectPath) {
  try {
    // Check if directory exists
    await fs.access(projectPath);
  } catch {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Use --show-toplevel to get the root of the git repository
    const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: projectPath });
    const normalizedGitRoot = path.resolve(gitRoot.trim());
    
    // Return the git root directory - we'll use this for git commands
    return normalizedGitRoot;
  } catch (error) {
    // If not in a git repository at all, return null
    if (error.message.includes('not a git repository')) {
      return null;
    }
    throw error;
  }
}

// Helper to get git root with fallback to project path
async function getGitRoot(projectPath) {
  const gitRoot = await validateGitRepository(projectPath);
  // If not a git repo, just return the project path
  return gitRoot || projectPath;
}

// Get git status for a project
router.get('/status', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Skip git operations for standalone mode
  if (isStandaloneProject(project)) {
    return res.json({
      branch: null,
      modified: [],
      added: [],
      deleted: [],
      untracked: [],
      ahead: 0,
      behind: 0,
      isRepository: false,
      isStandalone: true
    });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      // Not a git repository
      return res.json({
        branch: null,
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
        ahead: 0,
        behind: 0,
        isRepository: false
      });
    }

    // Get current branch
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
    
    // Get git status - but we need to filter for files in the project subdirectory
    const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: gitRoot });
    
    const modified = [];
    const added = [];
    const deleted = [];
    const untracked = [];
    
    // Calculate relative path from git root to project path
    const relativeProjectPath = path.relative(gitRoot, projectPath);
    const isSubdirectory = relativeProjectPath && relativeProjectPath !== '';
    
    statusOutput.split('\n').forEach(line => {
      if (!line.trim()) return;
      
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      // If we're in a subdirectory, only include files from that subdirectory
      if (isSubdirectory && !file.startsWith(relativeProjectPath + '/')) {
        return;
      }
      
      // If in subdirectory, make paths relative to the project directory
      const displayFile = isSubdirectory ? file.substring(relativeProjectPath.length + 1) : file;
      
      if (status === 'M ' || status === ' M' || status === 'MM') {
        modified.push(displayFile);
      } else if (status === 'A ' || status === 'AM') {
        added.push(displayFile);
      } else if (status === 'D ' || status === ' D') {
        deleted.push(displayFile);
      } else if (status === '??') {
        untracked.push(displayFile);
      }
    });
    
    res.json({
      branch: branch.trim(),
      modified,
      added,
      deleted,
      untracked
    });
  } catch (error) {
    log.error(`Status error: ${error.message}`);
    res.json({ 
      error: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository') 
        ? error.message 
        : 'Git operation failed',
      details: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
        ? error.message
        : `Failed to get git status: ${error.message}`
    });
  }
});

// Get diff for a specific file
router.get('/diff', async (req, res) => {
  const { project, file } = req.query;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Check if file is untracked
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: gitRoot });
    const isUntracked = statusOutput.startsWith('??');
    
    let diff;
    if (isUntracked) {
      // For untracked files, show the entire file content as additions
      const fileContent = await fs.readFile(path.join(projectPath, file), 'utf-8');
      const lines = fileContent.split('\n');
      diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + 
             lines.map(line => `+${line}`).join('\n');
    } else {
      // Get diff for tracked files
      const { stdout } = await execAsync(`git diff HEAD -- "${file}"`, { cwd: gitRoot });
      diff = stdout || '';
      
      // If no unstaged changes, check for staged changes
      if (!diff) {
        const { stdout: stagedDiff } = await execAsync(`git diff --cached -- "${file}"`, { cwd: gitRoot });
        diff = stagedDiff;
      }
    }
    
    res.json({ diff });
  } catch (error) {
    log.error(`Diff error: ${error.message}`);
    res.json({ error: error.message });
  }
});

// Commit changes
router.post('/commit', async (req, res) => {
  const { project, message, files } = req.body;
  
  if (!project || !message || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name, commit message, and files are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Stage selected files
    for (const file of files) {
      await execAsync(`git add "${file}"`, { cwd: gitRoot });
    }
    
    // Commit with message
    const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: gitRoot });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    log.error(`Commit error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get list of branches
router.get('/branches', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Skip git operations for standalone mode
  if (isStandaloneProject(project)) {
    return res.json({
      branches: [],
      current: null,
      isStandalone: true
    });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.json({ branches: [], current: null });
    }
    
    // Get all branches
    const { stdout } = await execAsync('git branch -a', { cwd: gitRoot });
    
    // Parse branches
    const branches = stdout
      .split('\n')
      .map(branch => branch.trim())
      .filter(branch => branch && !branch.includes('->')) // Remove empty lines and HEAD pointer
      .map(branch => {
        // Remove asterisk from current branch
        if (branch.startsWith('* ')) {
          return branch.substring(2);
        }
        // Remove remotes/ prefix
        if (branch.startsWith('remotes/origin/')) {
          return branch.substring(15);
        }
        return branch;
      })
      .filter((branch, index, self) => self.indexOf(branch) === index); // Remove duplicates
    
    res.json({ branches });
  } catch (error) {
    log.error(`Branches error: ${error.message}`);
    res.json({ error: error.message });
  }
});

// Checkout branch
router.post('/checkout', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Checkout the branch
    const { stdout } = await execAsync(`git checkout "${branch}"`, { cwd: gitRoot });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    log.error(`Checkout error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Create new branch
router.post('/create-branch', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch name are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Create and checkout new branch
    const { stdout } = await execAsync(`git checkout -b "${branch}"`, { cwd: gitRoot });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    log.error(`Create branch error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get recent commits
router.get('/commits', async (req, res) => {
  const { project, limit = 10 } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.json({ commits: [] });
    }
    
    // Get commit log with stats
    const { stdout } = await execAsync(
      `git log --pretty=format:'%H|%an|%ae|%ad|%s' --date=relative -n ${limit}`,
      { cwd: gitRoot }
    );
    
    const commits = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, author, email, date, ...messageParts] = line.split('|');
        return {
          hash,
          author,
          email,
          date,
          message: messageParts.join('|')
        };
      });
    
    // Get stats for each commit
    for (const commit of commits) {
      try {
        const { stdout: stats } = await execAsync(
          `git show --stat --format='' ${commit.hash}`,
          { cwd: gitRoot }
        );
        commit.stats = stats.trim().split('\n').pop(); // Get the summary line
      } catch (error) {
        commit.stats = '';
      }
    }
    
    res.json({ commits });
  } catch (error) {
    log.error(`Commits error: ${error.message}`);
    res.json({ error: error.message });
  }
});

// Get diff for a specific commit
router.get('/commit-diff', async (req, res) => {
  const { project, commit } = req.query;
  
  if (!project || !commit) {
    return res.status(400).json({ error: 'Project name and commit hash are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Get diff for the commit
    const { stdout } = await execAsync(
      `git show ${commit}`,
      { cwd: gitRoot }
    );
    
    res.json({ diff: stdout });
  } catch (error) {
    log.error(`Commit diff error: ${error.message}`);
    res.json({ error: error.message });
  }
});

// Generate commit message based on staged changes
router.post('/generate-commit-message', async (req, res) => {
  const { project, files } = req.body;
  
  if (!project || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name and files are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Validate git repository and get git root
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    
    // Get diff for selected files
    let combinedDiff = '';
    for (const file of files) {
      try {
        const { stdout } = await execAsync(
          `git diff HEAD -- "${file}"`,
          { cwd: gitRoot }
        );
        if (stdout) {
          combinedDiff += `\n--- ${file} ---\n${stdout}`;
        }
      } catch (error) {
        log.warn(`Error getting diff for ${file}: ${error.message}`);
      }
    }
    
    // Use Claude AI to generate intelligent commit message
    const message = await generateSmartCommitMessage(files, combinedDiff, gitRoot);
    
    res.json({ message });
  } catch (error) {
    log.error(`Generate commit message error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to extract modified functions/components from diff
function extractModifiedFunctions(diff) {
  const functions = new Set();
  
  // Match function declarations and React components
  const patterns = [
    /^[+-].*function\s+(\w+)/gm,
    /^[+-].*const\s+(\w+)\s*=\s*\(/gm,
    /^[+-].*const\s+(\w+)\s*=\s*async/gm,
    /^[+-].*export\s+default\s+function\s+(\w+)/gm,
    /^[+-].*export\s+function\s+(\w+)/gm,
    /^[+-].*class\s+(\w+)/gm,
    /^[+-].*interface\s+(\w+)/gm,
    /^[+-].*type\s+(\w+)/gm,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(diff)) !== null) {
      if (match[1] && match[1].length > 2) {
        functions.add(match[1]);
      }
    }
  });
  
  return Array.from(functions).slice(0, 5); // Limit to 5 most relevant
}

// Helper function to extract file types from file paths
function extractFileTypes(files) {
  const types = new Set();
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const dir = path.dirname(file).split('/').pop();
    
    // Categorize by extension and directory
    if (['.jsx', '.tsx'].includes(ext)) {
      types.add('React Component');
    } else if (['.js', '.ts'].includes(ext)) {
      if (dir === 'routes' || dir === 'api') {
        types.add('API');
      } else if (dir === 'utils' || dir === 'lib') {
        types.add('Utility');
      } else {
        types.add('JavaScript');
      }
    } else if (['.css', '.scss', '.sass'].includes(ext)) {
      types.add('Styles');
    } else if (['.json'].includes(ext)) {
      types.add('Config');
    } else if (['.md', '.txt'].includes(ext)) {
      types.add('Documentation');
    }
  });
  
  return Array.from(types);
}

// Enhanced commit message generator using Gemini 2.0 Flash
async function generateSmartCommitMessage(files, diff, projectPath) {
  try {
    // Get API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      log.warn('No Gemini API key found, using simple commit message generator');
      return generateSimpleCommitMessage(files, diff);
    }

    // Use Gemini 2.0 Flash for fast, quality commit messages
    const model = 'gemini-2.0-flash-exp';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Analyze diff to extract key information
    const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
    const deletedLines = (diff.match(/^-[^-]/gm) || []).length;
    const modifiedFunctions = extractModifiedFunctions(diff);
    const fileTypes = extractFileTypes(files);
    
    // Get additional context
    let recentCommits = '';
    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:'%s' -n 5`,
        { cwd: projectPath }
      );
      recentCommits = stdout;
    } catch (error) {
      // Ignore if git log fails
    }

    // Create a more detailed prompt for Gemini to generate a commit message
    const prompt = `Você é um especialista em Git e desenvolvimento de software. Analise as mudanças abaixo e gere uma mensagem de commit profissional.

**CONTEXTO DO PROJETO:**
- Arquivos modificados: ${files.length} arquivo(s)
- Tipos de arquivo: ${fileTypes.join(', ')}
- Linhas adicionadas: ${addedLines}
- Linhas removidas: ${deletedLines}
- Funções/componentes modificados: ${modifiedFunctions.length > 0 ? modifiedFunctions.join(', ') : 'N/A'}

**COMMITS RECENTES (para contexto):**
${recentCommits || 'N/A'}

**REGRAS OBRIGATÓRIAS:**
1. Use o formato Conventional Commit: tipo(escopo): descrição
2. Tipos permitidos e quando usar:
   - feat: nova funcionalidade adicionada
   - fix: correção de bug ou erro
   - refactor: reestruturação sem alterar funcionalidade
   - style: formatação, espaços, vírgulas, etc
   - docs: documentação apenas
   - test: adição ou correção de testes
   - chore: manutenção, build, dependências
   - perf: melhorias de performance

3. O escopo deve ser específico baseado nos arquivos:
   - Para componentes React: use o nome do componente
   - Para APIs: use o endpoint ou recurso
   - Para configurações: use o tipo de config
   
4. A descrição deve:
   - Ser específica sobre O QUE mudou e POR QUE (se evidente no diff)
   - Usar português brasileiro
   - Começar com verbo no presente (adiciona, corrige, remove, atualiza, etc)
   - Mencionar componentes/funções específicos quando relevante
   - Ser concisa mas informativa (máximo 72 caracteres total)

5. NÃO use emojis na mensagem

**ANÁLISE DO DIFF:**
Analise cuidadosamente o diff abaixo para entender:
- Qual é a mudança principal?
- É uma nova feature, correção ou refatoração?
- Quais componentes/módulos foram afetados?
- Há mudanças em lógica de negócio importante?

**ARQUIVOS MODIFICADOS:**
${files.map(f => `- ${f}`).join('\n')}

**DIFF DETALHADO (primeiros 8000 caracteres para análise completa):**
\`\`\`diff
${diff.substring(0, 8000)} ${diff.length > 8000 ? '\n... (diff continua, total de ' + diff.length + ' caracteres)' : ''}
\`\`\`

**INSTRUÇÕES FINAIS:**
- Retorne APENAS a mensagem de commit, sem explicações
- A mensagem deve capturar a essência da mudança
- Seja específico sobre componentes/funções modificados
- Evite mensagens genéricas como "atualiza código" ou "corrige bugs"

MENSAGEM DE COMMIT:`

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4, // Slightly higher for more creative descriptions
        maxOutputTokens: 150, // Allow for more detailed messages
        topP: 0.9,
        topK: 50
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Gemini API error: ${response.status} - ${errorText}`);
      return generateSimpleCommitMessage(files, diff);
    }

    const data = await response.json();
    const commitMessage = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (commitMessage) {
      // Clean and validate the commit message
      const lines = commitMessage.split('\n');
      
      // Find a line that matches Conventional Commit format (without requiring emoji)
      const validMessage = lines.find(line => 
        line.match(/^(feat|fix|refactor|style|docs|test|chore|perf)(\([^)]+\))?:\s*.+/i)
      ) || lines[0];
      
      // Clean up the message
      let finalMessage = validMessage
        .replace(/^\s*[-*]\s*/, '') // Remove bullet points if any
        .replace(/^```.*?\n?/, '') // Remove code block markers
        .replace(/```$/, '')
        .trim();
      
      // Ensure it's not too long (72 chars for subject line)
      if (finalMessage.length > 72) {
        // Try to cut at a sensible point
        const colonIndex = finalMessage.indexOf(':');
        if (colonIndex > 0 && colonIndex < 30) {
          // Keep the type and scope, truncate the description
          const prefix = finalMessage.substring(0, colonIndex + 1);
          const description = finalMessage.substring(colonIndex + 1).trim();
          const maxDescLength = 72 - prefix.length - 1;
          finalMessage = prefix + ' ' + description.substring(0, maxDescLength).trim();
        } else {
          finalMessage = finalMessage.substring(0, 72).trim();
        }
      }
      
      log.info(`Generated commit message with Gemini: ${finalMessage}`);
      return finalMessage;
    } else {
      log.warn('No valid commit message from Gemini, using fallback');
      return generateSimpleCommitMessage(files, diff);
    }
  } catch (error) {
    log.error(`Gemini commit message error: ${error.message}`);
    // Fallback to simple message generator
    return generateSimpleCommitMessage(files, diff);
  }
}

// Simple commit message generator (fallback)
function generateSimpleCommitMessage(files, diff) {
  const fileCount = files.length;
  const isMultipleFiles = fileCount > 1;
  
  // Analyze the diff to determine the type of change
  const additions = (diff.match(/^\+[^+]/gm) || []).length;
  const deletions = (diff.match(/^-[^-]/gm) || []).length;
  
  // Extract component/module names
  const extractComponentName = (filePath) => {
    const fileName = filePath.split('/').pop();
    return fileName.replace(/\.(jsx?|tsx?|css|scss|json|md)$/, '');
  };
  
  // Determine the type and action based on file patterns and changes
  let type = 'chore';
  let action = 'atualiza';
  
  // Check file extensions to determine type
  const hasReactFiles = files.some(f => /\.(jsx|tsx)$/.test(f));
  const hasApiFiles = files.some(f => f.includes('/routes/') || f.includes('/api/'));
  const hasStyleFiles = files.some(f => /\.(css|scss|sass)$/.test(f));
  const hasConfigFiles = files.some(f => /\.(json|yml|yaml|config\.)/.test(f));
  const hasTestFiles = files.some(f => /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(f));
  
  // Determine type based on files
  if (hasTestFiles) {
    type = 'test';
    action = additions > deletions ? 'adiciona' : 'corrige';
  } else if (hasApiFiles) {
    type = additions > deletions * 2 ? 'feat' : 'fix';
    action = additions > deletions ? 'implementa' : 'corrige';
  } else if (hasReactFiles) {
    if (additions > 0 && deletions === 0) {
      type = 'feat';
      action = 'cria';
    } else if (deletions > additions * 2) {
      type = 'refactor';
      action = 'refatora';
    } else if (additions > deletions * 2) {
      type = 'feat';
      action = 'adiciona';
    } else {
      type = 'fix';
      action = 'corrige';
    }
  } else if (hasStyleFiles) {
    type = 'style';
    action = 'ajusta';
  } else if (hasConfigFiles) {
    type = 'chore';
    action = 'configura';
  }
  
  // Generate scope and description
  let scope = '';
  let description = '';
  
  if (isMultipleFiles) {
    // Find common directory
    const dirs = new Set(files.map(f => {
      const parts = f.split('/');
      return parts.length > 1 ? parts[parts.length - 2] : '';
    }).filter(d => d));
    
    if (dirs.size === 1) {
      scope = [...dirs][0];
      const components = files.map(extractComponentName).slice(0, 2).join(' e ');
      description = `${action} ${components}`;
    } else {
      // Multiple directories - be more generic
      if (hasReactFiles) scope = 'components';
      else if (hasApiFiles) scope = 'api';
      else scope = 'app';
      description = `${action} ${fileCount} arquivos`;
    }
  } else {
    // Single file - be specific
    const filePath = files[0];
    const fileName = extractComponentName(filePath);
    const parts = filePath.split('/');
    
    // Use parent directory as scope if meaningful
    if (parts.length > 1) {
      const parentDir = parts[parts.length - 2];
      if (['components', 'routes', 'utils', 'hooks', 'services'].includes(parentDir)) {
        scope = fileName;
      } else {
        scope = parentDir;
      }
    } else {
      scope = fileName;
    }
    
    description = `${action} ${scope === fileName ? 'funcionalidade' : fileName}`;
  }
  
  // Build the commit message
  const message = scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;
  
  // Ensure it's not too long
  return message.length > 72 ? message.substring(0, 72).trim() : message;
}

// Get remote status (ahead/behind commits with smart remote detection)
router.get('/remote-status', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Skip git operations for standalone mode
  if (isStandaloneProject(project)) {
    return res.json({
      ahead: 0,
      behind: 0,
      hasRemote: false,
      isStandalone: true
    });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.json({ ahead: 0, behind: 0, hasRemote: false });
    }

    // Get current branch
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
    const branch = currentBranch.trim();

    // Check if there's a remote tracking branch (smart detection)
    let trackingBranch;
    let remoteName;
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: gitRoot });
      trackingBranch = stdout.trim();
      remoteName = trackingBranch.split('/')[0]; // Extract remote name (e.g., "origin/main" -> "origin")
    } catch (error) {
      // No upstream branch configured - but check if we have remotes
      let hasRemote = false;
      let remoteName = null;
      try {
        const { stdout } = await execAsync('git remote', { cwd: gitRoot });
        const remotes = stdout.trim().split('\n').filter(r => r.trim());
        if (remotes.length > 0) {
          hasRemote = true;
          remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
        }
      } catch (remoteError) {
        // No remotes configured
      }
      
      return res.json({ 
        hasRemote,
        hasUpstream: false,
        branch,
        remoteName,
        message: 'No remote tracking branch configured'
      });
    }

    // Get ahead/behind counts
    const { stdout: countOutput } = await execAsync(
      `git rev-list --count --left-right ${trackingBranch}...HEAD`,
      { cwd: gitRoot }
    );
    
    const [behind, ahead] = countOutput.trim().split('\t').map(Number);

    res.json({
      hasRemote: true,
      hasUpstream: true,
      branch,
      remoteBranch: trackingBranch,
      remoteName,
      ahead: ahead || 0,
      behind: behind || 0,
      isUpToDate: ahead === 0 && behind === 0
    });
  } catch (error) {
    log.error(`Remote status error: ${error.message}`);
    res.json({ error: error.message });
  }
});

// Fetch from remote (using smart remote detection)
router.post('/fetch', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    // Get current branch and its upstream remote
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // fallback
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: gitRoot });
      remoteName = stdout.trim().split('/')[0]; // Extract remote name
    } catch (error) {
      // No upstream, try to fetch from origin anyway
    }

    const { stdout } = await execAsync(`git fetch ${remoteName}`, { cwd: gitRoot });
    
    res.json({ success: true, output: stdout || 'Fetch completed successfully', remoteName });
  } catch (error) {
    log.error(`Fetch error: ${error.message}`);
    res.status(500).json({ 
      error: 'Fetch failed', 
      details: error.message.includes('Could not resolve hostname') 
        ? 'Unable to connect to remote repository. Check your internet connection.'
        : error.message.includes('fatal: \'origin\' does not appear to be a git repository')
        ? 'No remote repository configured. Add a remote with: git remote add origin <url>'
        : error.message
    });
  }
});

// Pull from remote (fetch + merge using smart remote detection)
router.post('/pull', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    // Get current branch and its upstream remote
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // fallback
    let remoteBranch = branch; // fallback
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: gitRoot });
      const tracking = stdout.trim();
      remoteName = tracking.split('/')[0]; // Extract remote name
      remoteBranch = tracking.split('/').slice(1).join('/'); // Extract branch name
    } catch (error) {
      // No upstream, use fallback
    }

    const { stdout } = await execAsync(`git pull ${remoteName} ${remoteBranch}`, { cwd: gitRoot });
    
    res.json({ 
      success: true, 
      output: stdout || 'Pull completed successfully', 
      remoteName,
      remoteBranch
    });
  } catch (error) {
    log.error(`Pull error: ${error.message}`);
    
    // Enhanced error handling for common pull scenarios
    let errorMessage = 'Pull failed';
    let details = error.message;
    
    if (error.message.includes('CONFLICT')) {
      errorMessage = 'Merge conflicts detected';
      details = 'Pull created merge conflicts. Please resolve conflicts manually in the editor, then commit the changes.';
    } else if (error.message.includes('Please commit your changes or stash them')) {
      errorMessage = 'Uncommitted changes detected';  
      details = 'Please commit or stash your local changes before pulling.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
    } else if (error.message.includes('diverged')) {
      errorMessage = 'Branches have diverged';
      details = 'Your local branch and remote branch have diverged. Consider fetching first to review changes.';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// Push commits to remote repository
router.post('/push', async (req, res) => {
  const { project } = req.body;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    // Get current branch and its upstream remote
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
    const branch = currentBranch.trim();

    let remoteName = 'origin'; // fallback
    let remoteBranch = branch; // fallback
    try {
      const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: gitRoot });
      const tracking = stdout.trim();
      remoteName = tracking.split('/')[0]; // Extract remote name
      remoteBranch = tracking.split('/').slice(1).join('/'); // Extract branch name
    } catch (error) {
      // No upstream, use fallback
    }

    const { stdout } = await execAsync(`git push ${remoteName} ${remoteBranch}`, { cwd: gitRoot });
    
    res.json({ 
      success: true, 
      output: stdout || 'Push completed successfully', 
      remoteName,
      remoteBranch
    });
  } catch (error) {
    log.error(`Push error: ${error.message}`);
    
    // Enhanced error handling for common push scenarios
    let errorMessage = 'Push failed';
    let details = error.message;
    
    if (error.message.includes('rejected')) {
      errorMessage = 'Push rejected';
      details = 'The remote has newer commits. Pull first to merge changes before pushing.';
    } else if (error.message.includes('non-fast-forward')) {
      errorMessage = 'Non-fast-forward push';
      details = 'Your branch is behind the remote. Pull the latest changes first.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
    } else if (error.message.includes('Permission denied')) {
      errorMessage = 'Authentication failed';
      details = 'Permission denied. Check your credentials or SSH keys.';
    } else if (error.message.includes('no upstream branch')) {
      errorMessage = 'No upstream branch';
      details = 'No upstream branch configured. Use: git push --set-upstream origin <branch>';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// Publish branch to remote (set upstream and push)
router.post('/publish', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    // Get current branch to verify it matches the requested branch
    const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: gitRoot });
    const currentBranchName = currentBranch.trim();
    
    if (currentBranchName !== branch) {
      return res.status(400).json({ 
        error: `Branch mismatch. Current branch is ${currentBranchName}, but trying to publish ${branch}` 
      });
    }

    // Check if remote exists
    let remoteName = 'origin';
    try {
      const { stdout } = await execAsync('git remote', { cwd: gitRoot });
      const remotes = stdout.trim().split('\n').filter(r => r.trim());
      if (remotes.length === 0) {
        return res.status(400).json({ 
          error: 'No remote repository configured. Add a remote with: git remote add origin <url>' 
        });
      }
      remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
    } catch (error) {
      return res.status(400).json({ 
        error: 'No remote repository configured. Add a remote with: git remote add origin <url>' 
      });
    }

    // Publish the branch (set upstream and push)
    const { stdout } = await execAsync(`git push --set-upstream ${remoteName} ${branch}`, { cwd: gitRoot });
    
    res.json({ 
      success: true, 
      output: stdout || 'Branch published successfully', 
      remoteName,
      branch
    });
  } catch (error) {
    log.error(`Publish error: ${error.message}`);
    
    // Enhanced error handling for common publish scenarios
    let errorMessage = 'Publish failed';
    let details = error.message;
    
    if (error.message.includes('rejected')) {
      errorMessage = 'Publish rejected';
      details = 'The remote branch already exists and has different commits. Use push instead.';
    } else if (error.message.includes('Could not resolve hostname')) {
      errorMessage = 'Network error';
      details = 'Unable to connect to remote repository. Check your internet connection.';
    } else if (error.message.includes('Permission denied')) {
      errorMessage = 'Authentication failed';
      details = 'Permission denied. Check your credentials or SSH keys.';
    } else if (error.message.includes('fatal:') && error.message.includes('does not appear to be a git repository')) {
      errorMessage = 'Remote not configured';
      details = 'Remote repository not properly configured. Check your remote URL.';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: details
    });
  }
});

// Discard changes for a specific file
router.post('/discard', async (req, res) => {
  const { project, file } = req.body;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    // Check file status to determine correct discard command
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: gitRoot });
    
    if (!statusOutput.trim()) {
      return res.status(400).json({ error: 'No changes to discard for this file' });
    }

    const status = statusOutput.substring(0, 2);
    
    if (status === '??') {
      // Untracked file - delete it
      await fs.unlink(path.join(projectPath, file));
    } else if (status.includes('M') || status.includes('D')) {
      // Modified or deleted file - restore from HEAD
      await execAsync(`git restore "${file}"`, { cwd: gitRoot });
    } else if (status.includes('A')) {
      // Added file - unstage it
      await execAsync(`git reset HEAD "${file}"`, { cwd: gitRoot });
    }
    
    res.json({ success: true, message: `Changes discarded for ${file}` });
  } catch (error) {
    log.error(`Discard error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Delete untracked file
router.post('/delete-untracked', async (req, res) => {
  const { project, file } = req.body;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const gitRoot = await validateGitRepository(projectPath);
    if (!gitRoot) {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    // Check if file is actually untracked
    const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: gitRoot });
    
    if (!statusOutput.trim()) {
      return res.status(400).json({ error: 'File is not untracked or does not exist' });
    }

    const status = statusOutput.substring(0, 2);
    
    if (status !== '??') {
      return res.status(400).json({ error: 'File is not untracked. Use discard for tracked files.' });
    }

    // Delete the untracked file
    await fs.unlink(path.join(projectPath, file));
    
    res.json({ success: true, message: `Untracked file ${file} deleted successfully` });
  } catch (error) {
    log.error(`Delete untracked error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
