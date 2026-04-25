/**
 * Shared striped-background placeholder for missing/broken thumbnails.
 * Used by Knowledge Hub comp-viewer modal and Price Tracker tile view.
 *
 * Apply via inline style:
 *   style={{ backgroundImage: PLACEHOLDER_BG, backgroundSize: PLACEHOLDER_SIZE }}
 */
export const PLACEHOLDER_BG =
  "linear-gradient(135deg, rgba(201,168,76,0.05) 25%, transparent 25%, transparent 50%, rgba(201,168,76,0.05) 50%, rgba(201,168,76,0.05) 75%, transparent 75%)";

export const PLACEHOLDER_SIZE = "12px 12px";

/** onError handler for <img> elements — hides the broken image and applies the placeholder gradient to the parent. */
export function applyPlaceholderOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  el.style.display = "none";
  const parent = el.parentElement;
  if (parent) {
    parent.style.backgroundImage = PLACEHOLDER_BG;
    parent.style.backgroundSize = PLACEHOLDER_SIZE;
  }
}
