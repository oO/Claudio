import React, { useEffect, useState } from "react";

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

  return { characters, isComplete };
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
  const { characters, isComplete } = useCharacterTypewriter(
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
      {characters.map((char, index) => (
        <span
          key={index}
          className={char.isVisible ? "opacity-100" : "opacity-0"}
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
  return (
    <div className="flex flex-col h-full relative">
      {/* Main content - centered */}
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-9xl font-bold mb-8 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 bg-clip-text text-transparent min-h-[1.2em]">
            <TypewriterText alwaysAnimate={true}>
              Hello, I'm Claudio.
            </TypewriterText>
          </h1>
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
