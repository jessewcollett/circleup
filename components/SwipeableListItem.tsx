import React, { useRef } from 'react';

interface SwipeableListItemProps {
  children: React.ReactNode;
  onItemClick?: () => void;
  leftActionView?: React.ReactNode;
  rightActionView?: React.ReactNode;
  onFullSwipeLeft?: () => void;
  onFullSwipeRight?: () => void;
  isDisabled?: boolean;
}

const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  onItemClick,
  leftActionView,
  rightActionView,
  onFullSwipeLeft,
  onFullSwipeRight,
  isDisabled,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isScrolling = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentTranslateX = useRef(0);
  
  // Increased threshold to make swipe more deliberate and prevent accidental activation during scroll.
  const DRAG_THRESHOLD = 10; 

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If gestures are disabled (e.g., in reorder mode), do nothing.
    if (isDisabled) {
        return;
    }
    
    // Only handle primary button clicks/touches
    if (e.button !== 0) return;

    isDragging.current = false;
    isScrolling.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    
    const element = itemRef.current;
    if (!element) return;

    // Remove transition for instant feedback during drag
    element.style.transition = 'none';
    element.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (isScrolling.current) return;

      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      // Determine if this is a swipe or a scroll
      if (!isDragging.current) {
        if (Math.abs(deltaY) > DRAG_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
          // User is scrolling vertically, so we release the pointer and let the browser handle it.
          isScrolling.current = true;
          handlePointerUp(moveEvent); // Clean up listeners
          return;
        }
        if (Math.abs(deltaX) > DRAG_THRESHOLD) {
          // User is swiping horizontally
          isDragging.current = true;
        }
      }
      
      if (isDragging.current) {
        // Prevent swipe in directions with no action by applying resistance
        if ((deltaX < 0 && !onFullSwipeLeft) || (deltaX > 0 && !onFullSwipeRight)) {
            currentTranslateX.current = deltaX / (1 + Math.abs(deltaX) / 100);
        } else {
            currentTranslateX.current = deltaX;
        }
        element.style.transform = `translateX(${currentTranslateX.current}px)`;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      element.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      // If it wasn't a drag and wasn't a scroll, it's a click
      if (!isDragging.current && !isScrolling.current) {
        if (onItemClick) onItemClick();
        return;
      }
      
      // Add transition for the snap-back or swipe-away animation
      element.style.transition = 'transform 0.25s ease-out';
      
      const itemWidth = element.offsetWidth;
      const swipeThreshold = itemWidth * 0.4; // A bit more decisive threshold

      let targetX = 0;
      let action: (() => void) | undefined = undefined;

      if (currentTranslateX.current < -swipeThreshold && onFullSwipeLeft) {
        targetX = -itemWidth;
        action = onFullSwipeLeft;
      } else if (currentTranslateX.current > swipeThreshold && onFullSwipeRight) {
        targetX = itemWidth;
        action = onFullSwipeRight;
      }
      
      // Animate to the target position (either fully swiped or back to 0)
      element.style.transform = `translateX(${targetX}px)`;
      
      // If an action was triggered, execute it after the animation
      if (action) {
        setTimeout(() => {
            action?.();
        }, 250);
      }
      
      currentTranslateX.current = 0; // Reset for next interaction
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <li className="relative bg-white dark:bg-gray-800 overflow-hidden select-none">
      {/* Background Action Views */}
      <div className="absolute inset-0 flex justify-between items-stretch">
        <div className="flex-1">{rightActionView}</div>
        <div className="flex-1">{leftActionView}</div>
      </div>
      
      {/* The main content that moves */}
      <div
        ref={itemRef}
        className={`relative z-10 w-full bg-white dark:bg-gray-800 ${!isDisabled ? 'cursor-pointer' : ''}`}
        style={{ touchAction: 'pan-y' }} // Allow vertical scroll, handle horizontal
        onPointerDown={handlePointerDown}
      >
        {children}
      </div>
    </li>
  );
};

export default SwipeableListItem;