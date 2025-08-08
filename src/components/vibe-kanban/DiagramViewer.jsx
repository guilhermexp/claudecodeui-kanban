import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileText, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Loader } from './ui/loader';

export function DiagramViewer({ projectId }) {
  const [diagramContent, setDiagramContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const fetchDiagram = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/projects/${projectId}/diagram`);
        
        if (response.status === 404) {
          setHasContent(false);
          setDiagramContent('');
          return;
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch diagram');
        }
        
        const data = await response.json();
        setDiagramContent(data.content || '');
        setHasContent(!!data.content);
      } catch (err) {
        console.error('Error fetching diagram:', err);
        setError(err.message);
        setHasContent(false);
      } finally {
        setLoading(false);
      }
    };

    fetchDiagram();
    
    // Refresh diagram every 10 seconds
    const interval = setInterval(fetchDiagram, 10000);
    
    return () => clearInterval(interval);
  }, [projectId]);

  // Don't render if no content
  if (!hasContent && !loading) {
    return null;
  }

  return (
    <div className="px-4 sm:px-8 mb-8 mt-4">
      <Card className="overflow-hidden border-2 border-primary/10 shadow-lg">
        <CardHeader 
          className="cursor-pointer select-none bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-all duration-200"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Architecture Diagram</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">diagrama.md</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </CardHeader>
        
        {isExpanded && (
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader message="Loading diagram..." size={24} />
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 text-destructive py-4">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            ) : (
              <div className="p-6 bg-background/50 rounded-lg">
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none 
                    prose-headings:text-foreground prose-p:text-muted-foreground
                    prose-strong:text-foreground prose-code:text-primary
                    prose-pre:bg-muted prose-pre:border prose-pre:border-border
                    markdown-content overflow-x-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: renderMarkdown(diagramContent) 
                  }}
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Enhanced markdown renderer for diagrams
function renderMarkdown(content) {
  if (!content) return '';
  
  let html = content;
  
  // Handle mermaid diagrams
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (match, diagram) => {
    return `
      <div class="mermaid-diagram border-2 border-primary/20 rounded-lg p-4 my-4 bg-card">
        <pre class="mermaid">${escapeHtml(diagram.trim())}</pre>
      </div>
    `;
  });
  
  // Convert code blocks with syntax highlighting hint
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const langClass = lang ? `language-${lang}` : 'language-plaintext';
    const langLabel = lang ? `<span class="text-xs text-muted-foreground absolute top-2 right-2">${lang}</span>` : '';
    return `
      <div class="relative my-4">
        ${langLabel}
        <pre class="bg-muted p-4 rounded-lg overflow-x-auto border border-border"><code class="${langClass}">${escapeHtml(code.trim())}</code></pre>
      </div>
    `;
  });
  
  // Convert tables
  html = html.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)*)/g, (match, header, rows) => {
    const headers = header.split('|').filter(h => h.trim());
    const tableRows = rows.trim().split('\n').map(row => 
      row.split('|').filter(cell => cell !== undefined && cell !== '')
    );
    
    let table = '<table class="min-w-full divide-y divide-border my-4 border border-border rounded-lg overflow-hidden">';
    table += '<thead class="bg-muted"><tr>';
    headers.forEach(h => {
      table += `<th class="px-4 py-2 text-left text-sm font-semibold">${h.trim()}</th>`;
    });
    table += '</tr></thead><tbody class="divide-y divide-border">';
    
    tableRows.forEach(row => {
      table += '<tr class="hover:bg-muted/50">';
      row.forEach(cell => {
        table += `<td class="px-4 py-2 text-sm">${cell.trim()}</td>`;
      });
      table += '</tr>';
    });
    
    table += '</tbody></table>';
    return table;
  });
  
  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  
  // Convert headers with better styling
  html = html.replace(/^#### (.*?)$/gm, '<h4 class="text-base font-medium mt-3 mb-2 text-foreground">$1</h4>');
  html = html.replace(/^### (.*?)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-foreground border-b border-border pb-2">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-foreground">$1</h1>');
  
  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Convert bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Convert blockquotes
  html = html.replace(/^> (.*?)$/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-1 my-2 text-muted-foreground italic">$1</blockquote>');
  
  // Convert unordered lists
  html = html.replace(/^[\*\-\+] (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
    return `<ul class="list-disc list-inside ml-4 my-2 space-y-1">${match}</ul>`;
  });
  
  // Convert ordered lists
  html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => {
    if (!match.includes('<ul')) {
      return `<ol class="list-decimal list-inside ml-4 my-2 space-y-1">${match}</ol>`;
    }
    return match;
  });
  
  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-6 border-border">');
  
  // Convert line breaks and paragraphs
  html = html.split('\n\n').map(paragraph => {
    if (paragraph.trim() && !paragraph.includes('<')) {
      return `<p class="mb-3 leading-relaxed">${paragraph}</p>`;
    }
    return paragraph;
  }).join('\n');
  
  return html;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}