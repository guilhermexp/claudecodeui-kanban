import { api } from './api';

export async function transcribeWithWhisper(audioBlob, onStatusChange) {
    const formData = new FormData();
    const fileName = `recording_${Date.now()}.webm`;
    const file = new File([audioBlob], fileName, { type: audioBlob.type });
    
    formData.append('audio', file);
    
    const whisperMode = window.localStorage.getItem('whisperMode') || 'default';
    formData.append('mode', whisperMode);
  
    try {
      // Start with transcribing state
      if (onStatusChange) {
        onStatusChange('transcribing');
      }
  
      console.log('Starting transcription with mode:', whisperMode);
      console.log('Audio blob type:', audioBlob.type, 'size:', audioBlob.size);
  
      const response = await api.transcribe(formData);
  
      console.log('Transcription response status:', response.status);
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Transcription error:', errorData);
        throw new Error(
          errorData.error || 
          `Transcription error: ${response.status} ${response.statusText}`
        );
      }
  
      const data = await response.json();
      console.log('Transcription result:', data);
      return data.text || '';
    } catch (error) {
      console.error('Transcription failed:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Please ensure the backend is running.');
      }
      throw error;
    }
  }