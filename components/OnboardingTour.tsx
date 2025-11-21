import React, { useEffect, useRef, useState } from 'react';

export type TourStep = {
  id: string;
  title: string;
  body: string;
  targetSelector?: string; // optional CSS selector to spotlight
  placement?: 'auto' | 'top' | 'right' | 'bottom' | 'left';
  allowInteraction?: boolean; // allow clicks on target under overlay
  nextOnTargetClick?: boolean;
  navigateToTab?: string; // tab to navigate to before showing this step
};

interface OnboardingTourProps {
  isOpen: boolean;
  steps: TourStep[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, steps, currentIndex, onNext, onPrev, onSkip }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [isOpen, onSkip]);

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentIndex];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  // Navigate to required tab if specified and update target element
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const findVisibleElement = (selector: string): HTMLElement | null => {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        // Check if element is visible (not display:none and has dimensions)
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return el;
        }
      }
      return null;
    };
    
    if (step.navigateToTab) {
      window.dispatchEvent(new CustomEvent('circleup:navigateToTab', { detail: step.navigateToTab }));
      // Give the tab change time to render, then find the target element
      timeout = setTimeout(() => {
        if (step.targetSelector) {
          const el = findVisibleElement(step.targetSelector);
          if (el) {
            setTargetElement(el);
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
              const rect = el.getBoundingClientRect();
              setTargetRect(rect);
            });
            // Scroll element into view if needed
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }
        }
      }, 350);
    } else if (step.targetSelector) {
      // No navigation needed, find element immediately
      timeout = setTimeout(() => {
        const el = findVisibleElement(step.targetSelector);
        if (el) {
          setTargetElement(el);
          // Use requestAnimationFrame to ensure layout is complete
          requestAnimationFrame(() => {
            const rect = el.getBoundingClientRect();
            setTargetRect(rect);
          });
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }, 150);
    } else {
      // No target selector, clear previous target
      setTargetElement(null);
      setTargetRect(null);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [step.navigateToTab, step.targetSelector, currentIndex]);

  // Attach click handler to target element for interactive steps
  useEffect(() => {
    if (targetElement && step.nextOnTargetClick) {
      const handler = (e: Event) => {
        e.stopPropagation();
        onNext();
      };
      targetElement.addEventListener('click', handler, { once: true, capture: true });
      return () => targetElement.removeEventListener('click', handler, { capture: true });
    }
  }, [targetElement, step.nextOnTargetClick, onNext]);

  // Backdrop style with optional pointer-events passthrough
  const backdropStyle: React.CSSProperties = {
    pointerEvents: step.allowInteraction ? 'none' : 'auto',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      aria-live="polite"
      role="dialog"
      aria-modal="true"
    >
      {/* Dim background with spotlight cutout */}
      {targetRect ? (
        <>
          {/* Four panels creating a frame around the target */}
          {/* Top panel */}
          <div 
            className="absolute bg-black/40"
            style={{
              ...backdropStyle,
              left: 0,
              right: 0,
              top: 0,
              height: `${targetRect.top - 12}px`,
            }}
            onClick={onSkip}
          />
          {/* Bottom panel */}
          <div 
            className="absolute bg-black/40"
            style={{
              ...backdropStyle,
              left: 0,
              right: 0,
              bottom: 0,
              top: `${targetRect.bottom + 12}px`,
            }}
            onClick={onSkip}
          />
          {/* Left panel */}
          <div 
            className="absolute bg-black/40"
            style={{
              ...backdropStyle,
              left: 0,
              top: `${targetRect.top - 12}px`,
              width: `${targetRect.left - 12}px`,
              height: `${targetRect.height + 24}px`,
            }}
            onClick={onSkip}
          />
          {/* Right panel */}
          <div 
            className="absolute bg-black/40"
            style={{
              ...backdropStyle,
              right: 0,
              top: `${targetRect.top - 12}px`,
              left: `${targetRect.right + 12}px`,
              height: `${targetRect.height + 24}px`,
            }}
            onClick={onSkip}
          />
          
          {/* Pulsing highlight ring around target */}
          <div
            className={step.nextOnTargetClick ? "absolute cursor-pointer" : "absolute pointer-events-none"}
            style={{
              left: `${targetRect.left - 12}px`,
              top: `${targetRect.top - 12}px`,
              width: `${targetRect.width + 24}px`,
              height: `${targetRect.height + 24}px`,
              border: '4px solid #3b82f6',
              borderRadius: '16px',
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.4), 0 0 30px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(59, 130, 246, 0.2)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
            onClick={step.nextOnTargetClick ? (e) => { e.stopPropagation(); onNext(); } : undefined}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/40" style={backdropStyle} onClick={onSkip} />
      )}

      {/* Tooltip panel */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-[92%] p-4 z-[61] text-gray-800 dark:text-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">{step.body}</p>
          </div>
          <button onClick={onSkip} aria-label="Skip tour" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7.707 7.293a1 1 0 010 1.414L9.586 11l-1.879 1.879a1 1 0 001.414 1.414L11 12.414l1.879 1.879a1 1 0 001.414-1.414L12.414 11l1.879-1.879a1 1 0 10-1.414-1.414L11 9.586 9.121 7.707a1 1 0 00-1.414 0z" clipRule="evenodd"/></svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500 dark:text-gray-400">Step {currentIndex + 1} of {steps.length}</span>
          <div className="flex gap-2">
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 text-xs rounded-md bg-gray-200 dark:bg-gray-700 disabled:opacity-40"
            >Back</button>
            <button
              onClick={onNext}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white"
            >{currentIndex === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
