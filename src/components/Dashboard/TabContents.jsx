import React, { memo } from 'react';
import {
  Zap,
  Brain,
  Briefcase,
  Clock,
  Calendar,
  FolderOpen,
  TrendingUp
} from 'lucide-react';

// Memoized tab content components for better performance
export const OverviewTab = memo(({ stats, formatCurrency, formatTokens, getModelDisplayName, getModelColor }) => (
  <div className="tab-content">
    <div className="overview-tab">
      {/* Token Breakdown */}
      <div className="card">
        <h3 className="card-title">
          <Zap size={18} />
          Token Usage
        </h3>
        <div className="token-grid">
          <div className="token-stat">
            <span className="token-label">Input</span>
            <span className="token-value">{formatTokens(stats.total_input_tokens)}</span>
          </div>
          <div className="token-stat">
            <span className="token-label">Output</span>
            <span className="token-value">{formatTokens(stats.total_output_tokens)}</span>
          </div>
          <div className="token-stat">
            <span className="token-label">Cache Write</span>
            <span className="token-value">{formatTokens(stats.total_cache_creation_tokens)}</span>
          </div>
          <div className="token-stat">
            <span className="token-label">Cache Read</span>
            <span className="token-value">{formatTokens(stats.total_cache_read_tokens)}</span>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        {/* Top Models */}
        {stats.by_model && stats.by_model.length > 0 && (
          <div className="card">
            <h3 className="card-title">
              <Brain size={18} />
              Top Models
            </h3>
            <div className="model-list">
              {stats.by_model.slice(0, 5).map((model) => (
                <div key={model.model} className="model-item">
                  <div className="model-info">
                    <span className={`model-badge ${getModelColor(model.model)}`}>
                      {getModelDisplayName(model.model)}
                    </span>
                    <span className="model-sessions">{model.session_count} sessions</span>
                  </div>
                  <span className="model-cost">{formatCurrency(model.total_cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Projects */}
        {stats.by_project && stats.by_project.length > 0 && (
          <div className="card">
            <h3 className="card-title">
              <Briefcase size={18} />
              Top Projects
            </h3>
            <div className="project-list">
              {stats.by_project.slice(0, 5).map((project) => (
                <div key={project.project_path} className="project-item">
                  <div className="project-info">
                    <span className="project-path" title={project.project_path}>
                      {project.project_name || project.project_path.split('/').pop()}
                    </span>
                    <span className="project-sessions">{project.session_count} sessions</span>
                  </div>
                  <span className="project-cost">{formatCurrency(project.total_cost)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
));

export const TimeUsageTab = memo(({ timeStats, formatDuration }) => (
  <div className="tab-content">
    <div className="overview-tab">
      {/* Time Summary */}
      <div className="card">
        <h3 className="card-title">
          <Clock size={18} />
          Usage Time Summary
        </h3>
        <div className="token-grid">
          <div className="token-stat">
            <span className="token-label">Total Hours</span>
            <span className="token-value">{timeStats.total_hours?.toFixed(1) || 0}h</span>
          </div>
          <div className="token-stat">
            <span className="token-label">Days Used</span>
            <span className="token-value">{timeStats.days_used || 0}</span>
          </div>
          <div className="token-stat">
            <span className="token-label">Avg Session</span>
            <span className="token-value">{formatDuration(timeStats.avg_session_minutes)}</span>
          </div>
          <div className="token-stat">
            <span className="token-label">Longest Session</span>
            <span className="token-value">{formatDuration(timeStats.max_session_minutes)}</span>
          </div>
        </div>
      </div>

      {/* Daily Time Usage */}
      {timeStats.by_date && timeStats.by_date.length > 0 && (
        <div className="card">
          <h3 className="card-title">
            <Calendar size={18} />
            Daily Usage Time
          </h3>
          <div className="timeline-chart">
            <div className="chart-container">
              {timeStats.by_date.slice(0, 30).reverse().map((day) => {
                const maxHours = Math.max(...timeStats.by_date.map(d => d.hours_used || 0));
                const heightPercent = maxHours > 0 ? (day.hours_used / maxHours) * 100 : 0;
                
                return (
                  <div key={day.date} className="chart-bar-container">
                    <div className="chart-bar-wrapper">
                      <div 
                        className="chart-bar" 
                        style={{ height: `${heightPercent}%` }}
                      >
                        <div className="chart-tooltip">
                          <p className="tooltip-date">{new Date(day.date).toLocaleDateString()}</p>
                          <p className="tooltip-cost">Time: {day.hours_used?.toFixed(1) || 0} hours</p>
                          <p className="tooltip-tokens">Sessions: {day.sessions}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Time by Project */}
      {timeStats.by_project && timeStats.by_project.length > 0 && (
        <div className="card">
          <h3 className="card-title">
            <FolderOpen size={18} />
            Time by Project
          </h3>
          <div className="projects-list">
            {timeStats.by_project.map((project) => (
              <div key={project.project_path} className="project-detail">
                <div className="project-detail-left">
                  <span className="project-name">{project.project_path}</span>
                  <div className="project-meta">
                    <span>{project.session_count} sessions</span>
                    <span>Last used: {new Date(project.last_used).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="project-detail-right">
                  <p className="project-total">{formatDuration(project.total_minutes)}</p>
                  <p className="project-avg">Total time used</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
));

export const ModelsTab = memo(({ stats, formatCurrency, formatTokens, getModelDisplayName, getModelColor }) => (
  <div className="tab-content">
    <div className="models-list">
      {stats.by_model.map((model) => (
        <div key={model.model} className="model-detail">
          <div className="model-header">
            <div className="model-header-left">
              <span className={`model-badge ${getModelColor(model.model)}`}>
                {getModelDisplayName(model.model)}
              </span>
              <span className="model-sessions">{model.session_count} sessions</span>
            </div>
            <span className="model-total-cost">{formatCurrency(model.total_cost)}</span>
          </div>
          <div className="model-tokens">
            <div className="token-item">
              <span className="token-type">Input:</span>
              <span className="token-count">{formatTokens(model.input_tokens)}</span>
            </div>
            <div className="token-item">
              <span className="token-type">Output:</span>
              <span className="token-count">{formatTokens(model.output_tokens)}</span>
            </div>
            <div className="token-item">
              <span className="token-type">Cache Write:</span>
              <span className="token-count">{formatTokens(model.cache_creation_tokens)}</span>
            </div>
            <div className="token-item">
              <span className="token-type">Cache Read:</span>
              <span className="token-count">{formatTokens(model.cache_read_tokens)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
));

export const ProjectsTab = memo(({ stats, formatCurrency, formatTokens }) => (
  <div className="tab-content">
    <div className="projects-list">
      {stats.by_project.map((project) => {
        const avgCost = project.session_count > 0 
          ? project.total_cost / project.session_count 
          : 0;
        
        return (
          <div key={project.project_path} className="project-detail">
            <div className="project-detail-left">
              <span className="project-name" title={project.project_path}>
                {project.project_path}
              </span>
              <div className="project-meta">
                <span>{project.session_count} sessions</span>
                <span>{formatTokens(project.total_tokens)} tokens</span>
                <span>Last used: {new Date(project.last_used).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="project-detail-right">
              <p className="project-total">{formatCurrency(project.total_cost)}</p>
              <p className="project-avg">{formatCurrency(avgCost)} avg per session</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
));

export const SessionsTab = memo(({ sessionStats, formatCurrency }) => (
  <div className="tab-content">
    <div className="sessions-list">
      {sessionStats.map((session, index) => (
        <div key={`${session.project_path}-${session.session_id}-${index}`} className="session-item">
          <div className="session-info">
            <div className="session-project">
              <FolderOpen size={14} />
              <span className="session-path" title={session.project_path}>
                {session.project_path}
              </span>
            </div>
            <span className="session-name">{session.session_id}</span>
          </div>
          <div className="session-cost">
            <p className="session-total">{formatCurrency(session.total_cost)}</p>
            <p className="session-date">{new Date(session.last_used).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
));

export const TimelineTab = memo(({ stats, formatCurrency, formatTokens }) => (
  <div className="tab-content">
    <div className="timeline-chart">
      <h3 className="card-title">
        <TrendingUp size={18} />
        Daily Usage Trend
      </h3>
      <div className="chart-container">
        {stats.by_date.slice(0, 30).reverse().map((day) => {
          const maxCost = Math.max(...stats.by_date.map(d => d.total_cost || 0));
          const heightPercent = maxCost > 0 ? (day.total_cost / maxCost) * 100 : 0;
          
          return (
            <div key={day.date} className="chart-bar-container">
              <div className="chart-bar-wrapper">
                <div 
                  className="chart-bar" 
                  style={{ height: `${heightPercent}%` }}
                >
                  <div className="chart-tooltip">
                    <p className="tooltip-date">{new Date(day.date).toLocaleDateString()}</p>
                    <p className="tooltip-cost">Cost: {formatCurrency(day.total_cost)}</p>
                    <p className="tooltip-tokens">Tokens: {formatTokens(day.total_tokens)}</p>
                    <p className="tooltip-models">Models: {day.models_used.join(', ')}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
));

// Set display names for debugging
OverviewTab.displayName = 'OverviewTab';
TimeUsageTab.displayName = 'TimeUsageTab';
ModelsTab.displayName = 'ModelsTab';
ProjectsTab.displayName = 'ProjectsTab';
SessionsTab.displayName = 'SessionsTab';
TimelineTab.displayName = 'TimelineTab';