import React, { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import {
  ArrowLeft,
  Filter,
  Loader2,
  DollarSign,
  Activity,
  FileText,
  Clock,
  Database
} from 'lucide-react';
import { authenticatedFetch } from '../utils/api';
import './Dashboard.css';
import {
  OverviewTab,
  TimeUsageTab,
  ModelsTab,
  ProjectsTab,
  SessionsTab,
  TimelineTab
} from './Dashboard/TabContents';

const Dashboard = memo(({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [timeStats, setTimeStats] = useState(null);
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [isImporting, setIsImporting] = useState(false);
  const [tabsLoaded, setTabsLoaded] = useState({ overview: true });

  // Check for cached data on mount but don't block import
  useEffect(() => {
    // Check for cached stats in localStorage
    const cachedStats = localStorage.getItem('cachedUsageStats');
    if (cachedStats) {
      try {
        const parsed = JSON.parse(cachedStats);
        if (parsed.timestamp) {
          const cacheAge = (new Date() - new Date(parsed.timestamp)) / (1000 * 60 * 60);
          if (cacheAge < 1) { // Use cache if less than 1 hour old
            setStats(parsed.data);
            // Don't set loading to false here, let loadUsageStats handle it
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached stats');
      }
    }
  }, []);

  const loadUsageStats = useCallback(async (forceReload = false, loadSpecificTab = null) => {
    try {
      setLoading(true);
      setError(null);

      // Check when was the last import
      const lastImport = localStorage.getItem('lastUsageImport');
      const shouldImport = forceReload || !lastImport || 
        ((new Date() - new Date(lastImport)) / (1000 * 60) > 30); // Import if more than 30 minutes
      
      if (shouldImport && !isImporting) {
        try {
          setIsImporting(true);
          const importResponse = await authenticatedFetch('/api/usage/import', {
            method: 'POST'
          });
          if (importResponse.ok) {
            const importResult = await importResponse.json();
            // Import completed successfully
            localStorage.setItem('lastUsageImport', new Date().toISOString());
          }
        } catch (importErr) {
          console.warn('Could not import latest data:', importErr);
        } finally {
          setIsImporting(false);
        }
      }

      let url = '/api/usage/stats';
      const params = new URLSearchParams();
      
      if (selectedDateRange !== 'all') {
        const endDate = new Date();
        const startDate = new Date();
        const days = selectedDateRange === '7d' ? 7 : 30;
        startDate.setDate(startDate.getDate() - days);
        
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await authenticatedFetch(url);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', errorData);
        throw new Error('Failed to fetch usage stats');
      }

      const data = await response.json();
      setStats(data);
      
      // Cache the stats
      localStorage.setItem('cachedUsageStats', JSON.stringify({
        timestamp: new Date().toISOString(),
        data: data
      }));

      // Load specific tab data if requested
      const tabToLoad = loadSpecificTab || activeTab;

      // Load session stats
      if (tabToLoad === 'sessions') {
        const sessionResponse = await authenticatedFetch('/api/usage/sessions' + (queryString ? `?${queryString}` : ''));
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setSessionStats(sessionData);
          setTabsLoaded(prev => ({ ...prev, sessions: true }));
        }
      }

      // Load time usage stats
      if (tabToLoad === 'usage-time') {
        const timeResponse = await authenticatedFetch('/api/usage/time' + (queryString ? `?${queryString}` : ''));
        if (timeResponse.ok) {
          const timeData = await timeResponse.json();
          // Time stats loaded successfully
          setTimeStats(timeData);
          setTabsLoaded(prev => ({ ...prev, 'usage-time': true }));
        }
      }
    } catch (err) {
      console.error('Failed to load usage stats:', err);
      setError('Failed to load usage statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isImporting, selectedDateRange]);

  const generateSampleData = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/usage/generate-sample', {
        method: 'POST'
      });
      if (response.ok) {
        await loadUsageStats(true);
      }
    } catch (err) {
      console.error('Failed to generate sample data:', err);
    }
  }, [loadUsageStats]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount || 0);
  }, []);

  const formatNumber = useCallback((num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  }, []);

  const formatTokens = useCallback((num) => {
    if (!num) return '0';
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return formatNumber(num);
  }, [formatNumber]);

  const formatDuration = useCallback((minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, []);

  const getModelDisplayName = useCallback((model) => {
    const modelMap = {
      'claude-4-opus': 'Opus 4',
      'claude-4-sonnet': 'Sonnet 4',
      'claude-3.5-sonnet': 'Sonnet 3.5',
      'claude-3-opus': 'Opus 3',
      'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
      'claude-3-opus-20240229': 'Opus 3'
    };
    return modelMap[model] || model;
  }, []);

  const getModelColor = useCallback((model) => {
    if (model?.includes('opus')) return 'model-opus';
    if (model?.includes('sonnet')) return 'model-sonnet';
    return 'model-default';
  }, []);

  // Load usage stats when component mounts and when date range changes
  useEffect(() => {
    loadUsageStats();
  }, [selectedDateRange]);

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === 'sessions' && !sessionStats && !tabsLoaded.sessions) {
      loadUsageStats(false, 'sessions');
    } else if (activeTab === 'usage-time' && !timeStats && !tabsLoaded['usage-time']) {
      loadUsageStats(false, 'usage-time');
    }
  }, [activeTab]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button className="dashboard-back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="dashboard-title bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">Usage Dashboard</h1>
            <p className="dashboard-subtitle text-muted-foreground/70 italic">Track your Claude Code usage and costs</p>
          </div>
        </div>
        
        {/* Date Range Filter */}
        <div className="dashboard-date-filter">
          <button 
            onClick={() => {
              localStorage.removeItem('lastUsageImport');
              localStorage.removeItem('cachedUsageStats');
              window.location.reload();
            }}
            style={{ marginRight: '1rem', padding: '0.5rem', fontSize: '0.75rem' }}
          >
            🔄 Reimport Data
          </button>
          <Filter size={16} />
          <div className="date-filter-buttons">
            {['all', '30d', '7d'].map((range) => (
              <button
                key={range}
                className={`date-filter-btn ${selectedDateRange === range ? 'active' : ''}`}
                onClick={() => setSelectedDateRange(range)}
              >
                {range === 'all' ? 'All Time' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {loading && !stats ? (
          <div className="dashboard-loading">
            <Loader2 className="dashboard-spinner" size={32} />
            <p>{isImporting ? 'Importing latest data...' : 'Loading usage statistics...'}</p>
          </div>
        ) : error ? (
          <div className="dashboard-error">
            <p className="error-message">{error}</p>
            <button className="retry-btn" onClick={loadUsageStats}>
              Try Again
            </button>
          </div>
        ) : stats ? (
          <div className="dashboard-stats">
            {/* Summary Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-content">
                  <div>
                    <p className="stat-label">Total Cost</p>
                    <p className="stat-value">{formatCurrency(stats.total_cost)}</p>
                  </div>
                  <DollarSign className="stat-icon" />
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-content">
                  <div>
                    <p className="stat-label">Total Tokens</p>
                    <p className="stat-value">{formatTokens(stats.total_tokens)}</p>
                  </div>
                  <Activity className="stat-icon" />
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-content">
                  <div>
                    <p className="stat-label">Total Sessions</p>
                    <p className="stat-value">{formatNumber(stats.total_sessions)}</p>
                  </div>
                  <FileText className="stat-icon" />
                </div>
              </div>

              {timeStats && (
                <div className="stat-card">
                  <div className="stat-content">
                    <div>
                      <p className="stat-label">Total Time Used</p>
                      <p className="stat-value">{formatDuration(timeStats.total_minutes)}</p>
                    </div>
                    <Clock className="stat-icon" />
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="dashboard-tabs">
              <div className="tabs-list">
                <button
                  className={`tab-trigger ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
                <button
                  className={`tab-trigger ${activeTab === 'usage-time' ? 'active' : ''}`}
                  onClick={() => setActiveTab('usage-time')}
                >
                  Time Usage
                </button>
                <button
                  className={`tab-trigger ${activeTab === 'models' ? 'active' : ''}`}
                  onClick={() => setActiveTab('models')}
                >
                  By Model
                </button>
                <button
                  className={`tab-trigger ${activeTab === 'projects' ? 'active' : ''}`}
                  onClick={() => setActiveTab('projects')}
                >
                  By Project
                </button>
                <button
                  className={`tab-trigger ${activeTab === 'sessions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sessions')}
                >
                  By Session
                </button>
                <button
                  className={`tab-trigger ${activeTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setActiveTab('timeline')}
                >
                  Timeline
                </button>
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <Suspense fallback={<div className="dashboard-loading"><Loader2 className="dashboard-spinner" size={24} /></div>}>
                  <OverviewTab 
                    stats={stats} 
                    formatCurrency={formatCurrency} 
                    formatTokens={formatTokens}
                    getModelDisplayName={getModelDisplayName}
                    getModelColor={getModelColor}
                  />
                </Suspense>
              )}

              {/* Time Usage Tab */}
              {activeTab === 'usage-time' && (
                <Suspense fallback={<div className="dashboard-loading"><Loader2 className="dashboard-spinner" size={24} /></div>}>
                  {timeStats ? (
                    <TimeUsageTab 
                      timeStats={timeStats} 
                      formatDuration={formatDuration}
                    />
                  ) : (
                    <div className="dashboard-loading">
                      <Loader2 className="dashboard-spinner" size={24} />
                      <p>Loading time usage data...</p>
                    </div>
                  )}
                </Suspense>
              )}

              {/* Models Tab */}
              {activeTab === 'models' && stats.by_model && (
                <Suspense fallback={<div className="dashboard-loading"><Loader2 className="dashboard-spinner" size={24} /></div>}>
                  <ModelsTab 
                    stats={stats} 
                    formatCurrency={formatCurrency} 
                    formatTokens={formatTokens}
                    getModelDisplayName={getModelDisplayName}
                    getModelColor={getModelColor}
                  />
                </Suspense>
              )}

              {/* Projects Tab */}
              {activeTab === 'projects' && stats.by_project && (
                <Suspense fallback={<div className="dashboard-loading"><Loader2 className="dashboard-spinner" size={24} /></div>}>
                  <ProjectsTab 
                    stats={stats} 
                    formatCurrency={formatCurrency} 
                    formatTokens={formatTokens}
                  />
                </Suspense>
              )}

              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <Suspense fallback={<div className="dashboard-loading"><Loader2 className="dashboard-spinner" size={24} /></div>}>
                  {sessionStats ? (
                    <SessionsTab 
                      sessionStats={sessionStats} 
                      formatCurrency={formatCurrency}
                    />
                  ) : (
                    <div className="dashboard-loading">
                      <Loader2 className="dashboard-spinner" size={24} />
                      <p>Loading session data...</p>
                    </div>
                  )}
                </Suspense>
              )}

              {/* Timeline Tab */}
              {activeTab === 'timeline' && stats.by_date && (
                <Suspense fallback={<div className="dashboard-loading"><Loader2 className="dashboard-spinner" size={24} /></div>}>
                  <TimelineTab 
                    stats={stats} 
                    formatCurrency={formatCurrency} 
                    formatTokens={formatTokens}
                  />
                </Suspense>
              )}
            </div>
          </div>
        ) : (
          <div className="dashboard-empty">
            <div className="empty-state">
              <Database className="empty-icon" size={48} />
              <h3>No Usage Data</h3>
              <p>No usage data available yet. Start using Claude Code to see your usage statistics here.</p>
              <button className="generate-btn" onClick={generateSampleData}>
                Generate Sample Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;