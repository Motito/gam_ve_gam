// ── Geometry ──
const offsetFromCenter = 158;
const R = 160;
const cx = 250;
const cy = 250;
const NUM = 5;

// viewBox: generous padding for flower + text
const padding = 220;
const maxExtent = offsetFromCenter + R + padding;
const vbMin = cx - maxExtent;
const vbSize = maxExtent * 2;

const svg = document.getElementById('flower-svg');
svg.setAttribute('viewBox', `${vbMin} ${vbMin} ${vbSize} ${vbSize}`);

// ── Circle centers (offset -36° so petals point at 0,72,144,216,288) ──
const circles = [];
for (let i = 0; i < NUM; i++) {
  const deg = i * 72 - 36 - 90;
  const rad = (deg * Math.PI) / 180;
  circles.push({
    x: cx + offsetFromCenter * Math.cos(rad),
    y: cy + offsetFromCenter * Math.sin(rad),
  });
}

// ── Petal directions ──
const petalAngles = [];
for (let i = 0; i < NUM; i++) {
  petalAngles.push(((i * 72 - 90) * Math.PI) / 180);
}

const petalCirclePairs = [[0,1],[1,2],[2,3],[3,4],[4,0]];

// ── Circle intersection math ──
function circleIntersections(c1, c2, r) {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 2 * r || d < 1e-9) return null;
  const a = d / 2;
  const h = Math.sqrt(r * r - a * a);
  const mx = (c1.x + c2.x) / 2;
  const my = (c1.y + c2.y) / 2;
  const px = -dy / d * h;
  const py = dx / d * h;
  return [
    { x: mx + px, y: my + py },
    { x: mx - px, y: my - py },
  ];
}

