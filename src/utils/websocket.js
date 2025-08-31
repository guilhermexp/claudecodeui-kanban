import { useState, useEffect, useRef } from 'react';

export function useWebSocket(authReady = false, wsPath = '/ws') {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const wsRef = useRef(null);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    // Only connect when auth is ready and we have a token
    if (authReady) {
      const token = localStorage.getItem('auth-token');
      if (token && !hasConnectedRef.current) {
        hasConnectedRef.current = true;
        connect();
      }
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      hasConnectedRef.current = false;
    };
  }, [authReady]);

  const connect = async () => {
    // Prevent multiple simultaneous connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      // Get authentication token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        return;
      }
      
      // Fetch server configuration to get the correct WebSocket URL
      let wsBaseUrl;
      try {
        const configResponse = await fetch('/api/config', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;
        
        // If the config returns localhost but we're not on localhost, use current host
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // When using ngrok or proxy, use the same host/port
          wsBaseUrl = `${protocol}//${window.location.host}`;
        }
      } catch (error) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // When using ngrok or proxy, use the same host/port
        wsBaseUrl = `${protocol}//${window.location.host}`;
      }
      
      // Create WebSocket URL without token in query parameters
      const normalizedPath = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
      const wsUrl = `${wsBaseUrl}${normalizedPath}`;
      console.log('[WebSocket] Connecting to:', wsUrl, 'Path:', normalizedPath);
      
      // Browser WebSocket API doesn't support custom headers
      // For browser security, we need to send the token after connection
      const websocket = new WebSocket(wsUrl);
      
      wsRef.current = websocket;

      // Send authentication token immediately after connection opens
      websocket.onopen = () => {
        // Send authentication message first
        websocket.send(JSON.stringify({
          type: 'auth',
          token: token
        }));
        setIsConnected(true);
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data]);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;
        
        // Only attempt to reconnect if we still have a token
        const token = localStorage.getItem('auth-token');
        if (token && !reconnectTimeoutRef.current) {
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  const sendMessage = (message) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(message));
    } else {
    }
  };

  // Expose connect method to allow reconnection after login
  const reconnect = () => {
    // Reset the connection flag
    hasConnectedRef.current = false;
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    // Connect again
    connect();
  };

  return {
    ws,
    sendMessage,
    messages,
    isConnected,
    reconnect
  };
}
