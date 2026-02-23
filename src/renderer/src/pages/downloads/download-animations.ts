import type { Variants } from "framer-motion";

export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const heroEnterVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const torrentPanelVariants: Variants = {
  collapsed: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
      opacity: { duration: 0.1 },
      height: { duration: 0.2 },
    },
  },
  expanded: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
      opacity: { duration: 0.2, delay: 0.1 },
      height: { duration: 0.3 },
    },
  },
};

export const chevronVariants: Variants = {
  collapsed: {
    rotate: 0,
    transition: { duration: 0.2, ease: "easeInOut" },
  },
  expanded: {
    rotate: 90,
    transition: { duration: 0.2, ease: "easeInOut" },
  },
};
