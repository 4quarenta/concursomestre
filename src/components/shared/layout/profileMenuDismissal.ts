export const isModalInteraction = (target: EventTarget | null): boolean => (
  typeof Element !== 'undefined'
  && target instanceof Element
  && Boolean(target.closest('[role="dialog"][aria-modal="true"]'))
);
