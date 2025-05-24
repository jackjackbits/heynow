import { useState, useRef, useEffect, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { VoiceNote as VoiceNoteType } from '@/hooks/useVoiceNotes';
import { useAuthor } from '@/hooks/useAuthor';
import { useAutoAccount } from '@/hooks/useAutoAccount';
import { formatDistanceToNow } from 'date-fns';

interface VoiceNoteProps {
  voiceNote: VoiceNoteType;
}

export const VoiceNote = memo(function VoiceNote({ voiceNote }: VoiceNoteProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ x: voiceNote.x || 50, y: voiceNote.y || 50 });
  const audioRef = useRef<HTMLAudioElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<number | null>(null);
  const author = useAuthor(voiceNote.author);
  const { user } = useAutoAccount();
  
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || voiceNote.author.slice(0, 8);
  const isOwnNote = user?.publicKey === voiceNote.author;
  
  // Calculate initial opacity
  const calculateInitialOpacity = () => {
    const now = Math.floor(Date.now() / 1000);
    const age = now - voiceNote.timestamp;
    const maxAge = 10 * 60; // 10 minutes in seconds
    const fadeStartAge = 9 * 60; // Start fading at 9 minutes
    
    if (age >= maxAge) {
      return 0;
    } else if (age >= fadeStartAge) {
      // Linear fade from 1 to 0 over the last minute
      const fadeProgress = (age - fadeStartAge) / (maxAge - fadeStartAge);
      return 1 - fadeProgress;
    }
    return 1;
  };
  
  const [opacity, setOpacity] = useState(calculateInitialOpacity());
  
  // Update opacity periodically
  useEffect(() => {
    const updateOpacity = () => {
      const now = Math.floor(Date.now() / 1000);
      const age = now - voiceNote.timestamp;
      const maxAge = 10 * 60; // 10 minutes in seconds
      const fadeStartAge = 9 * 60; // Start fading at 9 minutes
      
      if (age >= maxAge) {
        setOpacity(0);
      } else if (age >= fadeStartAge) {
        // Linear fade from 1 to 0 over the last minute
        const fadeProgress = (age - fadeStartAge) / (maxAge - fadeStartAge);
        setOpacity(1 - fadeProgress);
      } else {
        setOpacity(1);
      }
    };
    
    const interval = setInterval(updateOpacity, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [voiceNote.timestamp]);
  
  // Random movement parameters for each orb
  const movementParams = useRef({
    speedX: (Math.random() - 0.5) * 0.04, // -0.02 to 0.02 per frame (faster)
    speedY: (Math.random() - 0.5) * 0.04,
    wobbleX: Math.random() * Math.PI * 2,
    wobbleY: Math.random() * Math.PI * 2,
    wobbleSpeedX: 0.0002 + Math.random() * 0.0002,
    wobbleSpeedY: 0.0002 + Math.random() * 0.0002,
    wobbleAmplitudeX: 0.5 + Math.random() * 1,
    wobbleAmplitudeY: 0.5 + Math.random() * 1,
  }).current;
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    }
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (!isHovered) {
        setPosition(prev => {
          let newX = prev.x + movementParams.speedX;
          let newY = prev.y + movementParams.speedY;
          
          // Add wobble effect
          movementParams.wobbleX += movementParams.wobbleSpeedX;
          movementParams.wobbleY += movementParams.wobbleSpeedY;
          
          const wobbleOffsetX = Math.sin(movementParams.wobbleX) * movementParams.wobbleAmplitudeX * 0.01;
          const wobbleOffsetY = Math.cos(movementParams.wobbleY) * movementParams.wobbleAmplitudeY * 0.01;
          
          newX += wobbleOffsetX;
          newY += wobbleOffsetY;
          
          // Define edge detection zones
          const hardBoundary = 5; // 5% from edge - absolute boundary
          const softBoundary = 15; // 15% from edge - start turning away
          
          // Soft edge avoidance - gradually turn away when approaching edges
          if (prev.x <= softBoundary && movementParams.speedX < 0) {
            // Approaching left edge
            const edgeDistance = prev.x;
            const turnForce = (softBoundary - edgeDistance) / softBoundary * 0.008; // Increased turn force for faster speed
            movementParams.speedX += turnForce;
          } else if (prev.x >= 100 - softBoundary && movementParams.speedX > 0) {
            // Approaching right edge
            const edgeDistance = 100 - prev.x;
            const turnForce = (softBoundary - edgeDistance) / softBoundary * 0.008;
            movementParams.speedX -= turnForce;
          }
          
          if (prev.y <= softBoundary && movementParams.speedY < 0) {
            // Approaching top edge
            const edgeDistance = prev.y;
            const turnForce = (softBoundary - edgeDistance) / softBoundary * 0.008;
            movementParams.speedY += turnForce;
          } else if (prev.y >= 100 - softBoundary && movementParams.speedY > 0) {
            // Approaching bottom edge
            const edgeDistance = 100 - prev.y;
            const turnForce = (softBoundary - edgeDistance) / softBoundary * 0.008;
            movementParams.speedY -= turnForce;
          }
          
          // Hard boundary - ensure orbs never go past this point
          if (newX <= hardBoundary) {
            newX = hardBoundary;
            movementParams.speedX = Math.abs(movementParams.speedX);
          } else if (newX >= 100 - hardBoundary) {
            newX = 100 - hardBoundary;
            movementParams.speedX = -Math.abs(movementParams.speedX);
          }
          
          if (newY <= hardBoundary) {
            newY = hardBoundary;
            movementParams.speedY = Math.abs(movementParams.speedY);
          } else if (newY >= 100 - hardBoundary) {
            newY = 100 - hardBoundary;
            movementParams.speedY = -Math.abs(movementParams.speedY);
          }
          
          // Limit max speed to prevent erratic movement
          const maxSpeed = 0.06; // Increased max speed
          movementParams.speedX = Math.max(-maxSpeed, Math.min(maxSpeed, movementParams.speedX));
          movementParams.speedY = Math.max(-maxSpeed, Math.min(maxSpeed, movementParams.speedY));
          
          return { x: newX, y: newY };
        });
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [movementParams, voiceNote.id, isHovered]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    
    // Show tooltip with a slight delay
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 200);
    
    if (audioRef.current && !isPlaying) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          // Handle autoplay policy restrictions
          console.log('Autoplay blocked:', error);
          // Don't set isPlaying to true if autoplay fails
        });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowTooltip(false);
    
    // Clear the tooltip timeout if it exists
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleClick = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.error('Failed to play audio:', error);
          });
      }
    }
  };

  // Generate a color for non-own notes (using publicKey for consistency)
  const orbColor = useMemo(() => {
    if (isOwnNote) return 'rgb(74 222 128)'; // green-400
    
    // Extended color palette with even more variety
    const colors = [
      'rgb(251 146 60)', // orange-400
      'rgb(250 204 21)', // yellow-400
      'rgb(147 51 234)', // purple-600
      'rgb(236 72 153)', // pink-500
      'rgb(59 130 246)', // blue-500
      'rgb(168 85 247)', // purple-500
      'rgb(249 115 22)', // orange-500
      'rgb(239 68 68)',  // red-500
      'rgb(34 197 94)',  // green-500
      'rgb(14 165 233)', // sky-500
      'rgb(99 102 241)', // indigo-500
      'rgb(244 63 94)',  // rose-500
      'rgb(245 158 11)', // amber-500
      'rgb(16 185 129)', // emerald-500
      'rgb(6 182 212)',  // cyan-500
      'rgb(217 70 239)', // fuchsia-500
      'rgb(124 58 237)', // violet-600
      'rgb(220 38 38)',  // red-600
      'rgb(37 99 235)',  // blue-600
      'rgb(251 191 36)', // amber-400
    ];
    
    const index = parseInt(voiceNote.author.slice(0, 8), 16) % colors.length;
    return colors[index];
  }, [isOwnNote, voiceNote.author]);
  
  return (
    <>
      <div
        ref={orbRef}
        className="absolute cursor-pointer transition-transform duration-300"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: `translate(-50%, -50%)`,
          opacity: 0,
          animation: 'fadeIn 2s ease-out forwards',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
      {/* Container for all orb elements */}
      <div className="relative transition-opacity duration-1000" style={{ width: '48px', height: '48px', opacity }}>
        {/* Outer glow */}
        <div
          className="absolute rounded-full blur-xl"
          style={{
            width: '70px',
            height: '70px',
            background: orbColor,
            opacity: isHovered ? 0.2 : 0.15,
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            animation: isPlaying ? 'slowPulse 1.5s ease-in-out infinite' : 'breathe 4s ease-in-out infinite',
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
        
        {/* Middle glow */}
        <div
          className="absolute rounded-full blur-md"
          style={{
            width: '55px',
            height: '55px',
            background: orbColor,
            opacity: isHovered ? 0.35 : 0.25,
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            animation: isPlaying ? 'slowPulse 1.5s ease-in-out infinite 0.2s' : 'breathe 4s ease-in-out infinite 0.5s',
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
        
        {/* Inner glow */}
        <div
          className="absolute rounded-full blur-sm"
          style={{
            width: '45px',
            height: '45px',
            background: orbColor,
            opacity: isHovered ? 0.4 : 0.3,
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            animation: isPlaying ? 'slowPulse 1.5s ease-in-out infinite 0.4s' : 'breathe 4s ease-in-out infinite 1s',
            transition: 'opacity 0.5s ease-in-out',
          }}
        />
        
        {/* Core orb */}
        <div
          className="relative w-12 h-12 rounded-full"
          style={{
            backgroundColor: orbColor,
            boxShadow: isHovered 
              ? `0 0 30px ${orbColor}, inset 0 0 15px rgba(255,255,255,0.4)` 
              : `0 0 20px ${orbColor}, inset 0 0 10px rgba(255,255,255,0.3)`,
            transition: 'box-shadow 0.5s ease-in-out',
          }}
        />
      </div>
      
      <audio
        ref={audioRef}
        src={voiceNote.audioUrl}
        preload="none"
        playsInline
      />
    </div>
    
    {/* Toast notification rendered via portal */}
    {showTooltip && createPortal(
      <div 
        className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500"
        style={{ 
          animation: 'toastFadeIn 0.5s ease-out forwards',
        }}
      >
        <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl text-xs text-gray-300 shadow-2xl border border-gray-800 text-center">
          <div className="font-medium text-white">{displayName}</div>
          <div className="text-gray-400 mt-1">
            {formatDistanceToNow(voiceNote.timestamp * 1000)} ago
            {isOwnNote && (
              <span className="text-green-400/90 ml-2">• your voice</span>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
});