function lensPath(c1, c2, r) {
  const pts = circleIntersections(c1, c2, r);
  if (!pts) return '';
  const [p1, p2] = pts;
  function arcSweep(center, from, to) {
    const v1x = from.x - center.x;
    const v1y = from.y - center.y;
    const v2x = to.x - center.x;
    const v2y = to.y - center.y;
    const cross = v1x * v2y - v1y * v2x;
    return cross > 0 ? 1 : 0;
  }
  const s1 = arcSweep(c1, p1, p2);
  const s2 = arcSweep(c2, p2, p1);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${s1} ${p2.x} ${p2.y} A ${r} ${r} 0 0 ${s2} ${p1.x} ${p1.y} Z`;
}

function isInsideCircle(px, py, c, r) {
  const dx = px - c.x;
  const dy = py - c.y;
  return dx * dx + dy * dy <= r * r + 0.01;
}

function tripleOverlapPath(c1, c2, c3, r) {
  const pairs = [[c1,c2],[c2,c3],[c1,c3]];
  const validPoints = [];
  const pointSources = [];
  for (let pi = 0; pi < 3; pi++) {
    const [ca, cb] = pairs[pi];
    const third = [c3, c1, c2][pi];
    const pts = circleIntersections(ca, cb, r);
    if (!pts) continue;
    for (const p of pts) {
      if (isInsideCircle(p.x, p.y, third, r)) {
        validPoints.push(p);
        pointSources.push(pi);
      }
    }
  }
  if (validPoints.length < 3) return '';
  const centX = validPoints.reduce((s, p) => s + p.x, 0) / validPoints.length;
  const centY = validPoints.reduce((s, p) => s + p.y, 0) / validPoints.length;
  const indexed = validPoints.map((p, i) => ({
    ...p,
    angle: Math.atan2(p.y - centY, p.x - centX),
    src: pointSources[i],
  }));
  indexed.sort((a, b) => a.angle - b.angle);
  let d = `M ${indexed[0].x} ${indexed[0].y}`;
  for (let i = 0; i < indexed.length; i++) {
    const curr = indexed[i];
    const next = indexed[(i + 1) % indexed.length];
    const pairA = pairs[curr.src];
    const pairB = pairs[next.src];
    const allCircles = [...pairA, ...pairB];
    let arcCircle = null;
    for (const cc of [c1, c2, c3]) {
      const count = allCircles.filter(c => c === cc).length;
      if (count >= 2) { arcCircle = cc; break; }
    }
    if (!arcCircle) arcCircle = c1;
    const v1x = curr.x - arcCircle.x;
    const v1y = curr.y - arcCircle.y;
    const v2x = next.x - arcCircle.x;
    const v2y = next.y - arcCircle.y;
    const cross = v1x * v2y - v1y * v2x;
    const sweep = cross > 0 ? 1 : 0;
    d += ` A ${r} ${r} 0 0 ${sweep} ${next.x} ${next.y}`;
  }
  d += ' Z';
  return d;
}

// ── Compute petal and overlap paths ──
const petalPaths = [];
for (let i = 0; i < NUM; i++) {
  const [a, b] = petalCirclePairs[i];
  petalPaths.push(lensPath(circles[a], circles[b], R));
}

const darkPaths = [];
const darkPetalIndices = [];
for (let i = 0; i < NUM; i++) {
  const c1 = circles[i];
  const c2 = circles[(i + 1) % NUM];
  const c3 = circles[(i + 2) % NUM];
  darkPaths.push(tripleOverlapPath(c1, c2, c3, R));
  darkPetalIndices.push([i, (i + 1) % NUM]);
}

// ── Compute vein paths ──
function computeVeinPaths(petalIdx) {
  const angle = petalAngles[petalIdx];
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const [a, b] = petalCirclePairs[petalIdx];
  const pts = circleIntersections(circles[a], circles[b], R);
  if (!pts) return [];
  let maxAlong = 0;
  for (let t = 0; t <= 300; t++) {
    const dist = t * 0.7;
    const px = cx + cosA * dist;
    const py = cy + sinA * dist;
    if (isInsideCircle(px, py, circles[a], R) && isInsideCircle(px, py, circles[b], R)) {
      maxAlong = dist;
    }
  }
  const midribEnd = maxAlong * 0.6;
  const paths = [];
  const mx1 = cx + cosA * 3;
  const my1 = cy + sinA * 3;
  const mx2 = cx + cosA * midribEnd;
  const my2 = cy + sinA * midribEnd;
  paths.push(`M ${mx1} ${my1} L ${mx2} ${my2}`);
  const veinAngleBase = 0.50;
  const veinStart = midribEnd * 0.15;
  const veinSpacing = (midribEnd * 0.85 - veinStart) / 3;
  for (let v = 0; v < 3; v++) {
    const veinOrigin = veinStart + v * veinSpacing;
    const maxVeinLen = 38 - v * 5;
    for (let side = -1; side <= 1; side += 2) {
      const points = [];
      for (let t = 0; t <= maxVeinLen; t += 2) {
        const curveAmount = 0.008 * t;
        const effectiveAngle = veinAngleBase + curveAmount;
        const perpDist = t * Math.tan(effectiveAngle);
        if (perpDist < 1.5) continue;
        const alongPos = veinOrigin + t;
        const px = cx + cosA * alongPos + (-sinA) * side * perpDist;
        const py = cy + sinA * alongPos + cosA * side * perpDist;
        if (isInsideCircle(px, py, circles[a], R) && isInsideCircle(px, py, circles[b], R)) {
          points.push({ x: px, y: py });
        }
      }
      if (points.length >= 2) {
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let k = 1; k < points.length; k++) d += ` L ${points[k].x} ${points[k].y}`;
        paths.push(d);
      }
      for (let sv = 0; sv < 2; sv++) {
        const subOriginT = 10 + sv * 14;
        if (subOriginT >= maxVeinLen - 3) continue;
        const subPoints = [];
        for (let st = 0; st <= 12; st += 2) {
          const mainT = subOriginT;
          const mainCurve = 0.008 * mainT;
          const mainAngle = veinAngleBase + mainCurve;
          const mainPerp = mainT * Math.tan(mainAngle);
          const subAngle = 0.9;
          const subPerp = mainPerp + st * Math.tan(subAngle);
          const subAlong = veinOrigin + subOriginT + st;
          const px = cx + cosA * subAlong + (-sinA) * side * subPerp;
          const py = cy + sinA * subAlong + cosA * side * subPerp;
          if (isInsideCircle(px, py, circles[a], R) && isInsideCircle(px, py, circles[b], R)) {
            subPoints.push({ x: px, y: py });
          }
        }
        if (subPoints.length >= 2) {
          let d = `M ${subPoints[0].x} ${subPoints[0].y}`;
          for (let k = 1; k < subPoints.length; k++) d += ` L ${subPoints[k].x} ${subPoints[k].y}`;
          paths.push(d);
        }
      }
    }
  }
  return paths;
}

// ── Find petal tip positions (furthest point from center along petal axis) ──
function getPetalTip(petalIdx) {
  const angle = petalAngles[petalIdx];
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const [a, b] = petalCirclePairs[petalIdx];
  let maxAlong = 0;
  for (let t = 0; t <= 300; t++) {
    const dist = t * 0.7;
    const px = cx + cosA * dist;
    const py = cy + sinA * dist;
    if (isInsideCircle(px, py, circles[a], R) && isInsideCircle(px, py, circles[b], R)) {
      maxAlong = dist;
    }
  }
  return {
    x: cx + cosA * maxAlong,
    y: cy + sinA * maxAlong,
  };
}

// ── Build SVG DOM ──
const NS = 'http://www.w3.org/2000/svg';
const defs = document.createElementNS(NS, 'defs');
svg.appendChild(defs);

// Master group for flower + text (for rotate/scale/fade animation)
const masterGroup = document.createElementNS(NS, 'g');
masterGroup.setAttribute('transform-origin', `${cx} ${cy}`);
svg.appendChild(masterGroup);

// Clip paths for growth animation
const clipCircles = [];
for (let i = 0; i < NUM; i++) {
  const clipPath = document.createElementNS(NS, 'clipPath');
  clipPath.id = `clip-petal-${i}`;
  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy);
  circle.setAttribute('r', 0);
  clipPath.appendChild(circle);
  defs.appendChild(clipPath);
  clipCircles.push(circle);
}

// Petal groups
const petalGroups = [];
for (let i = 0; i < NUM; i++) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('clip-path', `url(#clip-petal-${i})`);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', petalPaths[i]);
  path.setAttribute('fill', '#6bbf59');
  path.setAttribute('stroke', 'none');
  g.appendChild(path);
  const veinPaths = computeVeinPaths(i);
  for (const vd of veinPaths) {
    const vp = document.createElementNS(NS, 'path');
    vp.setAttribute('d', vd);
    vp.setAttribute('fill', 'none');
    vp.setAttribute('stroke', '#5aaa4a');
    vp.setAttribute('stroke-width', '0.8');
    vp.setAttribute('stroke-linecap', 'round');
    g.appendChild(vp);
  }
  masterGroup.appendChild(g);
  petalGroups.push(g);
}

// Dark overlaps
const darkGroups = [];
for (let i = 0; i < NUM; i++) {
  if (!darkPaths[i]) continue;
  const [pA, pB] = darkPetalIndices[i];
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', darkPaths[i]);
  path.setAttribute('fill', '#3a7d44');
  path.setAttribute('stroke', 'none');
  path.style.opacity = '0';
  masterGroup.appendChild(path);
  darkGroups.push({ el: path, petals: [pA, pB] });
}

// Center dot
const centerDot = document.createElementNS(NS, 'circle');
centerDot.setAttribute('cx', cx);
centerDot.setAttribute('cy', cy);
centerDot.setAttribute('r', 2);
centerDot.setAttribute('fill', '#3a7d44');
centerDot.style.opacity = '0';
masterGroup.appendChild(centerDot);

// ── SVG Text elements positioned near petal tips ──
const tip1 = getPetalTip(0); // Petal 1 — top, text to upper-right
const tip3 = getPetalTip(2); // Petal 3 — lower-right, text to bottom-right
const tip4 = getPetalTip(3); // Petal 4 — lower-left, text to bottom-left

// Text positioned outside the flower, near petal tips
// 3 rounds of text, each with 3 snippets
const isMobile = window.innerWidth < 768;
const lineHeight = isMobile ? 40 : 32;
const svgFontSize = isMobile ? 34 : 28;

const textPositions = [
  { x: tip1.x + 220, y: tip1.y - 10 },
  { x: tip3.x + 178, y: tip3.y + 40 },
  { x: tip4.x - 138, y: tip4.y + 40 },
];

const allRounds = [
  // Round 1
  [
    ['גם', 'סוגר עסקאות'],
    ['גם', 'מכיר את עולם', 'התוכן המקצועי'],
    ['וגם', 'אחלה בן אדם', 'שמבין תרבות סטארטאפ'],
  ],
  // Round 2
  [
    ['גם', 'טכנית ויכולה', 'לצלול לפרטים'],
    ['גם', 'חיה ונושמת לקוחות'],
    ['וגם', 'מדברת ישראלית שוטפת'],
  ],
  // Round 3
  [
    ['גם', 'חושב אסטרטגית', 'ומכיר את השוק'],
    ['גם', 'אוהב ללכלך את הידיים', 'וכבר בנה מאפס'],
    ['וגם', 'כיף לשבת איתו לבירה'],
  ],
];

let currentRound = 0;

// Create 3 group elements (one per position); each holds one <text> per line.
// Using separate <text> elements (not <tspan>) avoids the SVG BiDi bug where
// the browser reorders characters across tspan boundaries in RTL paragraphs.
const svgTexts = [];
for (let t = 0; t < 3; t++) {
  const g = document.createElementNS(NS, 'g');
  g.style.opacity = '0';
  g.style.transition = 'opacity 0.6s ease';
  masterGroup.appendChild(g);
  svgTexts.push(g);
}

function setTextContent(roundIndex) {
  const round = allRounds[roundIndex];
  for (let t = 0; t < 3; t++) {
    const g = svgTexts[t];
    while (g.firstChild) g.removeChild(g.firstChild);
    const lines = round[t];
    const pos = textPositions[t];
    for (let i = 0; i < lines.length; i++) {
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('font-family', "'MiriMedium', 'Heebo', sans-serif");
      text.setAttribute('font-size', svgFontSize);
      text.setAttribute('fill', '#3a5a30');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('direction', 'rtl');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y + i * lineHeight);
      if (i === 0) text.setAttribute('font-weight', 'bold');
      text.textContent = lines[i];
      g.appendChild(text);
    }
  }
}

