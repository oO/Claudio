import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { DebugLabel } from '@/components/ui/atoms';
import { logger } from '@/lib/logger';

interface ImageWidgetProps {
  content: {
    type: 'image';
    source: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  };
  className?: string;
}

/**
 * Widget for displaying base64 encoded images in messages
 * Handles image loading, error states, and proper sizing
 */
export const ImageWidget: React.FC<ImageWidgetProps> = ({ content, className }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { source } = content;

  if (source.type !== 'base64' || !source.data) {
    logger.error('ImageWidget: Invalid image source', { source });
    return (
      <div className={cn("p-4 bg-destructive/10 border border-destructive/20 rounded-md relative", className)}>
        <DebugLabel label="ImageWidget" />
        <p className="text-destructive text-sm">Invalid image data</p>
      </div>
    );
  }

  const imageUrl = `data:${source.media_type};base64,${source.data}`;

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setHasError(true);
    logger.error('Failed to load image');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (hasError) {
    return (
      <div className={cn("p-4 bg-destructive/10 border border-destructive/20 rounded-md relative", className)}>
        <DebugLabel label="ImageWidget" />
        <p className="text-destructive text-sm">Failed to load image</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn("relative rounded-md overflow-hidden bg-muted/30 border flex items-center justify-center", className)}>
        <DebugLabel label="ImageWidget" />

        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
            <div className="text-sm text-muted-foreground">Loading image...</div>
          </div>
        )}

        <img
          src={imageUrl}
          alt="User uploaded image"
          className={cn(
            "max-w-full h-auto cursor-pointer transition-opacity duration-200 block",
            !isLoaded && "opacity-0"
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={toggleFullscreen}
          style={{ maxHeight: '400px' }}
        />

        {isLoaded && (
          <div className="absolute bottom-2 right-2 opacity-70 hover:opacity-100 transition-opacity">
            <button
              onClick={toggleFullscreen}
              className="bg-black/50 text-white text-xs px-2 py-1 rounded hover:bg-black/70"
            >
              Click to expand
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={toggleFullscreen}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={imageUrl}
              alt="User uploaded image (fullscreen)"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 bg-black/50 text-white text-sm px-3 py-1 rounded hover:bg-black/70"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};