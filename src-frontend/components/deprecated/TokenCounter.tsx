import React from 'react';
import { motion } from 'framer-motion';
import { Hash } from 'lucide-react';

interface TokenCounterProps {
  totalTokens: number;
}

/**
 * @deprecated This component was removed from SessionPromptControls as it's redundant
 * with the token counter already shown in SessionHeader. Keeping here for reference.
 * 
 * Previously used in SessionPromptControls to show token count at bottom of prompt area.
 */
export const TokenCounter: React.FC<TokenCounterProps> = ({ totalTokens }) => {
  if (totalTokens <= 0) return null;

  return (
    <div className="border-t bg-muted/20 px-4 py-2">
      <div className="max-w-5xl mx-auto flex justify-end">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="bg-background border rounded-full px-3 py-1 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            <span className="font-mono">{totalTokens.toLocaleString()}</span>
            <span>tokens</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};