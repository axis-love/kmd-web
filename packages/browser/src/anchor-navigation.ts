// @axis-love/browser — anchor navigation and scroll tracking
//
// Scroll-to-fragment behavior and heading scroll tracking for outline
// synchronization. Pure DOM utilities — no state, no side effects beyond
// scroll position.

const SCROLL_OFFSET_PX = 12;

/**
 * Compute the scrollTop value needed to bring a target element into view
 * within a scroll container, accounting for the container's position.
 */
export function getReaderScrollTopForTarget(
  containerScrollTop: number,
  containerTop: number,
  targetTop: number,
): number {
  return Math.max(0, containerScrollTop + targetTop - containerTop - SCROLL_OFFSET_PX);
}

/**
 * Find the DOM element corresponding to a fragment ID. Checks both the
 * bare ID and the sanitizer-prefixed form (`user-content-` prefix) for
 * compatibility with rehype-sanitize's default clobber prefix.
 */
export function findAnchorTarget(root: ParentNode, fragmentId: string): HTMLElement | null {
  const candidateIds = [fragmentId, `user-content-${fragmentId}`];

  for (const element of root.querySelectorAll<HTMLElement>("[id], a[name]")) {
    const name = element.getAttribute("name");
    if (candidateIds.includes(element.id) || (name !== null && candidateIds.includes(name))) {
      return element;
    }
  }

  return null;
}

/**
 * Scroll a container so that `target` is visible near the top. Uses
 * smooth scrolling by default.
 */
export function scrollContainerToTarget(
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior = "smooth",
): void {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  container.scrollTo({
    top: getReaderScrollTopForTarget(container.scrollTop, containerRect.top, targetRect.top),
    behavior,
  });
}

// ---------------------------------------------------------------------------
// Scroll tracker — active heading observer
// ---------------------------------------------------------------------------

/**
 * Options for creating a scroll tracker.
 */
export interface ScrollTrackerOptions {
  /** Extra offset in pixels from the container top for the active threshold. Default: 96. */
  readonly thresholdOffset?: number;
}

/**
 * A scroll tracker that observes scroll position and reports which
 * outline heading is currently the "active" one (closest to the top of
 * the scroll container).
 *
 * Uses requestAnimationFrame debouncing to avoid layout thrashing.
 * Call `dispose()` to remove listeners and cancel any pending frame.
 */
export class ScrollTracker {
  private readonly thresholdOffset: number;
  private frame: number | null = null;
  private activeSlug: string | undefined;

  /**
   * @param container The scrollable container element.
   * @param body The element containing rendered content (heading targets live here).
   * @param slugs Array of heading slugs from the outline, in document order.
   * @param onActiveChange Called when the active heading changes. Receives the slug or undefined.
   * @param options Optional configuration.
   */
  constructor(
    private readonly container: HTMLElement,
    private readonly body: HTMLElement,
    private readonly slugs: readonly string[],
    private readonly onActiveChange: (slug: string | undefined) => void,
    options?: ScrollTrackerOptions,
  ) {
    this.thresholdOffset = options?.thresholdOffset ?? 96;
  }

  /** Start tracking. Returns a cleanup function. */
  start(): () => void {
    this.update();
    this.container.addEventListener("scroll", this.scheduleUpdate, { passive: true });
    window.addEventListener("resize", this.scheduleUpdate);

    return () => {
      if (this.frame !== null) {
        window.cancelAnimationFrame(this.frame);
        this.frame = null;
      }
      this.container.removeEventListener("scroll", this.scheduleUpdate);
      window.removeEventListener("resize", this.scheduleUpdate);
    };
  }

  /** Force an immediate update of the active heading. */
  update(): void {
    if (this.slugs.length === 0) return;

    const containerRect = this.container.getBoundingClientRect();
    const threshold = containerRect.top + this.thresholdOffset;
    let current = this.slugs[0];

    for (const slug of this.slugs) {
      const target = findAnchorTarget(this.body, slug);
      if (!target) continue;

      if (target.getBoundingClientRect().top <= threshold) {
        current = slug;
      } else {
        break;
      }
    }

    if (current !== this.activeSlug) {
      this.activeSlug = current;
      this.onActiveChange(current);
    }
  }

  private readonly scheduleUpdate = (): void => {
    if (this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  };
}
