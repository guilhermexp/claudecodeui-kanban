import { useState, useEffect, useRef } from 'react';

export function useWebSocket(authReady = false) {
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
      if (ws) {
        ws.close();
      }
    };
  }, [authReady]);

  const connect = async () => {
    try {
      // Get authentication token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.warn('No authentication token found for WebSocket connection');
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
          console.warn('Config returned localhost, using current host with same port');
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // When using ngrok or proxy, use the same host/port
          wsBaseUrl = `${protocol}//${window.location.host}`;
        }
      } catch (error) {
        console.warn('Could not fetch server config, falling back to current host');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // When using ngrok or proxy, use the same host/port
        wsBaseUrl = `${protocol}//${window.location.host}`;
      }
      
      // Include token in WebSocket URL as query parameter
      const wsUrl = `${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`;
      const websocket = new WebSocket(wsUrl);
      wsRef.current = websocket;

      websocket.onopen = () => {
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
        
        // Only attempt to reconnect if we still have a token
        const token = localStorage.getItem('auth-token');
        if (token) {
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
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
      console.warn('WebSocket not connected');
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