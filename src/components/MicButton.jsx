import React, { useState, useEffect, useRef } from 'react';
import { Mic, Loader2, Brain, Delete } from 'lucide-react';
import { transcribeWithWhisper } from '../utils/whisper';

export function MicButton({ onTranscript, className = '', isChat = false, hasChatText = false }) {
  const [state, setState] = useState('idle'); // idle, recording, transcribing, processing
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const lastTapRef = useRef(0);
  const longPressTimerRef = useRef(null);
  const deleteIntervalRef = useRef(null);
  const escIntervalRef = useRef(null);
  
  // Check microphone support on mount
  useEffect(() => {
    const checkSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        setError('Microphone not supported. Please use HTTPS or a modern browser.');
        return;
      }
      
      // Additional check for secure context
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        setIsSupported(false);
        setError('Microphone requires HTTPS. Please use a secure connection.');
        return;
      }
      
      setIsSupported(true);
      setError(null);
    };
    
    checkSupport();
  }, []);

  // Start recording
  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      setError(null);
      chunksRef.current = [];

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not available. Please use HTTPS or a supported browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped, creating blob...');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Start transcribing
        setState('transcribing');
        
        // Check if we're in an enhancement mode
        const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
        const isEnhancementMode = whisperMode === 'prompt' || whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect';
        
        // Set up a timer to switch to processing state for enhancement modes
        let processingTimer;
        if (isEnhancementMode) {
          processingTimer = setTimeout(() => {
            setState('processing');
          }, 2000); // Switch to processing after 2 seconds
        }
        
        try {
          const text = await transcribeWithWhisper(blob);
          if (text && onTranscript) {
            onTranscript(text);
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError(err.message);
        } finally {
          if (processingTimer) {
            clearTimeout(processingTimer);
          }
          setState('idle');
        }
      };

      recorder.start();
      setState('recording');
      console.log('Recording started successfully');
    } catch (err) {
      console.error('Failed to start recording:', err);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Microphone access failed';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone permissions.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please check your audio devices.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Microphone not supported by this browser.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is being used by another application.';
      } else if (err.message.includes('HTTPS')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setState('idle');
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('Stopping recording...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Don't set state here - let the onstop handler do it
    } else {
      // If recorder isn't in recording state, force cleanup
      console.log('Recorder not in recording state, forcing cleanup');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setState('idle');
    }
  };

  // Handle button click
  const handleClick = (e) => {
    // Prevent double firing on mobile
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Don't proceed if microphone is not supported
    if (!isSupported) {
      return;
    }
    
    // Debounce for mobile double-tap issue
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      console.log('Ignoring rapid tap');
      return;
    }
    lastTapRef.current = now;
    
    console.log('Button clicked, current state:', state);
    
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
    // Do nothing if transcribing or processing
  };

  // Handle long press for menu (only in terminal mode)
  const handleTouchStart = (e) => {
    // Don't do long press in chat mode
    if (isChat) return;
    
    // Clear any existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    // Start long press timer (2 seconds)
    longPressTimerRef.current = setTimeout(() => {
      setShowMenu(true);
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 2000);
  };

  const handleTouchEnd = (e) => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // If menu is showing, close it on button tap
    if (showMenu) {
      setShowMenu(false);
    } else {
      // If menu is not showing, treat as normal click
      handleClick(e);
    }
  };

  const handleTouchCancel = () => {
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };
  
  // Mouse events for desktop testing
  const handleMouseDown = (e) => {
    // Simulate touch start
    handleTouchStart(e);
  };
  
  const handleMouseUp = (e) => {
    // Simulate touch end
    handleTouchEnd(e);
  };
  
  const handleMouseLeave = () => {
    // Simulate touch cancel
    handleTouchCancel();
  };

  // Handle Delete button
  const handleDelete = () => {
    if (isChat && window.deleteChatCharacter) {
      // Delete character from chat input
      window.deleteChatCharacter();
    } else if (!isChat && window.sendToActiveTerminal) {
      // Send backspace character to terminal
      window.sendToActiveTerminal('\x7f');
    }
    // Don't close menu - allow multiple clicks
  };

  // Handle Delete button press start (for repeat)
  const handleDeleteStart = () => {
    // Send first delete immediately
    handleDelete();
    
    // Start repeating after 500ms delay
    setTimeout(() => {
      if (deleteIntervalRef.current) return;
      deleteIntervalRef.current = setInterval(() => {
        handleDelete();
      }, 100); // Repeat every 100ms
    }, 500);
  };

  // Handle Delete button press end
  const handleDeleteEnd = () => {
    if (deleteIntervalRef.current) {
      clearInterval(deleteIntervalRef.current);
      deleteIntervalRef.current = null;
    }
  };

  // Handle ESC button
  const handleEsc = () => {
    if (isChat && window.clearChatInput) {
      // Clear entire chat input
      window.clearChatInput();
    } else if (!isChat && window.sendToActiveTerminal) {
      // Send ESC character to terminal
      window.sendToActiveTerminal('\x1b');
    }
    // Don't close menu - allow multiple clicks
  };

  // Handle ESC button press start (for repeat)
  const handleEscStart = () => {
    // Send first ESC immediately
    handleEsc();
    
    // Start repeating after 500ms delay
    setTimeout(() => {
      if (escIntervalRef.current) return;
      escIntervalRef.current = setInterval(() => {
        handleEsc();
      }, 500); // Repeat every 500ms (ESC doesn't need to be as fast)
    }, 500);
  };

  // Handle ESC button press end
  const handleEscEnd = () => {
    if (escIntervalRef.current) {
      clearInterval(escIntervalRef.current);
      escIntervalRef.current = null;
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Button appearance based on state
  const getButtonAppearance = () => {
    if (!isSupported) {
      return {
        icon: <Mic className="w-5 h-5" />,
        className: 'bg-gray-400 cursor-not-allowed',
        disabled: true
      };
    }
    
    switch (state) {
      case 'recording':
        return {
          icon: <Mic className="w-5 h-5 text-white" />,
          className: 'bg-red-500 hover:bg-red-600',
          disabled: false
        };
      case 'transcribing':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin" />,
          className: 'bg-blue-500 hover:bg-blue-600',
          disabled: true
        };
      case 'processing':
        return {
          icon: <Brain className="w-5 h-5" />,
          className: 'bg-purple-500 hover:bg-purple-600',
          disabled: true
        };
      default: // idle
        return {
          icon: <Mic className="w-5 h-5" />,
          className: 'bg-gray-700 hover:bg-gray-600',
          disabled: false
        };
    }
  };

  const { icon, className: buttonClass, disabled } = getButtonAppearance();

  // Handle Enter button for chat
  const handleEnter = () => {
    if (window.sendChatMessage && typeof window.sendChatMessage === 'function') {
      window.sendChatMessage();
    }
  };

  return (
    <div className="relative">
      {/* Chat mode buttons - show when there's text */}
      {isChat && hasChatText && (
        <>
          {/* Enter button - above */}
          <button
            type="button"
            onClick={handleEnter}
            className="absolute -top-14 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white flex items-center justify-center shadow-md transition-all duration-200 opacity-90 hover:opacity-100 animate-fade-in"
            title="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          {/* Delete button - left */}
          <button
            type="button"
            onMouseDown={handleDeleteStart}
            onMouseUp={handleDeleteEnd}
            onMouseLeave={handleDeleteEnd}
            onTouchStart={handleDeleteStart}
            onTouchEnd={handleDeleteEnd}
            onTouchCancel={handleDeleteEnd}
            className="absolute -left-14 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center shadow-md transition-all duration-200 opacity-90 hover:opacity-100 animate-fade-in"
            title="Delete (hold to repeat)"
          >
            <Delete className="w-4 h-4" />
          </button>
          
          {/* ESC button - right */}
          <button
            type="button"
            onMouseDown={handleEscStart}
            onMouseUp={handleEscEnd}
            onMouseLeave={handleEscEnd}
            onTouchStart={handleEscStart}
            onTouchEnd={handleEscEnd}
            onTouchCancel={handleEscEnd}
            className="absolute -right-14 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white flex items-center justify-center shadow-md transition-all duration-200 opacity-90 hover:opacity-100 animate-fade-in"
            title="ESC (hold to repeat)"
          >
            <span className="text-xs font-bold">ESC</span>
          </button>
        </>
      )}
      
      {/* Terminal mode menu - long press */}
      {!isChat && showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
            onTouchEnd={() => setShowMenu(false)}
          />
          
          {/* Menu buttons */}
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex gap-3 z-50">
            {/* Delete button */}
            <button
              type="button"
              onMouseDown={handleDeleteStart}
              onMouseUp={handleDeleteEnd}
              onMouseLeave={handleDeleteEnd}
              onTouchStart={handleDeleteStart}
              onTouchEnd={handleDeleteEnd}
              onTouchCancel={handleDeleteEnd}
              className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center justify-center shadow-lg transition-all duration-200 animate-fade-in"
              title="Delete (hold to repeat)"
            >
              <Delete className="w-5 h-5" />
            </button>
            
            {/* ESC button */}
            <button
              type="button"
              onMouseDown={handleEscStart}
              onMouseUp={handleEscEnd}
              onMouseLeave={handleEscEnd}
              onTouchStart={handleEscStart}
              onTouchEnd={handleEscEnd}
              onTouchCancel={handleEscEnd}
              className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white flex items-center justify-center shadow-lg transition-all duration-200 animate-fade-in"
              title="ESC (hold to repeat)"
            >
              <span className="text-xs font-bold">ESC</span>
            </button>
          </div>
        </>
      )}
      
      <button
        type="button"
        style={{
          backgroundColor: state === 'recording' ? '#ef4444' : 
                          state === 'transcribing' ? '#3b82f6' : 
                          state === 'processing' ? '#a855f7' :
                          '#374151'
        }}
        className={`
          flex items-center justify-center
          w-12 h-12 rounded-full
          text-white transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          dark:ring-offset-gray-800
          touch-action-manipulation
          ${disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
          hover:opacity-90
          ${className}
        `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          // Prevent click if menu is showing
          if (showMenu) {
            e.preventDefault();
            return;
          }
          // Only handle click if not on touch device
          if (!('ontouchstart' in window)) {
            handleClick(e);
          }
        }}
        disabled={disabled}
      >
        {icon}
      </button>
      
      {error && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 
                        bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10
                        animate-fade-in">
          {error}
        </div>
      )}
      
      {state === 'recording' && (
        <div className="absolute -inset-1 rounded-full border-2 border-red-500 animate-ping pointer-events-none" />
      )}
    </div>
  );
}