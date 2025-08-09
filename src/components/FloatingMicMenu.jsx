import React, { useState, useEffect, useRef } from 'react';
import { Mic, Loader2, Brain, Delete, CornerDownLeft, X } from 'lucide-react';
import { transcribeWithWhisper } from '../utils/whisper';

export function FloatingMicMenu({ onTranscript }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [recordingState, setRecordingState] = useState('idle'); // idle, recording, transcribing, processing
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [transcribedText, setTranscribedText] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  
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

  // Toggle menu expansion
  const toggleMenu = () => {
    if (recordingState !== 'idle') {
      // If recording or processing, don't toggle
      return;
    }
    setIsExpanded(!isExpanded);
    if (isExpanded) {
      // Clear transcribed text when closing menu
      setTranscribedText('');
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
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
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Start transcribing
        setRecordingState('transcribing');
        
        // Check if we're in an enhancement mode
        const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
        const isEnhancementMode = whisperMode === 'prompt' || whisperMode === 'vibe' || whisperMode === 'instructions' || whisperMode === 'architect';
        
        // Set up a timer to switch to processing state for enhancement modes
        let processingTimer;
        if (isEnhancementMode) {
          processingTimer = setTimeout(() => {
            setRecordingState('processing');
          }, 2000); // Switch to processing after 2 seconds
        }
        
        try {
          const text = await transcribeWithWhisper(blob);
          if (text) {
            setTranscribedText(text);
            if (onTranscript) {
              onTranscript(text);
            }
          }
        } catch (err) {
          // Check for API key error
          if (err.message && err.message.includes('API key')) {
            setError('OpenAI API key não configurada. Configure OPENAI_API_KEY no servidor.');
          } else {
            setError(err.message || 'Erro na transcrição');
          }
        } finally {
          if (processingTimer) {
            clearTimeout(processingTimer);
          }
          setRecordingState('idle');
        }
      };

      recorder.start();
      setRecordingState('recording');

    } catch (err) {
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
      } else if (err.name === 'SecurityError' || err.name === 'TypeError') {
        // SecurityError happens when not on HTTPS
        errorMessage = 'Microphone requires HTTPS. Use https:// or localhost.';
      } else if (err.message.includes('HTTPS')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setRecordingState('idle');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Don't set state here - let the onstop handler do it
    } else {
      // If recorder isn't in recording state, force cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setRecordingState('idle');
    }
  };

  // Handle record button click
  const handleRecord = () => {
    if (!isSupported) {
      setError('Microphone not supported in this browser');
      return;
    }
    
    if (recordingState === 'idle') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };

  // Handle Delete button
  const handleDelete = () => {
    if (window.sendToActiveTerminal) {
      // Send DEL character to terminal (standard for terminal delete)
      window.sendToActiveTerminal('\x7f');
    }
  };

  // Handle ESC button
  const handleEsc = () => {
    if (window.sendToActiveTerminal) {
      // Send ESC character to terminal
      window.sendToActiveTerminal('\x1b');
    }
  };

  // Handle Enter button
  const handleEnter = () => {
    if (window.sendToActiveTerminal) {
      // Send Enter key to terminal
      window.sendToActiveTerminal('\r');
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

  // Get record button appearance based on state
  const getRecordButtonAppearance = () => {
    if (!isSupported) {
      return {
        icon: <Mic className="w-5 h-5" />,
        className: 'bg-gray-400 cursor-not-allowed',
        disabled: true
      };
    }
    
    switch (recordingState) {
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

  const { icon: recordIcon, className: recordButtonClass, disabled: recordDisabled } = getRecordButtonAppearance();

  return (
    <div className="relative">
      {/* Expanded menu buttons */}
      {isExpanded && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-2 animate-fade-in-up">
          {/* Record button */}
          <button
            type="button"
            onClick={handleRecord}
            disabled={recordDisabled}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${recordButtonClass}`}
            title={recordingState === 'recording' ? 'Stop recording' : 'Start recording'}
          >
            {recordIcon}
          </button>
          
          {/* ESC button */}
          <button
            type="button"
            onClick={handleEsc}
            className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-lg transition-all duration-200"
            title="Send ESC"
          >
            <span className="text-white text-xs font-bold">ESC</span>
          </button>
          
          {/* Enter button */}
          <button
            type="button"
            onClick={handleEnter}
            className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-lg transition-all duration-200"
            title="Send Enter"
          >
            <CornerDownLeft className="w-5 h-5 text-white" />
          </button>
          
          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center shadow-lg transition-all duration-200"
            title="Delete"
          >
            <Delete className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
      
      {/* Main toggle button */}
      <button
        type="button"
        onClick={toggleMenu}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
          isExpanded 
            ? 'bg-blue-500 hover:bg-blue-600' 
            : recordingState === 'recording' 
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-gray-700 hover:bg-gray-600'
        }`}
        title={isExpanded ? 'Close menu' : 'Open voice menu'}
      >
        {isExpanded ? (
          <X className="w-6 h-6 text-white" />
        ) : recordingState === 'recording' ? (
          <Mic className="w-6 h-6 text-white animate-pulse" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </button>
      
      {/* Recording indicator */}
      {recordingState === 'recording' && (
        <div className="absolute -inset-1 rounded-full border-2 border-red-500 animate-ping pointer-events-none" />
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute bottom-full mb-2 right-0 
                        bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10
                        animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}