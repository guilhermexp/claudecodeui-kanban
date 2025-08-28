import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ArrowLeft, MessageSquare, Clock, Trash2, Plus, Search, Calendar, Activity } from 'lucide-react';
import { api } from '../utils/api';
import { formatTimeAgo } from '../utils/time';
import { cn } from '../lib/utils';

function SessionsView({ onSessionSelect, onNewSession, onSessionDelete }) {
  const { projectName } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('recent'); // recent, oldest
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectInfo, setProjectInfo] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, [projectName]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      // First get project info
      const projectsResponse = await api.projects();
      const projectsData = await projectsResponse.json();
      const project = projectsData.projects?.find(p => p.name === projectName);
      setProjectInfo(project);

      // Then get all sessions
      const response = await api.sessions(projectName, limit, offset);
      const data = await response.json();
      setSessions(data.sessions || []);
      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreSessions = async () => {
    try {
      const newOffset = offset + limit;
      const response = await api.sessions(projectName, limit, newOffset);
      const data = await response.json();
      setSessions(prev => [...prev, ...(data.sessions || [])]);
      setOffset(newOffset);
      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error('Failed to load more sessions:', error);
    }
  };

  const handleSessionClick = (session) => {
    if (onSessionSelect) {
      onSessionSelect(session);
    }
    navigate(`/session/${session.id}`);
  };

  const handleNewSession = () => {
    if (onNewSession && projectInfo) {
      onNewSession(projectInfo);
      navigate('/');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (confirm('Delete this session?')) {
      try {
        if (onSessionDelete) {
          await onSessionDelete(projectName, sessionId);
        }
        // Reload sessions after deletion
        loadSessions();
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  };

  // Filter and sort sessions
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return session.summary?.toLowerCase().includes(query) ||
           session.id?.toLowerCase().includes(query);
  });

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (sortOrder === 'recent') {
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    } else {
      return new Date(a.updated_at || 0) - new Date(b.updated_at || 0);
    }
  });

  // Group sessions by date
  const groupSessionsByDate = (sessions) => {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    sessions.forEach(session => {
      const sessionDate = new Date(session.updated_at || session.created_at);
      let groupKey;

      if (sessionDate >= today) {
        groupKey = 'Today';
      } else if (sessionDate >= yesterday) {
        groupKey = 'Yesterday';
      } else if (sessionDate >= weekAgo) {
        groupKey = 'This Week';
      } else {
        // Group by month
        groupKey = sessionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(session);
    });

    return groups;
  };

  const groupedSessions = groupSessionsByDate(sortedSessions);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Sessions for {projectInfo?.name || projectName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleNewSession}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading sessions...</div>
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No sessions match your search' : 'No sessions yet'}
              </p>
              {!searchQuery && (
                <Button onClick={handleNewSession} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Start First Session
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSessions).map(([date, sessions]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">{date}</h3>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "group flex items-start gap-3 p-4 rounded-lg border transition-all",
                          "bg-card hover:bg-accent/5 hover:border-primary/30",
                          "cursor-pointer"
                        )}
                        onClick={() => handleSessionClick(session)}
                      >
                        <MessageSquare className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground mb-1">
                            {session.summary || 'Untitled Session'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(session.updated_at, currentTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {session.message_count || 0} messages
                            </span>
                            {session.model && (
                              <span className="text-xs px-2 py-0.5 bg-accent rounded">
                                {session.model}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Load more button */}
              {hasMore && (
                <div className="text-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMoreSessions}
                    className="w-full max-w-xs"
                  >
                    Load More Sessions
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SessionsView;