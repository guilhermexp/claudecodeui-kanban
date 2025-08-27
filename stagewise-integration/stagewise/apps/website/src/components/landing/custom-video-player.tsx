'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

interface CustomVideoPlayerProps {
  videoSrc: string;
  thumbnailSrc: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  playsInline?: boolean;
}

// Helper function to detect if URL is a YouTube video
function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

// Helper function to convert YouTube URL to embed format with proper validation and parameters
function getYouTubeEmbedUrl(
  url: string,
  muted = false,
  origin?: string,
): string {
  // YouTube video ID pattern (11 characters: letters, numbers, underscore, hyphen)
  const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

  try {
    const urlObj = new URL(url);
    let videoId = '';

    // Handle different YouTube URL formats
    if (
      urlObj.hostname === 'www.youtube.com' ||
      urlObj.hostname === 'youtube.com'
    ) {
      if (urlObj.pathname === '/watch') {
        // Regular watch URL: https://www.youtube.com/watch?v=VIDEO_ID
        videoId = urlObj.searchParams.get('v') || '';
      } else if (urlObj.pathname.startsWith('/embed/')) {
        // Already an embed URL: https://www.youtube.com/embed/VIDEO_ID
        videoId = urlObj.pathname.substring(7); // Remove '/embed/'
      }
    } else if (urlObj.hostname === 'youtu.be') {
      // Short URL: https://youtu.be/VIDEO_ID
      videoId = urlObj.pathname.substring(1); // Remove leading '/'
    }

    // Validate the extracted video ID
    if (!videoId || !videoIdPattern.test(videoId)) {
      // If no valid video ID found, return original URL
      return url;
    }

    // Create embed URL with validated video ID
    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);

    // Set required search parameters
    embedUrl.searchParams.set('autoplay', '1');
    embedUrl.searchParams.set('controls', '1');
    embedUrl.searchParams.set('rel', '0');
    embedUrl.searchParams.set('modestbranding', '1');
    embedUrl.searchParams.set('enablejsapi', '1');

    // Set origin parameter
    const originValue =
      origin || (typeof window !== 'undefined' ? window.location.origin : '');
    if (originValue) {
      embedUrl.searchParams.set('origin', originValue);
    }

    // Set muted parameter if requested
    if (muted) {
      embedUrl.searchParams.set('mute', '1');
    }

    return embedUrl.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('Failed to parse YouTube URL:', error);
    return url;
  }
}

export function CustomVideoPlayer({
  videoSrc,
  thumbnailSrc,
  alt = 'Video thumbnail',
  className = '',
  width = 1200,
  height = 675,
  muted = true,
  loop = true,
  controls = false,
  preload = 'auto',
  playsInline = true,
}: CustomVideoPlayerProps) {
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isYouTube = isYouTubeUrl(videoSrc);

  const handlePlayClick = async () => {
    setIsLoading(true);

    try {
      if (isYouTube) {
        // For YouTube videos, we'll load the iframe with autoplay
        if (iframeRef.current) {
          const origin =
            typeof window !== 'undefined' ? window.location.origin : undefined;
          const embedUrl = getYouTubeEmbedUrl(videoSrc, muted, origin);
          iframeRef.current.src = embedUrl;

          // Listen for iframe load event to send unmute command
          const handleIframeLoad = () => {
            const win = iframeRef.current?.contentWindow;
            if (win && iframeRef.current?.src) {
              const targetOrigin = new URL(iframeRef.current.src).origin;
              win.postMessage(
                '{"event":"command","func":"unMute","args":""}',
                targetOrigin,
              );
            }
          };

          iframeRef.current.addEventListener('load', handleIframeLoad, {
            once: true,
          });
        }
        setShowThumbnail(false);
      } else {
        // Handle regular video files
        if (!videoRef.current) return;

        // Ensure video is loaded before trying to play
        if (videoRef.current.readyState < 2) {
          // Video not ready, wait for it to load
          await new Promise<void>((resolve, reject) => {
            const video = videoRef.current!;

            const onLoadedData = () => {
              video.removeEventListener('loadeddata', onLoadedData);
              video.removeEventListener('error', onError);
              resolve();
            };

            const onError = () => {
              video.removeEventListener('loadeddata', onLoadedData);
              video.removeEventListener('error', onError);
              reject(new Error('Video failed to load'));
            };

            video.addEventListener('loadeddata', onLoadedData);
            video.addEventListener('error', onError);

            // Force load if needed
            video.load();
          });
        }

        // Now try to play the video
        await videoRef.current.play();
        console.log('Video started playing successfully');

        // Hide thumbnail after successful play
        setShowThumbnail(false);
      }
    } catch (error) {
      console.error('Failed to play video:', error);
      // Still hide thumbnail so user can interact with video controls
      setShowThumbnail(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Render iframe for YouTube videos, video element for others */}
      {isYouTube ? (
        <iframe
          ref={iframeRef}
          className="aspect-video w-full rounded-xl border border-indigo-900/50"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={alt}
        />
      ) : (
        <video
          ref={videoRef}
          src={videoSrc}
          width={width}
          height={height}
          className="aspect-video w-full rounded-xl border border-indigo-900/50 object-cover"
          muted={muted}
          loop={loop}
          controls={controls}
          preload={preload}
          playsInline={playsInline}
        />
      )}

      {/* Thumbnail overlay - shown by default, hidden after play */}
      {showThumbnail && (
        <button
          type="button"
          className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
          onClick={handlePlayClick}
          aria-label="Play video"
        >
          {/* Thumbnail image */}
          <Image
            src={thumbnailSrc}
            alt={alt}
            width={width}
            height={height}
            className="aspect-video w-full rounded-xl border border-indigo-900/50 object-cover"
            priority
          />

          {/* Play button overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20 transition-all duration-300 group-hover:bg-black/30"
            style={{ borderRadius: '0.75rem' }}
          >
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-zinc-50/90 shadow-lg">
              {/* Plastic effect overlay */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/5 via-white/30 to-white/60" />
              {/* Soft glowing border effect */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.3)]" />
              {/* Top highlight for 3D effect */}
              <div className="absolute inset-x-0 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent" />
              {/* Bottom shadow for depth */}
              <div className="absolute inset-x-0 bottom-0 h-px rounded-full bg-gradient-to-r from-transparent via-black/20 to-transparent" />
              {isLoading ? (
                <div className="relative z-10 h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <svg
                  className="relative z-10 ml-1 h-8 w-8 text-black"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>

          {/* Optional: Add a "Play Video" text below the button */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="mt-28 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <span className="font-medium text-sm">
                {isLoading ? 'Loading...' : 'Click to play'}
              </span>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