// ── Animation state ──
const petalProgress = [0, 0, 0, 0, 0];

const petalMaxDist = [];
for (let i = 0; i < NUM; i++) {
  const [a, b] = petalCirclePairs[i];
  let maxD = 0;
  const pts = circleIntersections(circles[a], circles[b], R);
  if (pts) {
    for (const p of pts) {
      const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      if (d > maxD) maxD = d;
    }
  }
  const cosA = Math.cos(petalAngles[i]);
  const sinA = Math.sin(petalAngles[i]);
  for (let t = 0; t <= 350; t++) {
    const px = cx + cosA * t;
    const py = cy + sinA * t;
    if (isInsideCircle(px, py, circles[a], R) && isInsideCircle(px, py, circles[b], R)) {
      const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
      if (d > maxD) maxD = d;
    }
  }
  petalMaxDist.push(maxD + 5);
}

function updateVisuals() {
  for (let i = 0; i < NUM; i++) {
    const radius = petalMaxDist[i] * petalProgress[i];
    clipCircles[i].setAttribute('r', radius);
  }
  for (const dg of darkGroups) {
    const [pA, pB] = dg.petals;
    if (petalProgress[pA] > 0.05 && petalProgress[pB] > 0.05) {
      const rA = petalMaxDist[pA] * petalProgress[pA];
      const rB = petalMaxDist[pB] * petalProgress[pB];
      const minR = Math.min(rA, rB);
      dg.el.style.opacity = '1';
      if (!dg.clipId) {
        dg.clipId = `clip-dark-${Math.random().toString(36).substr(2, 6)}`;
        const cp = document.createElementNS(NS, 'clipPath');
        cp.id = dg.clipId;
        const cc = document.createElementNS(NS, 'circle');
        cc.setAttribute('cx', cx);
        cc.setAttribute('cy', cy);
        cp.appendChild(cc);
        defs.appendChild(cp);
        dg.clipCircle = cc;
        dg.el.setAttribute('clip-path', `url(#${dg.clipId})`);
      }
      dg.clipCircle.setAttribute('r', minR);
    } else {
      dg.el.style.opacity = '0';
    }
  }
  const anyVisible = petalProgress.some(p => p > 0);
  centerDot.style.opacity = anyVisible ? '1' : '0';
}

