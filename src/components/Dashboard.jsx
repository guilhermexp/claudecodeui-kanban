import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  Activity,
  FileText,
  Clock,
  TrendingUp,
  MessageSquare,
  Zap,
  RefreshCw,
  Calendar,
  Brain,
  Database
} from 'lucide-react';
import { authenticatedFetch } from '../utils/api';
import './Dashboard.css';

const Dashboard = memo(({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isImporting, setIsImporting] = useState(false);

  // Removed auto-refresh - only manual refresh now

  const loadUsageStats = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);

      // Get stats for last 7 days by default
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Use regular fetch without authentication for now
      const response = await fetch(`/api/usage/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch usage stats');
      }

      const data = await response.json();
      
      // Transform backend data to match frontend expectations
      const transformedStats = {
        totalCost: data.total_cost || 0,
        totalTokens: data.total_tokens || 0,
        inputTokens: data.total_input_tokens || 0,
        outputTokens: data.total_output_tokens || 0,
        todaySessions: data.total_sessions || 0,
        activeSessions: 0, // Will be populated from live metrics
        avgResponseTime: 0, // Will be populated from session data
        totalDuration: 0, // Will be populated from session data
        
        // Transform model usage data
        modelUsage: data.by_model?.reduce((acc, model) => {
          acc[model.model || 'unknown'] = {
            count: model.session_count || 0,
            cost: model.total_cost || 0,
            tokens: model.total_tokens || 0
          };
          return acc;
        }, {}) || {},
        
        // Transform recent activity from by_project data
        recentActivity: data.by_project?.map(project => ({
          project: project.project_name || project.project_path || 'Unknown',
          model: 'claude-opus-4', // Default model
          tokens: project.total_tokens || 0,
          cost: project.total_cost || 0,
          timestamp: project.last_used || new Date().toISOString()
        })) || [],
        
        // Add cost trend calculation
        costTrend: 0 // Could be calculated from by_date data
      };
      
      setStats(transformedStats);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load usage stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsageStats();
  }, [loadUsageStats]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUsageStats(false);
  };

  const handleImportData = async () => {
    try {
      setIsImporting(true);
      setError(null);
      
      // Call import endpoint to import data from Claude projects
      // Use regular fetch without authentication for now
      const response = await fetch('/api/usage/import', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to import usage data');
      }
      
      const result = await response.json();
      
      // Reload stats after import
      await loadUsageStats(false);
      
      // Show success message (could add a toast notification here)
      console.log(`Imported ${result.imported} records from Claude projects`);
    } catch (err) {
      console.error('Failed to import usage data:', err);
      setError('Failed to import usage data');
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatModelName = (model) => {
    // Shorten long model names for display
    if (model.includes('claude-opus-4-1')) return 'Opus 4.1';
    if (model.includes('claude-opus-4')) return 'Opus 4';
    if (model.includes('claude-sonnet-4')) return 'Sonnet 4';
    if (model.includes('claude-haiku')) return 'Haiku';
    return model;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-3">{error}</p>
          <button
            onClick={() => loadUsageStats()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-accent rounded transition-colors flex-shrink-0"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-5 h-5 text-primary flex-shrink-0" />
            <h2 className="text-sm font-semibold truncate">Real-Time Analytics</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Updated {getTimeAgo(lastRefresh)}
          </span>
          <button
            onClick={handleImportData}
            disabled={isImporting}
            className="px-2 py-1 text-xs bg-accent hover:bg-accent/80 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
            title="Import data from Claude projects"
          >
            <Database className={`w-3 h-3 ${isImporting ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import'}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 hover:bg-accent rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Cost Card */}
          <div className="bg-card border border-border rounded-lg p-4 min-h-[120px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-5 h-5 text-success-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">7 days</span>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-1">
              <p className="dashboard-stat-number font-bold">
                {formatCurrency(stats?.totalCost || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Cost</p>
              {stats?.costTrend && (
                <div className="flex items-center gap-1">
                  <TrendingUp className={`w-3 h-3 ${stats.costTrend > 0 ? 'text-destructive' : 'text-success-foreground'}`} />
                  <span className={`text-xs ${stats.costTrend > 0 ? 'text-destructive' : 'text-success-foreground'}`}>
                    {Math.abs(stats.costTrend).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Total Tokens Card */}
          <div className="bg-card border border-border rounded-lg p-4 min-h-[120px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-5 h-5 text-warning flex-shrink-0" />
              <span className="text-xs text-muted-foreground">7 days</span>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-1">
              <p className="dashboard-stat-number font-bold">
                {formatNumber(stats?.totalTokens || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Tokens</p>
              <div className="flex gap-4 text-xs">
                <span className="text-primary">↓ {formatNumber(stats?.inputTokens || 0)}</span>
                <span className="text-success-foreground">↑ {formatNumber(stats?.outputTokens || 0)}</span>
              </div>
            </div>
          </div>

          {/* Active Sessions Card */}
          <div className="bg-card border border-border rounded-lg p-4 min-h-[120px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-1">
              <p className="dashboard-stat-number font-bold">
                {stats?.todaySessions || 0}
              </p>
              <p className="text-xs text-muted-foreground">Sessions</p>
              <p className="text-xs text-success-foreground">
                {stats?.activeSessions || 0} active now
              </p>
            </div>
          </div>

          {/* Average Response Time */}
          <div className="bg-card border border-border rounded-lg p-4 min-h-[120px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-accent flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Avg</span>
            </div>
            <div className="flex-1 flex flex-col justify-center space-y-1">
              <p className="dashboard-stat-number font-bold">
                {formatDuration(stats?.avgResponseTime || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Response Time</p>
              <p className="text-xs text-muted-foreground">
                Total: {formatDuration(stats?.totalDuration || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Model Usage */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Model Usage</h3>
            </div>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          
          <div className="space-y-3">
            {stats?.modelUsage && Object.entries(stats.modelUsage)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 5)
              .map(([model, data]) => (
                <div key={model} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-medium truncate flex-1" title={model}>{formatModelName(model)}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {data.count} calls • {formatCurrency(data.cost)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ 
                          width: `${(data.tokens / stats.totalTokens) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Recent Activity</h3>
            </div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
          
          <div className="space-y-2">
            {stats?.recentActivity && stats.recentActivity.slice(0, 5).map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{activity.project || 'Unknown Project'}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.model} • {formatNumber(activity.tokens)} tokens
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{formatCurrency(activity.cost)}</p>
                  <p className="text-xs text-muted-foreground">{getTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
            ))}
            
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No recent activity
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;