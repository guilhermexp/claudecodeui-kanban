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
  
      console.log('Transcribing audio:', {
        fileName,
        fileSize: file.size,
        fileType: file.type,
        mode: whisperMode
      });
  
      const response = await api.transcribe(formData);
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Transcription error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(
          errorData.error || 
          `Transcription error: ${response.status} ${response.statusText}`
        );
      }
  
      const data = await response.json();
      return data.text || '';
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Cannot connect to server. Please ensure the backend is running.');
      }
      throw error;
    }
  }