import React, { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DebugLabel } from "@/components/ui/atoms";
import { logger } from "@/lib/logger";
import { useTabContext } from "@/contexts/TabContext";
import { useTabPersistence } from "@/hooks/useTabPersistence";

// Constants
const LETTER_DELAY = 30; // ms delay per letter
const SPACE_DELAY = 100; // ms delay for spaces
const PUNCTUATION_DELAY = 400; // ms delay for punctuation
const INITIAL_DELAY = 500; // ms delay before animation starts

// Simple session tracking for typewriter animation
const getHasPlayedTypewriterThisSession = () => {
  return sessionStorage.getItem("claudio-typewriter-played") === "true";
};

const setHasPlayedTypewriterThisSession = (value: boolean) => {
  sessionStorage.setItem("claudio-typewriter-played", value.toString());
};

// Custom hook for character-by-character opacity animation
const useCharacterTypewriter = (text: string, shouldStart: boolean) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!shouldStart || !text) {
      setVisibleCount(0);
      setIsComplete(false);
      return;
    }

    let currentIndex = 0;
    setVisibleCount(0);
    setIsComplete(false);

    const animateCharacters = () => {
      if (currentIndex < text.length) {
        setVisibleCount(currentIndex + 1);

        // Get current character for delay calculation
        const currentChar = text[currentIndex];
        let currentDelay = LETTER_DELAY;

        if (currentChar) {
          // Check character type and set appropriate delay
          if (/[.,:;!?)\]}\n]/.test(currentChar)) {
            // Punctuation gets long delay
            currentDelay = PUNCTUATION_DELAY;
          } else if (/\s/.test(currentChar)) {
            // Spaces get medium delay
            currentDelay = SPACE_DELAY;
          } else {
            // Regular letters get short delay
            currentDelay = LETTER_DELAY;
          }
        }

        currentIndex++;
        setTimeout(animateCharacters, currentDelay);
      } else {
        setIsComplete(true);
      }
    };

    const timeout = setTimeout(animateCharacters, INITIAL_DELAY);
    return () => clearTimeout(timeout);
  }, [text, shouldStart]);

  // Split text into individual characters with visibility
  const characters = text.split("").map((char, index) => ({
    char,
    isVisible: index < visibleCount,
  }));

  return { characters, isComplete, visibleCount };
};

// Props for the reusable TypewriterText component
interface TypewriterTextProps {
  children: string;
  className?: string;
  alwaysAnimate?: boolean;
}

// Reusable typewriter text component
export const TypewriterText: React.FC<TypewriterTextProps> = ({
  children,
  className = "",
  alwaysAnimate = false,
}) => {
  // Check if animation should play (only on first component mount of the session)
  const hasPlayed = getHasPlayedTypewriterThisSession();
  const [shouldAnimate] = useState(alwaysAnimate || !hasPlayed);

  // Use character typewriter for text
  const { characters, isComplete, visibleCount } = useCharacterTypewriter(
    children,
    shouldAnimate,
  );

  // Mark animation as completed when animation finishes
  useEffect(() => {
    if (shouldAnimate && isComplete) {
      setHasPlayedTypewriterThisSession(true);
    }
  }, [shouldAnimate, isComplete]);

  if (!shouldAnimate) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={className}>
      <style>
        {`
          .typing-cursor {
            border-left: 5px solid white;
            background-color: var(--color-card);
            animation: cursor-fade 0.6s ease-out forwards;
          }

          @keyframes cursor-fade {
            0% {
              border-left-color: rgba(255, 255, 255, 1);
              background-color: var(--color-card);
            }
            60% {
              border-left-color: rgba(255, 255, 255, 1);
              background-color: var(--color-card);
            }
            100% {
              border-left-color: rgba(255, 255, 255, 0);
              background-color: transparent;
            }
          }
        `}
      </style>
      {characters.map((char, index) => (
        <span
          key={index}
          className={`${char.isVisible ? "opacity-100" : "opacity-0"} ${
            index === visibleCount - 1 && char.isVisible ? "typing-cursor" : ""
          }`}
          style={{ transition: "opacity 0.1s ease-in" }}
        >
          {char.char}
        </span>
      ))}
    </span>
  );
};

