// Enhanced Project Analysis Utility
// Provides server-side project analysis capabilities

/**
 * Analyzes project files to better determine technology stack
 * This would ideally be called from the backend to read actual files
 */
export const analyzeProjectFiles = async (projectPath) => {
  try {
    // This would typically make an API call to the backend
    // to read and analyze files in the project directory
    const response = await fetch(`/api/projects/analyze?path=${encodeURIComponent(projectPath)}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      // If response is not JSON (e.g., HTML 404 page), return null
      return null;
    }
    
    return null;
  } catch (error) {
    // Only log if it's not a network error (endpoint doesn't exist yet)
    if (!error.message.includes('Failed to fetch')) {
      console.warn('Failed to analyze project files:', error);
    }
    return null;
  }
};

/**
 * Enhanced project detection based on name patterns and common indicators
 */
export const detectProjectTypeFromName = (project) => {
  const name = (project.name || '').toLowerCase();
  const displayName = (project.displayName || '').toLowerCase();
  const fullPath = (project.fullPath || '').toLowerCase();
  
  // Combine all text for analysis
  const projectText = `${name} ${displayName} ${fullPath}`;
  
  // Frontend framework detection
  if (/\b(react|next|gatsby)\b/.test(projectText)) {
    return { 
      type: 'react',
      confidence: 0.8,
      icon: '⚛️',
      color: '#61DAFB'
    };
  }
  
  if (/\b(vue|nuxt|vite)\b/.test(projectText)) {
    return { 
      type: 'vue',
      confidence: 0.8,
      icon: '🟢',
      color: '#4FC08D'
    };
  }
  
  if (/\b(angular|ng-)\b/.test(projectText)) {
    return { 
      type: 'angular',
      confidence: 0.8,
      icon: '🅰️',
      color: '#DD0031'
    };
  }
  
  if (/\b(svelte|sveltekit)\b/.test(projectText)) {
    return { 
      type: 'svelte',
      confidence: 0.8,
      icon: '🧡',
      color: '#FF3E00'
    };
  }
  
  // Backend/Language detection
  if (/\b(node|express|fastify|koa)\b/.test(projectText)) {
    return { 
      type: 'nodejs',
      confidence: 0.7,
      icon: '💚',
      color: '#339933'
    };
  }
  
  if (/\b(python|django|flask|fastapi)\b/.test(projectText)) {
    return { 
      type: 'python',
      confidence: 0.8,
      icon: '🐍',
      color: '#3776AB'
    };
  }
  
  if (/\b(rust|cargo)\b/.test(projectText)) {
    return { 
      type: 'rust',
      confidence: 0.9,
      icon: '🦀',
      color: '#CE422B'
    };
  }
  
  if (/\b(go|golang)\b/.test(projectText)) {
    return { 
      type: 'go',
      confidence: 0.8,
      icon: '🐹',
      color: '#00ADD8'
    };
  }
  
  if (/\b(java|spring|maven|gradle)\b/.test(projectText)) {
    return { 
      type: 'java',
      confidence: 0.7,
      icon: '☕',
      color: '#ED8B00'
    };
  }
  
  if (/\b(php|laravel|symfony|wordpress)\b/.test(projectText)) {
    return { 
      type: 'php',
      confidence: 0.8,
      icon: '🐘',
      color: '#777BB4'
    };
  }
  
  // Mobile
  if (/\b(react-native|rn-|mobile)\b/.test(projectText)) {
    return { 
      type: 'reactnative',
      confidence: 0.8,
      icon: '📱',
      color: '#61DAFB'
    };
  }
  
  if (/\b(flutter|dart)\b/.test(projectText)) {
    return { 
      type: 'flutter',
      confidence: 0.8,
      icon: '🐦',
      color: '#02569B'
    };
  }
  
  // DevOps/Infrastructure
  if (/\b(docker|containerized|k8s|kubernetes)\b/.test(projectText)) {
    return { 
      type: 'docker',
      confidence: 0.7,
      icon: '🐳',
      color: '#2496ED'
    };
  }
  
  // Database
  if (/\b(database|db|postgres|mysql|mongo|redis)\b/.test(projectText)) {
    return { 
      type: 'database',
      confidence: 0.6,
      icon: '🗄️',
      color: '#336791'
    };
  }
  
  // Web/API
  if (/\b(api|backend|server|microservice)\b/.test(projectText)) {
    return { 
      type: 'api',
      confidence: 0.5,
      icon: '🌐',
      color: '#666666'
    };
  }
  
  if (/\b(frontend|ui|interface|website|web)\b/.test(projectText)) {
    return { 
      type: 'web',
      confidence: 0.5,
      icon: '🎨',
      color: '#6366f1'
    };
  }
  
  // Special cases
  // Mac/macOS root or home directory
  if (/\b(mac|macos|darwin)\b/i.test(projectText) || 
      fullPath === '/' || 
      fullPath === '~' ||
      fullPath === '/users/' ||
      name === 'mac' ||
      displayName === 'mac') {
    return { 
      type: 'mac',
      confidence: 0.95,
      icon: '🍎',
      color: '#000000'
    };
  }
  
  if (/\b(vibe-kanban|vibe|kanban|task|todo)\b/.test(projectText)) {
    return { 
      type: 'vibe',
      confidence: 0.9,
      icon: '📋',
      color: '#0079BF'
    };
  }
  
  if (/\b(claude|ai|assistant|bot)\b/.test(projectText)) {
    return { 
      type: 'ai',
      confidence: 0.8,
      icon: '🤖',
      color: '#8b5cf6'
    };
  }
  
  // Tools and utilities
  if (/\b(tool|util|script|cli|command)\b/.test(projectText)) {
    return { 
      type: 'tool',
      confidence: 0.6,
      icon: '🔧',
      color: '#64748b'
    };
  }
  
  if (/\b(test|testing|spec|e2e|unit)\b/.test(projectText)) {
    return { 
      type: 'test',
      confidence: 0.7,
      icon: '🧪',
      color: '#10b981'
    };
  }
  
  if (/\b(doc|docs|documentation|wiki|guide)\b/.test(projectText)) {
    return { 
      type: 'docs',
      confidence: 0.7,
      icon: '📚',
      color: '#3b82f6'
    };
  }
  
  // Game development
  if (/\b(game|gaming|unity|unreal|godot)\b/.test(projectText)) {
    return { 
      type: 'game',
      confidence: 0.7,
      icon: '🎮',
      color: '#9333ea'
    };
  }
  
  return null;
};

/**
 * Gets project analysis with caching
 */
const projectAnalysisCache = new Map();

export const getEnhancedProjectAnalysis = async (project) => {
  const cacheKey = `${project.name}-${project.fullPath}`;
  
  if (projectAnalysisCache.has(cacheKey)) {
    return projectAnalysisCache.get(cacheKey);
  }
  
  try {
    // Try server-side analysis first
    let analysis = await analyzeProjectFiles(project.fullPath);
    
    // Fallback to name-based detection
    if (!analysis || analysis.confidence < 0.5) {
      const nameBasedAnalysis = detectProjectTypeFromName(project);
      if (nameBasedAnalysis && (!analysis || nameBasedAnalysis.confidence > analysis.confidence)) {
        analysis = nameBasedAnalysis;
      }
    }
    
    // Cache the result
    if (analysis) {
      projectAnalysisCache.set(cacheKey, analysis);
    }
    
    return analysis;
  } catch (error) {
    console.warn('Failed to get enhanced project analysis:', error);
    return detectProjectTypeFromName(project);
  }
};

export default {
  analyzeProjectFiles,
  detectProjectTypeFromName,
  getEnhancedProjectAnalysis
};