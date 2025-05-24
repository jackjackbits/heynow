import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';

export interface VoiceNote {
  id: string;
  event: NostrEvent;
  audioUrl: string;
  author: string;
  timestamp: number;
  x?: number;
  y?: number;
}

// Store positions in memory to prevent jumping
const positionCache = new Map<string, { x: number; y: number }>();

export function useVoiceNotes(room?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['voice-notes', room],
    queryFn: async (c) => {
      try {
        // Create abort signal - use fallback for Safari compatibility
        let signal: AbortSignal;
        if ('any' in AbortSignal && typeof AbortSignal.any === 'function') {
          signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
        } else {
          // Fallback for browsers without AbortSignal.any
          const controller = new AbortController();
          signal = controller.signal;
          
          // Set timeout manually
          setTimeout(() => controller.abort(), 5000);
          
          // Also abort if the query is cancelled
          if (c.signal) {
            c.signal.addEventListener('abort', () => controller.abort());
          }
        }
        
        // Build filter with optional room hashtag
        const filter: any = { kinds: [1069], limit: 100 };
        if (room) {
          filter['#t'] = [room];
        }
        
        const events = await nostr.query([filter], { signal });
        
        // Get current timestamp and 10 minutes ago
        const now = Math.floor(Date.now() / 1000);
        const tenMinutesAgo = now - (10 * 60); // 10 minutes in seconds
        
        // Parse voice notes with audio URLs
        const voiceNotes: VoiceNote[] = events
          .filter(event => {
            // Check if event has an audio URL tag
            const audioTag = event.tags.find(tag => tag[0] === 'url' || tag[0] === 'r');
            const hasAudio = audioTag && audioTag[1];
            
            // Check if event is within last 10 minutes
            const isRecent = event.created_at >= tenMinutesAgo;
            
            return hasAudio && isRecent;
          })
          .map(event => {
            const audioTag = event.tags.find(tag => tag[0] === 'url' || tag[0] === 'r');
            const audioUrl = audioTag![1];
            
            // Use cached position if available, otherwise generate new one
            let position = positionCache.get(event.id);
            if (!position) {
              position = {
                x: Math.random() * 80 + 10, // 10-90% of screen width
                y: Math.random() * 80 + 10, // 10-90% of screen height
              };
              positionCache.set(event.id, position);
            }
            
            return {
              id: event.id,
              event,
              audioUrl,
              author: event.pubkey,
              timestamp: event.created_at,
              x: position.x,
              y: position.y
            };
          });

        // Clean up position cache for old notes
        for (const [noteId, _] of positionCache) {
          if (!voiceNotes.find(note => note.id === noteId)) {
            positionCache.delete(noteId);
          }
        }

        console.log(`Found ${voiceNotes.length} voice notes from ${events.length} events`);
        return voiceNotes;
      } catch (error) {
        console.error('Error fetching voice notes:', error);
        throw error;
      }
    },
    refetchInterval: 10000, // Refetch every 10 seconds to get new notes
    staleTime: 5000
  });
}