// Full welcome screen component (specific to Claudio)
export const WelcomeScreen: React.FC = () => {
  const [haiku, setHaiku] = useState<string>("Welcome to Claudio");
  const { tabs, restoreTabs } = useTabContext();
  const { loadTabs, clearSavedTabs } = useTabPersistence();
  const autoRestoreTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [restoreBlocked, setRestoreBlocked] = useState(false);

  // Fetch random thinking haiku on component mount
  useEffect(() => {
    const fetchHaiku = async () => {
      try {
        const [_title, message] = await invoke<[string, string]>(
          "get_random_thinking_content",
        );
        setHaiku(message);
        logger.debug("🌸 Fetched random haiku:", message);
      } catch (error) {
        logger.error("Failed to fetch thinking haiku:", error);
        // Keep default message on error
      }
    };

    fetchHaiku();
  }, []);

  // Silent auto-restore logic
  useEffect(() => {
    console.log('🎯 AUTO-RESTORE EFFECT TRIGGERED:', { 
      tabsLength: tabs.length, 
      restoreBlocked, 
      hasTimer: !!autoRestoreTimerRef.current 
    });
    
    // Only attempt auto-restore if there are no tabs and restore hasn't been blocked
    if (tabs.length > 0 || restoreBlocked) {
      console.log('❌ AUTO-RESTORE BLOCKED:', { tabsLength: tabs.length, restoreBlocked });
      return;
    }
    
    console.log('✅ SETTING UP 15-SECOND AUTO-RESTORE TIMER...');

    const attemptRestore = async () => {
      try {
        console.log('🔍 ATTEMPTING TAB RESTORE...');
        const savedTabs = await loadTabs();
        console.log('📂 LOADED SAVED TABS:', savedTabs.tabs.length, savedTabs);
        
        if (savedTabs.tabs.length > 0 && !restoreBlocked) {
          console.log("🔄 RESTORING TABS SILENTLY:", savedTabs);
          await restoreTabs(savedTabs);
          console.log("✅ TABS RESTORED SUCCESSFULLY");
          // Clear saved tabs after successful restore to avoid duplicate restores
          await clearSavedTabs();
          console.log("🗑️ CLEARED SAVED TABS");
        } else {
          console.log("❌ NO TABS TO RESTORE OR RESTORE BLOCKED:", { savedTabsCount: savedTabs.tabs.length, restoreBlocked });
        }
      } catch (error) {
        console.error("💥 FAILED TO AUTO-RESTORE TABS:", error);
      }
    };

    // Set up 15-second timer for silent restoration
    autoRestoreTimerRef.current = setTimeout(attemptRestore, 15000);

    return () => {
      if (autoRestoreTimerRef.current) {
        clearTimeout(autoRestoreTimerRef.current);
        autoRestoreTimerRef.current = null;
      }
    };
  }, [tabs.length, restoreBlocked, restoreTabs, loadTabs, clearSavedTabs]);

  // Block auto-restore if user opens any tab manually
  useEffect(() => {
    if (tabs.length > 0 && !restoreBlocked) {
      setRestoreBlocked(true);
      if (autoRestoreTimerRef.current) {
        clearTimeout(autoRestoreTimerRef.current);
        autoRestoreTimerRef.current = null;
        logger.debug("🚫 Auto-restore cancelled - user opened tab manually");
      }
    }
  }, [tabs.length, restoreBlocked]);

  return (
    <div className="flex flex-col h-full relative">
      <DebugLabel label="Welcome" />
      {/* Main content - centered */}
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-9xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 bg-clip-text text-transparent min-h-[1.2em] gradient-rotate">
            <style>
              {`
                .gradient-rotate {
                  background-size: 300% 300%;
                  animation: gradient-spin 8s ease-in-out infinite;
                }

                @keyframes gradient-spin {
                  0% { background-position: 0% 50%; }
                  25% { background-position: 100% 50%; }
                  50% { background-position: 100% 100%; }
                  75% { background-position: 0% 100%; }
                  100% { background-position: 0% 50%; }
                }
              `}
            </style>
            <TypewriterText alwaysAnimate={true}>
              Hello, I'm Claudio.
            </TypewriterText>
          </h1>

          {/* Random thinking haiku */}
          <div className="text-center m-4 relative -top-8">
            <span className="text-2xl px-4 py-1 bg-card text-accent italic font-serif leading-relaxed animate-pulse haiku-lowercase">
              <style>
                {`
                  .haiku-lowercase {
                    text-transform: lowercase;
                  }
                `}
              </style>
              {haiku}
            </span>
          </div>
        </div>
      </div>

      {/* Copyright - bottom of screen */}
      <div className="pb-6 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025. Designed with ❤️ by oO. Coded with ✨ by Claude Code.
        </p>
      </div>
    </div>
  );
};
