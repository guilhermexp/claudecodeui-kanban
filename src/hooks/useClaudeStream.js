import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { applyPatch } from 'fast-json-patch';

const useClaudeStream = (sessionId, authToken) => {
    const [conversation, setConversation] = useState({ entries: [] });
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [claudeSessionId, setClaudeSessionId] = useState(null);
    
    const abortControllerRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    
    // Establish SSE connection
    const establishConnection = useCallback((workingDir) => {
        if (!sessionId || !authToken) return;
        
        // Clean up any existing connection
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        
        const url = `/api/claude-stream/stream/${sessionId}${workingDir ? `?workingDir=${encodeURIComponent(workingDir)}` : ''}`;
        
        // Establishing connection for session
        
        fetchEventSource(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'text/event-stream'
            },
            signal: abortController.signal,
            openWhenHidden: true, // Keep connection open when tab is hidden
            
            onopen(response) {
                if (response.ok && response.status === 200) {
                    setIsConnected(true);
                    setError(null);
                    reconnectAttemptsRef.current = 0;
                } else {
                    console.error('[Claude Stream] Connection failed:', response.status);
                    throw new Error(`Connection failed with status ${response.status}`);
                }
            },
            
            onmessage(event) {
                try {
                    const eventType = event.event || 'message';
                    const data = JSON.parse(event.data);
                    
                    // Processing event
                    
                    switch (eventType) {
                        case 'connected':
                        case 'ready':
                            setIsConnected(true);
                            break;
                            
                        case 'session':
                            // Update to the REAL session ID from Claude CLI
                            if (data.realSessionId) {
                                setClaudeSessionId(data.realSessionId);
                            }
                            break;
                            
                        case 'patch':
                            // Apply JSON patch to conversation
                            const { patches, batch_id, cursor } = data;
                            setConversation(prev => {
                                try {
                                    const patched = applyPatch(
                                        JSON.parse(JSON.stringify(prev)),
                                        patches,
                                        true // Validate patches
                                    );
                                    return patched.newDocument;
                                } catch (err) {
                                    console.error('[Claude Stream] Patch application failed:', err);
                                    return prev;
                                }
                            });
                            break;
                            
                        case 'output':
                            // Raw output from Claude
                            if (data.text) {
                                setConversation(prev => ({
                                    ...prev,
                                    entries: [...prev.entries, {
                                        type: 'output',
                                        content: data.text,
                                        timestamp: new Date().toISOString()
                                    }]
                                }));
                            }
                            break;
                            
                        case 'error':
                            console.error('[Claude Stream] Error event:', data.error);
                            setError(data.error);
                            break;
                            
                        case 'complete':
                            setIsLoading(false);
                            break;
                            
                        case 'raw':
                            // Raw Claude event
                            break;
                    }
                } catch (err) {
                    console.error('[Claude Stream] Failed to process event:', err);
                }
            },
            
            onerror(err) {
                console.error('[Claude Stream] Connection error:', err);
                setIsConnected(false);
                setError(err.message || 'Connection error');
                
                // Implement exponential backoff for reconnection
                if (reconnectAttemptsRef.current < 5) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    reconnectAttemptsRef.current++;
                    
                    // Reconnecting with exponential backoff
                    
                    reconnectTimeoutRef.current = setTimeout(() => {
                        establishConnection(workingDir);
                    }, delay);
                }
            }
        }).catch(err => {
            console.error('[Claude Stream] Fetch error:', err);
            setIsConnected(false);
            setError(err.message);
        });
    }, [sessionId, authToken]);
    
    // Send message to Claude
    const sendMessage = useCallback(async (message, workingDir, images = [], model = null) => {
        if (!sessionId || !authToken) {
            setError('No active session');
            return false;
        }
        
        setIsLoading(true);
        setError(null);
        
        // Add user message to conversation immediately (optimistic update)
        setConversation(prev => ({
            ...prev,
            entries: [...prev.entries, {
                type: 'user_message',
                content: message,
                timestamp: new Date().toISOString()
            }]
        }));
        
        try {
            const response = await fetch(`/api/claude-stream/message/${sessionId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    workingDir,
                    images,
                    model
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to send message');
            }
            
            return true;
            
        } catch (err) {
            console.error('[Claude Stream] Failed to send message:', err);
            setError(err.message);
            setIsLoading(false);
            
            // Remove optimistic user message on error
            setConversation(prev => ({
                ...prev,
                entries: prev.entries.slice(0, -1)
            }));
            
            return false;
        }
    }, [sessionId, authToken]);
    
    // Abort current session
    const abortSession = useCallback(async () => {
        if (!sessionId || !authToken) return;
        
        try {
            // Abort SSE connection
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            
            // Call abort endpoint
            const response = await fetch(`/api/claude-stream/session/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                setIsConnected(false);
                setIsLoading(false);
                setClaudeSessionId(null);
            }
        } catch (err) {
            console.error('[Claude Stream] Failed to abort session:', err);
        }
    }, [sessionId, authToken]);
    
    // Clear conversation
    const clearConversation = useCallback(() => {
        setConversation({ entries: [] });
        setError(null);
    }, []);
    
    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, []);
    
    return {
        conversation,
        isConnected,
        isLoading,
        error,
        claudeSessionId,
        establishConnection,
        sendMessage,
        abortSession,
        clearConversation
    };
};

export default useClaudeStream;