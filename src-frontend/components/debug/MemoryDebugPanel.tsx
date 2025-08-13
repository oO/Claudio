import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GripHorizontal, X } from 'lucide-react';
import type { MemorySnapshot } from '@/hooks/useMemoryMonitor';
import { api } from '@/lib/api';

interface MemoryDebugPanelProps {
  currentMemory: MemorySnapshot | null;
  isLeakDetected: boolean;
  memoryTrend: 'stable' | 'growing' | 'shrinking';
  onForceGC: () => void;
  formatBytes: (bytes: number) => string;
  onClose?: () => void;
}

export const MemoryDebugPanel: React.FC<MemoryDebugPanelProps> = ({
  currentMemory,
  isLeakDetected,
  memoryTrend,
  onForceGC,
  formatBytes,
  onClose
}) => {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('claudio-memory-panel-position');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 340, y: 80 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Manual window state save function
  const saveCurrentWindowState = async () => {
    try {
      const currentState = await api.getCurrentWindowState();
      await api.saveWindowState(currentState);
      console.log('Window state saved manually:', currentState);
    } catch (error) {
      console.error('Failed to save window state manually:', error);
    }
  };

  // Save position to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('claudio-memory-panel-position', JSON.stringify(position));
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep panel within viewport bounds
      const maxX = window.innerWidth - 320; // panel width
      const maxY = window.innerHeight - 200; // approximate panel height
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Early return after all hooks are defined
  if (!currentMemory) return null;

  const usagePercent = ((currentMemory.usedJSHeapSize / currentMemory.jsHeapSizeLimit) * 100).toFixed(1);
  
  const getTrendColor = () => {
    switch (memoryTrend) {
      case 'growing': return 'text-red-500';
      case 'shrinking': return 'text-green-500';
      default: return 'text-blue-500';
    }
  };

  const getTrendIcon = () => {
    switch (memoryTrend) {
      case 'growing': return '📈';
      case 'shrinking': return '📉';
      default: return '➡️';
    }
  };

  return (
    <Card 
      ref={panelRef}
      className={`fixed w-80 z-50 bg-background/95 backdrop-blur border-2 border-accent ${
        isDragging ? 'cursor-grabbing shadow-2xl' : 'cursor-auto'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="flex items-center justify-between w-full">
            <div 
              className="flex items-center gap-1 cursor-grab hover:bg-accent/10 rounded px-1 -mx-1 flex-1"
              onMouseDown={handleMouseDown}
              title="Drag to move panel"
            >
              <GripHorizontal className="h-3 w-3 text-muted-foreground" />
              🧠 Memory Monitor
              {isLeakDetected && <span className="text-red-500 animate-pulse ml-2">🔥 LEAK</span>}
            </div>
            {onClose && (
              <Button
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-destructive/10"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Used</div>
            <div className="font-mono">{formatBytes(currentMemory.usedJSHeapSize)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Usage</div>
            <div className={`font-mono ${parseFloat(usagePercent) > 80 ? 'text-red-500' : ''}`}>
              {usagePercent}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="font-mono">{formatBytes(currentMemory.totalJSHeapSize)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Limit</div>
            <div className="font-mono">{formatBytes(currentMemory.jsHeapSizeLimit)}</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <span className="text-muted-foreground">Trend:</span>
            <span className={`ml-1 ${getTrendColor()}`}>
              {getTrendIcon()} {memoryTrend}
            </span>
          </div>
        </div>

        {currentMemory.sessionCount !== undefined && (
          <div className="text-xs">
            <span className="text-muted-foreground">Sessions:</span>
            <span className="ml-1 font-mono">{currentMemory.sessionCount}</span>
          </div>
        )}

        {currentMemory.virtualizedItems !== undefined && (
          <div className="text-xs">
            <span className="text-muted-foreground">Virtual Items:</span>
            <span className="ml-1 font-mono">{currentMemory.virtualizedItems}</span>
          </div>
        )}

        {currentMemory.systemMemory && (
          <div className="pt-2 border-t space-y-1">
            <div className="text-xs font-medium text-muted-foreground">System Info</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Process</div>
                <div className="font-mono">{currentMemory.systemMemory.process_memory_mb.toFixed(1)}MB</div>
              </div>
              <div>
                <div className="text-muted-foreground">CPU</div>
                <div className="font-mono">{currentMemory.systemMemory.process_cpu_percent.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Available</div>
                <div className="font-mono">{currentMemory.systemMemory.system_available_mb.toFixed(0)}MB</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-mono">{currentMemory.systemMemory.system_total_mb.toFixed(0)}MB</div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t space-y-2">
          <Button 
            onClick={onForceGC} 
            size="sm" 
            variant="outline" 
            className="w-full text-xs"
          >
            🧹 Force GC
          </Button>
          <div className="flex gap-1">
            <Button 
              onClick={() => setPosition({ x: window.innerWidth - 340, y: 80 })} 
              size="sm" 
              variant="ghost" 
              className="flex-1 text-xs"
            >
              📍 Reset
            </Button>
            <Button 
              onClick={saveCurrentWindowState} 
              size="sm" 
              variant="ghost" 
              className="flex-1 text-xs"
              title="Save window position & size"
            >
              💾 Save Win
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-center">
            Open Chrome with --expose-gc for manual GC
          </div>
        </div>
      </CardContent>
    </Card>
  );
};