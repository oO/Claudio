import { useEffect, useRef, useCallback, useState } from 'react';

interface UseScrollPinningOptions {
  messageCount: number;
  isLoading?: boolean;
  threshold?: number; // Distance from bottom to consider "pinned"
}

/**
 * Hook to manage scroll pinning behavior similar to Claude Code CLI
 * - Tracks if user is pinned to bottom
 * - Auto-scrolls to bottom when new messages arrive (if pinned)
 * - Provides navigation functions
 */
export function useScrollPinning({
  messageCount,
  isLoading = false,
  threshold = 100
}: UseScrollPinningOptions) {
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const previousMessageCountRef = useRef(messageCount);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is near bottom of page
  const checkIfPinnedToBottom = useCallback(() => {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    const distanceFromBottom = documentHeight - (scrollTop + windowHeight);
    const pinned = distanceFromBottom <= threshold;
    
    setIsPinnedToBottom(pinned);
    return pinned;
  }, [threshold]);

  // Scroll to bottom smoothly
  const scrollToBottom = useCallback(() => {
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
    
    console.log('=== SCROLL TO BOTTOM DEBUG ===');
    console.log('document.documentElement.scrollHeight:', document.documentElement.scrollHeight);
    console.log('document.body.scrollHeight:', document.body.scrollHeight);
    console.log('Max scroll height:', scrollHeight);
    console.log('Current scroll position:', window.pageYOffset);
    console.log('Window height:', window.innerHeight);
    console.log('Can scroll?', scrollHeight > window.innerHeight);
    
    // Calculate the maximum scrollable distance
    const maxScroll = scrollHeight - window.innerHeight;
    console.log('Max scrollable distance:', maxScroll);
    
    if (maxScroll > 0) {
      // Try different scroll methods
      console.log('Attempting to scroll to:', maxScroll);
      
      // Method 1: window.scrollTo
      window.scrollTo({
        top: maxScroll,
        behavior: 'smooth'
      });
      
      // Method 2: Direct property assignment (fallback)
      setTimeout(() => {
        document.documentElement.scrollTop = maxScroll;
        console.log('After scroll attempt, position:', window.pageYOffset);
      }, 500);
    } else {
      console.log('Content is not tall enough to scroll');
    }
    
    setIsPinnedToBottom(true);
  }, []);

  // Scroll to top smoothly  
  const scrollToTop = useCallback(() => {
    console.log('Scrolling to top');
    console.log('Current scroll position:', window.pageYOffset);
    
    // Try multiple scroll methods
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    // Fallback methods
    setTimeout(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);
    
    setIsPinnedToBottom(false);
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    setIsUserScrolling(true);
    
    // Clear previous timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set timeout to detect end of scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      checkIfPinnedToBottom();
    }, 150);
    
    // Immediate check for pinning
    checkIfPinnedToBottom();
  }, [checkIfPinnedToBottom]);

  // Auto-scroll when new messages arrive (if pinned)
  useEffect(() => {
    const hasNewMessages = messageCount > previousMessageCountRef.current;
    
    if (hasNewMessages && isPinnedToBottom && !isUserScrolling && !isLoading) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
    
    previousMessageCountRef.current = messageCount;
  }, [messageCount, isPinnedToBottom, isUserScrolling, isLoading]);

  // Set up scroll listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    checkIfPinnedToBottom();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, checkIfPinnedToBottom]);

  return {
    isPinnedToBottom,
    isUserScrolling,
    scrollToBottom,
    scrollToTop,
    checkIfPinnedToBottom
  };
}