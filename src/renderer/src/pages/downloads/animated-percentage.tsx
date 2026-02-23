import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDownloadProgress } from "@renderer/helpers";

interface AnimatedPercentageProps {
  value: number;
}

export function AnimatedPercentage({
  value,
}: Readonly<AnimatedPercentageProps>) {
  const percentageText = formatDownloadProgress(value);
  const prevTextRef = useRef<string>(percentageText);
  const chars = percentageText.split("");
  const prevChars = prevTextRef.current.split("");

  useEffect(() => {
    prevTextRef.current = percentageText;
  }, [percentageText]);

  return (
    <>
      {chars.map((char, index) => {
        const prevChar = prevChars[index];
        const charChanged = prevChar !== char;

        return (
          <AnimatePresence key={`${index}`} mode="wait" initial={false}>
            <motion.span
              key={`${char}-${value}-${index}`}
              initial={
                charChanged ? { y: 10, opacity: 0 } : { y: 0, opacity: 1 }
              }
              animate={{ y: 0, opacity: 1 }}
              exit={charChanged ? { y: -10, opacity: 0 } : undefined}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{ display: "inline-block" }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        );
      })}
    </>
  );
}
