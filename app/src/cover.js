// Vice Cover Maker — draws a GTA-style multi-panel poster cover.
//
// The poster is three photo panels (one big hero, two small) over a
// sunset or neon colour grade, with a bold caption in huge capitals
// along the foot and a smaller sub-caption under it. The same layout
// adapts to the three post sizes: 1080 x 1080, 1080 x 1350 and
// 1920 x 1080. Every photo is drawn cover-fit inside its panel, so a
// portrait, landscape or square photo all fill without letterboxing.
//
// A panel is { photo, x, y, zoom }: photo is an HTMLImageElement (or
// null for an empty panel), x/y is the photo's centre offset inside
// the panel as a fraction of the panel (0 = centred), zoom scales
// the cover-fit size. `grade` is one of 'sunset', 'neon', 'noir'.

export const GRADES = {
  sunset: {
    sky: ['#ff9a3d', '#ff5e7a', '#c33d8f'],
    tint: 'rgba(255, 90, 120, 0.28)',
    caption: '#ffffff',
    accent: '#ffd23d',
  },
  neon: {
    sky: ['#2de2ff', '#7b5cff', '#ff2d95'],
    tint: 'rgba(60, 40, 255, 0.30)',
    caption: '#ffffff',
    accent: '#2de2ff',
  },
  noir: {
    sky: ['#e8e8e8', '#9a9a9a', '#2b2b2b'],
    tint: 'rgba(0, 0, 0, 0.25)',
    caption: '#ffffff',
    accent: '#ffd23d',
  },
};

/** Panel rectangles for a canvas of width w and height h. */
export function panelRects(w, h) {
  const gap = Math.round(w * 0.012);
  const captionH = Math.round(h * 0.22);
  const bodyH = h - captionH;
  if (w >= h) {
    // Landscape: three panels side by side.
    const pw = (w - gap * 4) / 3;
    const ph = bodyH - gap * 2;
    return [
      { x: gap, y: gap, w: pw, h: ph },
      { x: gap * 2 + pw, y: gap, w: pw, h: ph },
      { x: gap * 3 + pw * 2, y: gap, w: pw, h: ph },
    ];
  }
  // Square / portrait: hero on top, two small panels under it.
  const heroH = Math.round(bodyH * 0.62);
  const smallH = bodyH - heroH - gap * 3;
  const smallW = (w - gap * 3) / 2;
  return [
    { x: gap, y: gap, w: w - gap * 2, h: heroH },
    { x: gap, y: gap * 2 + heroH, w: smallW, h: smallH },
    { x: gap * 2 + smallW, y: gap * 2 + heroH, w: smallW, h: smallH },
  ];
}

/** Draws the whole cover onto `canvas`. */
export function drawCover(canvas, panels, caption, subCaption, gradeName) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[gradeName] || GRADES.sunset;

  // Backdrop: vertical sunset sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, grade.sky[0]);
  sky.addColorStop(0.55, grade.sky[1]);
  sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Panels.
  const rects = panelRects(w, h);
  rects.forEach((r, i) => {
    const p = panels[i];
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.round(w * 0.015));
    ctx.clip();
    if (p && p.photo) {
      drawPhotoCover(ctx, p.photo, r, p.x || 0, p.y || 0, p.zoom || 1);
    } else {
      ctx.fillStyle = 'rgba(20, 10, 30, 0.55)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = `bold ${Math.round(r.h * 0.09)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD PHOTO', r.x + r.w / 2, r.y + r.h / 2);
    }
    // Grade tint over the photo.
    ctx.fillStyle = grade.tint;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Halftone dots fading down from the top of the panel.
    halftone(ctx, r, w);
    ctx.restore();
    // Panel border.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, Math.round(w * 0.004));
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.round(w * 0.015));
    ctx.stroke();
  });

  // Caption band.
  const captionH = Math.round(h * 0.22);
  const bandY = h - captionH;
  ctx.fillStyle = 'rgba(12, 6, 24, 0.88)';
  ctx.fillRect(0, bandY, w, captionH);
  const text = (caption || '').trim().toUpperCase();
  if (text) {
    let size = Math.round(captionH * 0.52);
    ctx.font = `900 ${size}px 'Arial Black', sans-serif`;
    while (ctx.measureText(text).width > w * 0.92 && size > 16) {
      size -= 2;
      ctx.font = `900 ${size}px 'Arial Black', sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Outline then fill: the GTA poster look.
    ctx.lineWidth = Math.max(3, Math.round(size * 0.12));
    ctx.strokeStyle = '#111';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, w / 2, bandY + captionH * 0.42);
    ctx.fillStyle = grade.caption;
    ctx.fillText(text, w / 2, bandY + captionH * 0.42);
    // Accent rule under the caption.
    ctx.fillStyle = grade.accent;
    const ruleW = Math.min(w * 0.4, ctx.measureText(text).width * 0.6);
    ctx.fillRect((w - ruleW) / 2, bandY + captionH * 0.78, ruleW, Math.max(3, Math.round(h * 0.004)));
  }
  const sub = (subCaption || '').trim();
  if (sub) {
    ctx.font = `bold ${Math.round(captionH * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(sub.toUpperCase(), w / 2, bandY + captionH * 0.92);
  }
}

/** Draws `photo` cover-fit into `rect`, shifted by (fx, fy) fractions. */
function drawPhotoCover(ctx, photo, rect, fx, fy, zoom) {
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const pw = iw * scale;
  const ph = ih * scale;
  const cx = rect.x + rect.w / 2 + fx * rect.w * 0.4;
  const cy = rect.y + rect.h / 2 + fy * rect.h * 0.4;
  ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
}

/** Halftone dots in the top third of a panel, fading out downward. */
function halftone(ctx, rect, w) {
  const step = Math.max(8, Math.round(w * 0.012));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  for (let y = rect.y + step; y < rect.y + rect.h * 0.4; y += step) {
    const fade = 1 - (y - rect.y) / (rect.h * 0.4);
    for (let x = rect.x + step; x < rect.x + rect.w; x += step) {
      const r = step * 0.16 * fade;
      if (r < 0.5) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