function showText(n) {
  const el = svgTexts[n];
  el.style.transition = 'opacity 0.6s ease'; // re-enable fade-in
  el.getBoundingClientRect();                 // flush style so transition fires
  el.style.opacity = '1';
}

function hideTexts() {
  svgTexts.forEach(t => { t.style.opacity = '0'; });
}

function resetTexts() {
  svgTexts.forEach(t => {
    t.style.transition = 'none'; // snap to 0 instantly — no CSS fade that would flash
    t.style.opacity = '0';
  });
}

const PETAL_DURATION = 2000;
const HOLD_DURATION = 3000;
const ROTATE_DURATION = 1500;
const FADE_DURATION = 800;
const PAUSE_DURATION = 600;

function animatePetal(petalIndex, duration) {
  return new Promise(resolve => {
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      petalProgress[petalIndex] = 1 - Math.pow(1 - progress, 2);
      updateVisuals();
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        petalProgress[petalIndex] = 1;
        updateVisuals();
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

// Exit animation: simple fade out
function animateFadeOut(duration) {
  return new Promise(resolve => {
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      masterGroup.style.opacity = 1 - eased;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

function resetMasterGroup() {
  masterGroup.setAttribute('transform', '');
  // opacity is restored by runAnimation() after visuals are cleared
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAnimation() {
  try {
    // Reset everything
    for (let i = 0; i < NUM; i++) petalProgress[i] = 0;
    resetTexts();
    resetMasterGroup();
    setTextContent(currentRound);
    updateVisuals();             // clip-circles reset to r=0 (all petals hidden)
    masterGroup.style.opacity = '1'; // reveal only after visuals are cleared

    // Grow petals with text
    await animatePetal(0, PETAL_DURATION);
    showText(0);

    await animatePetal(2, PETAL_DURATION);
    showText(1);

    await animatePetal(3, PETAL_DURATION);
    showText(2);

    await Promise.all([
      animatePetal(1, PETAL_DURATION),
      animatePetal(4, PETAL_DURATION),
    ]);

    // Hold full flower for 3 seconds
    await wait(HOLD_DURATION);

    // Exit: fade out the full flower and text together
    await animateFadeOut(FADE_DURATION);

    // Pause before restart
    await wait(PAUSE_DURATION);

    // Advance to next round (cycle through all 3)
    currentRound = (currentRound + 1) % allRounds.length;

    runAnimation();
  } catch (e) {
    setTimeout(runAnimation, 2000);
  }
}

updateVisuals();
runAnimation();

// ── Logo flower (small, static, fully grown, with veins like main flower) ──
(function buildLogoFlower() {
  const logoSvg = document.getElementById('logo-flower-svg');
  const lOff = 158, lR = 160, lCx = 250, lCy = 250;
  const lMaxExtent = lOff + lR + 10;
  const lVbMin = lCx - lMaxExtent;
  const lVbSize = lMaxExtent * 2;
  logoSvg.setAttribute('viewBox', `${lVbMin} ${lVbMin} ${lVbSize} ${lVbSize}`);

  const lCircles = [];
  for (let i = 0; i < 5; i++) {
    const deg = i * 72 - 36 - 90;
    const rad = (deg * Math.PI) / 180;
    lCircles.push({
      x: lCx + lOff * Math.cos(rad),
      y: lCy + lOff * Math.sin(rad),
    });
  }

  const lPairs = [[0,1],[1,2],[2,3],[3,4],[4,0]];
  const lPetalAngles = [];
  for (let i = 0; i < 5; i++) {
    lPetalAngles.push(((i * 72 - 90) * Math.PI) / 180);
  }

  // Compute vein paths for logo flower (reusing same logic as main flower)
  function computeLogoVeinPaths(petalIdx) {
    const angle = lPetalAngles[petalIdx];
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const [a, b] = lPairs[petalIdx];
    const pts = circleIntersections(lCircles[a], lCircles[b], lR);
    if (!pts) return [];
    let maxAlong = 0;
    for (let t = 0; t <= 300; t++) {
      const dist = t * 0.7;
      const px = lCx + cosA * dist;
      const py = lCy + sinA * dist;
      if (isInsideCircle(px, py, lCircles[a], lR) && isInsideCircle(px, py, lCircles[b], lR)) {
        maxAlong = dist;
      }
    }
    const midribEnd = maxAlong * 0.6;
    const paths = [];
    const mx1 = lCx + cosA * 3;
    const my1 = lCy + sinA * 3;
    const mx2 = lCx + cosA * midribEnd;
    const my2 = lCy + sinA * midribEnd;
    paths.push(`M ${mx1} ${my1} L ${mx2} ${my2}`);
    const veinAngleBase = 0.50;
    const veinStart = midribEnd * 0.15;
    const veinSpacing = (midribEnd * 0.85 - veinStart) / 3;
    for (let v = 0; v < 3; v++) {
      const veinOrigin = veinStart + v * veinSpacing;
      const maxVeinLen = 38 - v * 5;
      for (let side = -1; side <= 1; side += 2) {
        const points = [];
        for (let t = 0; t <= maxVeinLen; t += 2) {
          const curveAmount = 0.008 * t;
          const effectiveAngle = veinAngleBase + curveAmount;
          const perpDist = t * Math.tan(effectiveAngle);
          if (perpDist < 1.5) continue;
          const alongPos = veinOrigin + t;
          const px = lCx + cosA * alongPos + (-sinA) * side * perpDist;
          const py = lCy + sinA * alongPos + cosA * side * perpDist;
          if (isInsideCircle(px, py, lCircles[a], lR) && isInsideCircle(px, py, lCircles[b], lR)) {
            points.push({ x: px, y: py });
          }
        }
        if (points.length >= 2) {
          let d = `M ${points[0].x} ${points[0].y}`;
          for (let k = 1; k < points.length; k++) d += ` L ${points[k].x} ${points[k].y}`;
          paths.push(d);
        }
        for (let sv = 0; sv < 2; sv++) {
          const subOriginT = 10 + sv * 14;
          if (subOriginT >= maxVeinLen - 3) continue;
          const subPoints = [];
          for (let st = 0; st <= 12; st += 2) {
            const mainT = subOriginT;
            const mainCurve = 0.008 * mainT;
            const mainAngle = veinAngleBase + mainCurve;
            const mainPerp = mainT * Math.tan(mainAngle);
            const subAngle = 0.9;
            const subPerp = mainPerp + st * Math.tan(subAngle);
            const subAlong = veinOrigin + subOriginT + st;
            const px = lCx + cosA * subAlong + (-sinA) * side * subPerp;
            const py = lCy + sinA * subAlong + cosA * side * subPerp;
            if (isInsideCircle(px, py, lCircles[a], lR) && isInsideCircle(px, py, lCircles[b], lR)) {
              subPoints.push({ x: px, y: py });
            }
          }
          if (subPoints.length >= 2) {
            let d = `M ${subPoints[0].x} ${subPoints[0].y}`;
            for (let k = 1; k < subPoints.length; k++) d += ` L ${subPoints[k].x} ${subPoints[k].y}`;
            paths.push(d);
          }
        }
      }
    }
    return paths;
  }

  // Draw petals with veins
  for (let i = 0; i < 5; i++) {
    const [a, b] = lPairs[i];
    const d = lensPath(lCircles[a], lCircles[b], lR);
    if (!d) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#6bbf59');
    logoSvg.appendChild(path);

    // Add veins
    const veinPaths = computeLogoVeinPaths(i);
    for (const vd of veinPaths) {
      const vp = document.createElementNS(NS, 'path');
      vp.setAttribute('d', vd);
      vp.setAttribute('fill', 'none');
      vp.setAttribute('stroke', '#4a9a3a');
      vp.setAttribute('stroke-width', '1.4');
      vp.setAttribute('stroke-linecap', 'round');
      logoSvg.appendChild(vp);
    }
  }

  // Draw dark overlaps
  for (let i = 0; i < 5; i++) {
    const c1 = lCircles[i];
    const c2 = lCircles[(i + 1) % 5];
    const c3 = lCircles[(i + 2) % 5];
    const d = tripleOverlapPath(c1, c2, c3, lR);
    if (!d) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#3a7d44');
    logoSvg.appendChild(path);
  }

  // Center dot
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', lCx);
  dot.setAttribute('cy', lCy);
  dot.setAttribute('r', 4);
  dot.setAttribute('fill', '#3a7d44');
  logoSvg.appendChild(dot);
})();

// ── Favicon: serialise the rendered logo SVG and set it as the page icon ──
(function setFavicon() {
  const logoEl = document.getElementById('logo-flower-svg');
  const svgData = new XMLSerializer().serializeToString(logoEl);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.getElementById('favicon-link');
  if (link) {
    link.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
})();