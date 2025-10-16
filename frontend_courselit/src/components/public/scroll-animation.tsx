"use client";

import { cn } from "@workspace/ui/lib/utils";
import {
  cubicBezier,
  motion,
  type TargetAndTransition,
  useInView,
} from "framer-motion";
import { CSSProperties, HTMLAttributes, type ReactNode, useRef, useEffect, useState } from "react";
type AnimationVariant =
  | "fadeIn"
  | "fadeUp"
  | "fadeDown"
  | "fadeLeft"
  | "fadeRight"
  | "scale"
  | "flip"
  | "rotate";

interface ScrollAnimationProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  margin?: string;
  amount?: "some" | "all" | number;
  style?: CSSProperties;
}
const easing = cubicBezier(0.22, 1, 0.36, 1);
const variants = {
  hidden: {
    opacity: 0,
  },
  fadeIn: {
    opacity: 1,
  },
  fadeUp: {
    opacity: 1,
    y: 0,
  },
  fadeDown: {
    opacity: 1,
    y: 0,
  },
  fadeLeft: {
    opacity: 1,
    x: 0,
  },
  fadeRight: {
    opacity: 1,
    x: 0,
  },
  scale: {
    opacity: 1,
    scale: 1,
  },
  flip: {
    opacity: 1,
    rotateY: 0,
  },
  rotate: {
    opacity: 1,
    rotate: 0,
  },
};
const getInitialVariant = (variant: AnimationVariant): TargetAndTransition => {
  switch (variant) {
    case "fadeIn":
      return { opacity: 0 };
    case "fadeUp":
      return { opacity: 0, y: 50 };
    case "fadeDown":
      return { opacity: 0, y: -50 };
    case "fadeLeft":
      return { opacity: 0, x: 50 };
    case "fadeRight":
      return { opacity: 0, x: -50 };
    case "scale":
      return { opacity: 0, scale: 0.8 };
    case "flip":
      return { opacity: 0, rotateY: 90 };
    case "rotate":
      return { opacity: 0, rotate: -10 };
    default:
      return { opacity: 0 };
  }
};

export function ScrollAnimation({
  children,
  className,
  variant = "fadeUp",
  delay = 0,
  duration = 0.5,
  once = true,
  margin = "0px",
  amount = "some",
  style,
}: ScrollAnimationProps) {
  const ref = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const isInView = useInView(ref, {
    once: true,
    margin: "-50px 0px -50px 0px",
    amount: 0.5,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={getInitialVariant(variant)}
      animate={isMounted && isInView ? variants[variant] : "hidden"}
      transition={{
        duration,
        delay,
        ease: easing,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function ScrollGroup({
  children,
  className,
  variant = "fadeUp",
  staggerDelay = 0.1,
  childDelay = 0,
  duration = 0.5,
  once = true,
  staggerChildren = true,
}: ScrollAnimationProps & {
  staggerDelay?: number;
  childDelay?: number;
  staggerChildren?: boolean;
}) {
  const ref = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const isInView = useInView(ref, {
    once,
    amount: "some",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerChildren ? staggerDelay : 0,
        delayChildren: childDelay,
      },
    },
  };

  const item = {
    hidden: getInitialVariant(variant),
    show: {
      ...variants[variant],
      transition: {
        duration,
        ease: easing,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      variants={container}
      initial="hidden"
      animate={isMounted && isInView ? "show" : "hidden"}
      className={cn(className)}
    >
      {Array.isArray(children)
        ? children.map((child, index) => (
            <motion.div key={index} variants={item} className="scroll-item">
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  );
}
