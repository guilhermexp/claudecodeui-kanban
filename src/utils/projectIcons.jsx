// Project Icon Detection Utility
// Automatically detects and returns appropriate icons for projects

import { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  Trello,
  // Technology specific icons from lucide-react
  Globe,
  Code,
  Database,
  Cloud,
  Smartphone,
  Terminal,
  Cpu,
  Package,
  Layers,
  Zap,
  Command // Keyboard Command key
} from 'lucide-react';
import { getEnhancedProjectAnalysis } from './projectAnalyzer.js';
import { api } from './api';

// Technology detection patterns based on files/dependencies
const TECH_PATTERNS = {
  // Frontend Frameworks
  react: {
    files: ['package.json'],
    patterns: [/"react"/, /"@types\/react"/, /"next"/],
    icon: '⚛️',
    lucideIcon: Code,
    color: '#61DAFB'
  },
  vue: {
    files: ['package.json', 'vue.config.js', 'vite.config.js'],
    patterns: [/"vue"/, /"@vue\//, /"nuxt"/],
    icon: '🟢',
    lucideIcon: Layers,
    color: '#4FC08D'
  },
  angular: {
    files: ['package.json', 'angular.json'],
    patterns: [/"@angular\//, /"ng-/, /"angular"/],
    icon: '🅰️',
    lucideIcon: Layers,
    color: '#DD0031'
  },
  svelte: {
    files: ['package.json', 'svelte.config.js'],
    patterns: [/"svelte"/, /"@sveltejs\//],
    icon: '🧡',
    lucideIcon: Zap,
    color: '#FF3E00'
  },

  // Backend Frameworks
  nodejs: {
    files: ['package.json', 'server.js', 'index.js'],
    patterns: [/"express"/, /"fastify"/, /"koa"/, /"node"/],
    icon: '💚',
    lucideIcon: Terminal,
    color: '#339933'
  },
  python: {
    files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'main.py', 'app.py'],
    patterns: [/"django"/, /"flask"/, /"fastapi"/, /python/],
    icon: '🐍',
    lucideIcon: Code,
    color: '#3776AB'
  },
  rust: {
    files: ['Cargo.toml', 'Cargo.lock'],
    patterns: [/rust/, /cargo/],
    icon: '🦀',
    lucideIcon: Cpu,
    color: '#CE422B'
  },
  go: {
    files: ['go.mod', 'go.sum', 'main.go'],
    patterns: [/golang/, /go/],
    icon: '🐹',
    lucideIcon: Zap,
    color: '#00ADD8'
  },
  java: {
    files: ['pom.xml', 'build.gradle', 'gradle.properties'],
    patterns: [/spring/, /maven/, /gradle/],
    icon: '☕',
    lucideIcon: Code,
    color: '#ED8B00'
  },
  php: {
    files: ['composer.json', 'index.php'],
    patterns: [/"laravel"/, /"symfony"/, /"wordpress"/],
    icon: '🐘',
    lucideIcon: Globe,
    color: '#777BB4'
  },

  // Databases
  database: {
    files: ['docker-compose.yml', 'prisma/schema.prisma', '.env'],
    patterns: [/postgres/, /mysql/, /mongodb/, /redis/, /sqlite/, /prisma/],
    icon: '🗄️',
    lucideIcon: Database,
    color: '#336791'
  },

  // Mobile
  reactnative: {
    files: ['package.json', 'metro.config.js'],
    patterns: [/"react-native"/, /"@react-native"/],
    icon: '📱',
    lucideIcon: Smartphone,
    color: '#61DAFB'
  },
  flutter: {
    files: ['pubspec.yaml', 'pubspec.lock'],
    patterns: [/flutter/, /dart/],
    icon: '🐦',
    lucideIcon: Smartphone,
    color: '#02569B'
  },

  // DevOps/Infrastructure
  docker: {
    files: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
    patterns: [/docker/, /dockerfile/],
    icon: '🐳',
    lucideIcon: Package,
    color: '#2496ED'
  },
  kubernetes: {
    files: ['deployment.yaml', 'service.yaml', 'ingress.yaml'],
    patterns: [/kubernetes/, /k8s/, /kubectl/],
    icon: '⚙️',
    lucideIcon: Cloud,
    color: '#326CE5'
  },

  // Special Projects
  mac: {
    files: [],
    patterns: [/^mac$/i, /^macos$/i, /^darwin$/i],
    icon: '🍎',
    lucideIcon: null,
    color: '#111827',
    isMacProject: true
  },
  vibe: {
    files: [],
    patterns: [/vibe/],
    icon: '📋',
    lucideIcon: Trello,
    color: '#0079BF',
    isVibeProject: true
  },

  // Build Tools
  vite: {
    files: ['vite.config.js', 'vite.config.ts'],
    patterns: [/"vite"/],
    icon: '⚡',
    lucideIcon: Zap,
    color: '#646CFF'
  },
  webpack: {
    files: ['webpack.config.js', 'webpack.config.ts'],
    patterns: [/"webpack"/],
    icon: '📦',
    lucideIcon: Package,
    color: '#8DD6F9'
  }
};


/**
 * Detects project technology based on files and content
 */
export const detectProjectTechnology = async (project) => {
  try {
    // Check for Mac/macOS root directory first
    const name = (project.name || '').toLowerCase();
    const path = (project.fullPath || '').toLowerCase();
    if (name === 'mac' || path === '/' || path === '~' || path.endsWith('/')) {
      return TECH_PATTERNS.mac;
    }
    
    // Check for VibeKanban (special case)
    if (isVibeKanbanProject(project)) {
      return TECH_PATTERNS.vibe;
    }

    // Use enhanced analysis
    const analysis = await getEnhancedProjectAnalysis(project);
    if (analysis && analysis.confidence >= 0.5) {
      // Map analysis result to tech pattern format
      return {
        icon: analysis.icon,
        color: analysis.color,
        lucideIcon: TECH_PATTERNS[analysis.type]?.lucideIcon || Code,
        confidence: analysis.confidence
      };
    }

    // Fallback to original pattern matching for unmapped types
    const projectName = (project.name || '').toLowerCase();
    const projectPath = (project.fullPath || '').toLowerCase();
    const displayName = (project.displayName || '').toLowerCase();
    
    // Check each technology pattern
    for (const [tech, config] of Object.entries(TECH_PATTERNS)) {
      if (tech === 'vibe') continue; // Already checked
      
      // Check if any patterns match the project name/path
      const matchesName = config.patterns.some(pattern => 
        pattern.test(projectName) || 
        pattern.test(projectPath) || 
        pattern.test(displayName)
      );
      
      if (matchesName) {
        return config;
      }
    }

    // Default fallback
    return null;
  } catch (error) {
    console.error('Error detecting project technology:', error);
    return null;
  }
};

/**
 * Check if project is a VibeKanban project
 */
export const isVibeKanbanProject = (project) => {
  // Check both fullPath and path fields
  const projectPath = project.fullPath || project.path || '';
  const projectName = project.name || '';
  
  return (
    false ||
    projectName.startsWith('vk-') ||
    projectName.startsWith('VK-') ||
    projectName.toLowerCase().includes('vibe') ||
    false ||
    projectPath.includes('/vk-') ||
    projectPath.includes('\\vk-') ||
    projectPath.includes('/VK-') ||
    projectPath.includes('\\VK-')
  );
};

/**
 * Get project icon with fallback
 */
// Cache for project icons to prevent excessive API calls
const iconCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getProjectIcon = async (project, isExpanded = false) => {
  try {
    const cacheKey = `${project.name}-${isExpanded}`;
    const cached = iconCache.get(cacheKey);
    
    // Return cached result if still valid
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    // 1. Special case: Vibe Kanban always uses Trello icon
    if (isVibeKanbanProject(project)) {
      const result = {
        type: 'lucide',
        lucideIcon: Trello,
        color: '#0079BF'
      };
      iconCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    // Fallback to technology-detected icon
    const techConfig = await detectProjectTechnology(project);
    if (techConfig) {
      let result;
      if (techConfig.isMacProject) {
        result = {
          type: 'mac-apple'
        };
      } else {
        result = {
          type: 'emoji',
          icon: techConfig.icon,
          lucideIcon: techConfig.lucideIcon,
          color: techConfig.color,
          tech: techConfig
        };
      }
      iconCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    
    // Final fallback to folder icons
    const result = {
      type: 'lucide',
      lucideIcon: isExpanded ? FolderOpen : Folder,
      color: isExpanded ? '#2563eb' : '#6b7280'
    };
    iconCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error getting project icon:', error);
    const result = {
      type: 'lucide',
      lucideIcon: isExpanded ? FolderOpen : Folder,
      color: isExpanded ? '#2563eb' : '#6b7280'
    };
    iconCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }
};

/**
 * React component for project icon
 */
export const ProjectIcon = ({ project, isExpanded = false, size = 16, className = "" }) => {
  const [iconConfig, setIconConfig] = useState(null);
  
  useEffect(() => {
    getProjectIcon(project, isExpanded).then(setIconConfig);
  }, [project, isExpanded]);
  
  if (!iconConfig) {
    // Loading fallback
    const Icon = isExpanded ? FolderOpen : Folder;
    return <Icon className={className} size={size} />;
  }
  
  if (iconConfig.type === 'emoji') {
    return (
      <span 
        className={className}
        style={{ 
          fontSize: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size
        }}
      >
        {iconConfig.icon}
      </span>
    );
  }
  
  if (iconConfig.type === 'lucide') {
    const Icon = iconConfig.lucideIcon;
    return (
      <Icon 
        className={className}
        size={size} 
        style={{ color: iconConfig.color }}
      />
    );
  }
  
  // Future: handle actual image files
  if (iconConfig.type === 'image') {
    return (
      <img 
        src={iconConfig.src}
        alt={`${project.name} icon`}
        className={className}
        style={{ 
          width: size, 
          height: size,
          objectFit: 'contain'
        }}
      />
    );
  }
  
  // Mac special-case: render bundled Apple icon SVG
  if (iconConfig.type === 'mac-apple') {
    return (
      <img
        src="/icons/apple-logo.svg"
        alt="Apple"
        className={className}
        style={{ width: size * 1.2, height: size * 1.2, objectFit: 'contain' }}
      />
    );
  }
  
  // Final fallback
  const Icon = isExpanded ? FolderOpen : Folder;
  return <Icon className={className} size={size} />;
};

export default {
  detectProjectTechnology,
  isVibeKanbanProject,
  getProjectIcon,
  ProjectIcon,
  TECH_PATTERNS,
};
