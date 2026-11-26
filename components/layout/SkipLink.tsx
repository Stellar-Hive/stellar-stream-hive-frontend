/** Id of the element the skip link jumps to; must match the `<main>` landmark in the root layout. */
export const MAIN_CONTENT_ID = "main-content";

/**
 * Visually hidden until focused, so keyboard and screen-reader users can jump
 * past the navigation straight to the page content.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-background"
    >
      Skip to content
    </a>
  );
}
