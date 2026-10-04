// Recruits carousel: scroll-snap list that also advances by itself while it is on screen.
// If every card already fits (wide screens), there is nothing to rotate and the dots stay hidden.
(function () {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const list = root.querySelector('.recruit-list');
  const dotsEl = root.querySelector('[data-dots]');
  const cards = Array.from(list.children);
  const INTERVAL = 4500;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let index = 0;
  let timer = null;
  let onScreen = false;
  let userActive = false;

  function overflows() {
    return list.scrollWidth > list.clientWidth + 8;
  }

  function goTo(i, smooth) {
    index = (i + cards.length) % cards.length;
    const gutter = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    list.scrollTo({ left: cards[index].offsetLeft - gutter, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
  }

  // Dots
  const dots = cards.map((card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Show recruit ' + (i + 1) + ' of ' + cards.length);
    b.addEventListener('click', () => { goTo(i, true); restart(); });
    dotsEl.appendChild(b);
    return b;
  });

  function markCurrent() {
    // The card whose left edge is closest to the visible left edge
    const gutter = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    let best = 0, bestDist = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - gutter - list.scrollLeft);
      if (d < bestDist) { best = i; bestDist = d; }
    });
    index = best;
    dots.forEach((b, i) => b.setAttribute('aria-current', i === best ? 'true' : 'false'));
  }
  list.addEventListener('scroll', markCurrent, { passive: true });

  function stop() { clearInterval(timer); timer = null; }
  function start() {
    stop();
    if (reduceMotion.matches || !onScreen || userActive || !overflows()) return;
    timer = setInterval(() => goTo(index + 1, true), INTERVAL);
  }
  function restart() { start(); }

  // Pause while someone is touching, hovering or focused inside the carousel
  root.addEventListener('pointerenter', () => { userActive = true; stop(); });
  root.addEventListener('pointerleave', () => { userActive = false; start(); });
  root.addEventListener('touchstart', () => { userActive = true; stop(); }, { passive: true });
  root.addEventListener('touchend', () => { setTimeout(() => { userActive = false; start(); }, 6000); }, { passive: true });
  root.addEventListener('focusin', () => { userActive = true; stop(); });
  root.addEventListener('focusout', () => { userActive = false; start(); });

  // Only run while the section is visible
  new IntersectionObserver(entries => {
    onScreen = entries[0].isIntersecting;
    start();
  }, { threshold: 0.4 }).observe(root);

  window.addEventListener('resize', () => { markCurrent(); start(); });
  reduceMotion.addEventListener('change', start);
  markCurrent();
})();
