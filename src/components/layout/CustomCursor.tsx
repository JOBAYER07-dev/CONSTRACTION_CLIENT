'use client';

import { useEffect, useState, startTransition } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [data-cursor="hover"], .cursor-pointer';

export default function CustomCursor() {
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);

  const ringX = useSpring(dotX, { damping: 28, stiffness: 300, mass: 0.5 });
  const ringY = useSpring(dotY, { damping: 28, stiffness: 300, mass: 0.5 });

  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    startTransition(() => {
      setEnabled(isFinePointer);
    });
    if (!isFinePointer) return;

    const handleMove = (e: MouseEvent) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(!!target.closest(INTERACTIVE_SELECTOR));
    };

    const handleLeaveWindow = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseover', handleOver);
    document.documentElement.addEventListener('mouseleave', handleLeaveWindow);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseover', handleOver);
      document.documentElement.removeEventListener(
        'mouseleave',
        handleLeaveWindow,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[10000] hidden md:block"
      style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.2s' }}
    >
      <motion.div
        className="fixed rounded-full border border-[#10B981]/60"
        style={{
          left: ringX,
          top: ringY,
          x: '-50%',
          y: '-50%',
          width: isHovering ? 52 : 32,
          height: isHovering ? 52 : 32,
          backgroundColor: isHovering
            ? 'rgba(16, 185, 129, 0.08)'
            : 'transparent',
          transition:
            'width 0.25s ease, height 0.25s ease, background-color 0.25s ease',
        }}
      />
      <motion.div
        className="fixed rounded-full bg-[#38BDF8]"
        style={{
          left: dotX,
          top: dotY,
          x: '-50%',
          y: '-50%',
          width: isHovering ? 6 : 8,
          height: isHovering ? 6 : 8,
          transition: 'width 0.2s ease, height 0.2s ease',
        }}
      />
    </div>
  );
}
