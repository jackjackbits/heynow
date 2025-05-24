import { useState, useRef, useEffect } from 'react';
import { Plus, Mic } from 'lucide-react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useQueryClient } from '@tanstack/react-query';
import { useViewMode } from '@/contexts/ViewModeContext';
import AudioRecorder from 'audio-recorder-polyfill';

// Apply polyfill for Safari
if (!window.MediaRecorder) {
  window.MediaRecorder = AudioRecorder as typeof MediaRecorder;
  console.log('MediaRecorder polyfill applied');
}

interface RecordButtonProps {
  room?: string;
}

export function RecordButton({ room }: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const queryClient = useQueryClient();
  const { viewMode } = useViewMode();
  
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = () => {
      // Check if we're on HTTPS (required for getUserMedia on iOS)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.error('HTTPS is required for audio recording on iOS');
        return false;
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia not supported');
        return false;
      }
      if (!window.MediaRecorder) {
        console.error('MediaRecorder not supported (even with polyfill)');
        return false;
      }
      console.log('Audio recording should be supported');
      return true;
    };
    checkSupport();
  }, []);

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      
      // Check if we're on HTTPS (required for getUserMedia on iOS)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert('Audio recording requires HTTPS. Please access this site using https://');
        return;
      }
      
      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Audio recording is not supported in your browser. Please try using a different browser.');
        return;
      }

      // Request microphone permission with simpler constraints for mobile
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      
      console.log('Got audio stream');
      
      // Detect appropriate mime type
      let mimeType = 'audio/wav'; // Default for polyfill
      if (window.MediaRecorder && 'isTypeSupported' in window.MediaRecorder) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
      
      console.log('Using mime type:', mimeType);
      
      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType
        });
        
        console.log('MediaRecorder created successfully');
        
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          const extension = mimeType.includes('webm') ? 'webm' : 
                           mimeType.includes('mp4') ? 'm4a' : 'wav';
          const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, {
            type: mimeType
          });

          setIsUploading(true);
          try {
            // Upload to Blossom server
            const tags = await uploadFile(audioFile);
            const audioUrl = tags[0][1]; // First tag contains the URL

            // Build tags for the event
            const eventTags = [
              ['url', audioUrl],
              ...tags // Include all file metadata tags
            ];
            
            // Add room hashtag if in a room
            if (room) {
              eventTags.push(['t', room]);
            }
            
            // Publish voice note event
            await publishEvent({
              kind: 1069,
              content: '',
              tags: eventTags
            });

            // Small delay to allow relay propagation
            setTimeout(async () => {
              // Immediately refresh voice notes
              await queryClient.invalidateQueries({ queryKey: ['voice-notes', room] });
            }, 500);

            setIsUploading(false);
          } catch (error) {
            console.error('Error uploading audio:', error);
            setIsUploading(false);
          }

          // Clean up
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        console.log('Recording started');
      } catch (recorderError) {
        console.error('Error creating MediaRecorder:', recorderError);
        alert('Failed to start recording. Your browser may not support audio recording.');
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      // More specific error messages
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Microphone access denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError') {
          alert('No microphone found. Please connect a microphone and try again.');
        } else {
          alert(`Error starting recording: ${error.message}`);
        }
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isUploading}
      className={`
        fixed bottom-8 right-8 w-16 h-16 rounded-full
        flex items-center justify-center
        transition-all duration-300 transform
        ${isRecording 
          ? 'bg-red-500 hover:bg-red-600 scale-110' 
          : viewMode === 'matrix'
            ? 'bg-green-900/50 hover:bg-green-800/50 backdrop-blur border border-green-500/50'
            : 'bg-white/10 hover:bg-white/20 backdrop-blur'
        }
        ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        shadow-lg hover:shadow-xl
      `}
      style={{
        animation: isRecording ? 'slowPulse 1.5s ease-in-out infinite' : 'none',
        boxShadow: viewMode === 'matrix' && !isRecording 
          ? '0 0 20px rgba(34, 197, 94, 0.5)' 
          : undefined
      }}
    >
      {isUploading ? (
        <div className={`animate-spin rounded-full h-6 w-6 border-2 ${
          viewMode === 'matrix' ? 'border-green-400' : 'border-white'
        } border-t-transparent`} />
      ) : isRecording ? (
        <Mic className="w-6 h-6 text-white" />
      ) : (
        <Plus className={`w-6 h-6 ${viewMode === 'matrix' ? 'text-green-400' : 'text-white'}`} />
      )}
    </button>
  );
}