import { useEffect, useRef, RefObject } from 'react';

/**
 * useIntersectionObserver Hook
 * Triggers a callback when an element intersects with the viewport
 * Useful for infinite scrolling, lazy loading, etc.
 * 
 * @param callback - Function to call when intersection occurs
 * @param options - IntersectionObserver options
 * @returns Ref to attach to the target element
 * 
 * @example
 * const loadMoreRef = useIntersectionObserver(() => {
 *   loadMoreItems();
 * }, { threshold: 0.1 });
 * 
 * return <div ref={loadMoreRef}>Loading...</div>
 */
export const useIntersectionObserver = (
    callback: () => void,
    options?: IntersectionObserverInit
): RefObject<HTMLDivElement> => {
    const targetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    callback();
                }
            },
            {
                threshold: 0.1,
                ...options,
            }
        );

        const currentTarget = targetRef.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
            observer.disconnect();
        };
    }, [callback, options]);

    return targetRef;
};

export default useIntersectionObserver;
