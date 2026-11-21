// Vice Cover Maker — editor wiring: photo slots, drag to position,
// zoom, caption, grade and export sizes. The preview canvas redraws
// on every change; Export writes a PNG at the chosen post size.

import { drawCover, panelRects, GRADES } from './cover.js';

const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

const canvas = document.getElementById('cover');
const preview = document.getElementById('preview');
const captionInput = document.getElementById('caption');
const subInput = document.getElementById('subcaption');
const gradeSelect = document.getElementById('grade');
const sizeSelect = document.getElementById('size');
const zoomInput = document.getElementById('zoom');
const status = document.getElementById('status');
const exportBtn = document.getElementById('export');

// Three panels; each holds a photo plus its position and zoom.
const panels = [
  { photo: null, x: 0, y: 0, zoom: 1 },
  { photo: null, x: 0, y: 0, zoom: 1 },
  { photo: null, x: 0, y: 0, zoom: 1 },
];
let active = 0;
let dragging = null;

const sampleUrls = ['./samples/boulevard.jpg', './samples/pier.jpg', './samples/neon.jpg'];

// Load the three bundled sample photos into the panels so the editor
// opens with a finished-looking cover.
async function loadSamples() {
  for (let i = 0; i < sampleUrls.length; i++) {
    const img = new Image();
    img.src = sampleUrls[i];
    await img.decode().catch(() => null);
    if (img.complete && img.naturalWidth) panels[i].photo = img;
  }
  redraw();
}

function redraw() {
  const size = SIZES[sizeSelect.value];
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, panels, captionInput.value, subInput.value, gradeSelect.value);
  // Scale the big canvas down into the preview element.
  const pctx = preview.getContext('2d');
  preview.width = Math.min(540, size.w / 2);
  preview.height = Math.round(preview.width * size.h / size.w);
  pctx.drawImage(canvas, 0, 0, preview.width, preview.height);
  zoomInput.value = panels[active].zoom;
  document.querySelectorAll('.slot').forEach((el, i) => {
    el.classList.toggle('active', i === active);
  });
}

// Photo upload: the file goes into the active panel.
document.getElementById('photo').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    panels[active].photo = img;
    panels[active].x = 0;
    panels[active].y = 0;
    panels[active].zoom = 1;
    redraw();
    status.textContent = `Photo loaded into panel ${active + 1}.`;
  };
  img.src = url;
});

// Pick a panel by clicking its slot button or the preview.
document.querySelectorAll('.slot').forEach((el, i) => {
  el.addEventListener('click', () => { active = i; redraw(); });
});
preview.addEventListener('pointerdown', (e) => {
  const rect = preview.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width * canvas.width;
  const py = (e.clientY - rect.top) / rect.height * canvas.height;
  const rects = panelRects(canvas.width, canvas.height);
  const hit = rects.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
  if (hit >= 0) {
    active = hit;
    dragging = { x: px, y: py, ox: panels[hit].x, oy: panels[hit].y };
    preview.setPointerCapture(e.pointerId);
    redraw();
  }
});
preview.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = preview.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width * canvas.width;
  const py = (e.clientY - rect.top) / rect.height * canvas.height;
  const rects = panelRects(canvas.width, canvas.height);
  const r = rects[active];
  panels[active].x = clamp(dragging.ox + (px - dragging.x) / (r.w * 0.4), -1, 1);
  panels[active].y = clamp(dragging.oy + (py - dragging.y) / (r.h * 0.4), -1, 1);
  redraw();
});
preview.addEventListener('pointerup', () => { dragging = null; });

zoomInput.addEventListener('input', () => {
  panels[active].zoom = parseFloat(zoomInput.value);
  redraw();
});
captionInput.addEventListener('input', redraw);
subInput.addEventListener('input', redraw);
gradeSelect.addEventListener('change', redraw);
sizeSelect.addEventListener('change', redraw);

exportBtn.addEventListener('click', () => {
  const size = SIZES[sizeSelect.value];
  redraw();
  const a = document.createElement('a');
  a.download = `vice-cover-${size.w}x${size.h}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  status.textContent = `Exported ${size.label} PNG.`;
});

// Fill the grade selector from the grades in cover.js.
Object.keys(GRADES).forEach((name) => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name[0].toUpperCase() + name.slice(1);
  gradeSelect.appendChild(opt);
});

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Test hook for screenshots: load a photo into a panel by URL.
window.__cover = {
  loadPhoto: async (index, url) => {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => null);
    if (img.complete && img.naturalWidth) {
      panels[index].photo = img;
      redraw();
      return true;
    }
    return false;
  },
  setCaption: (text) => { captionInput.value = text; redraw(); },
  setGrade: (name) => { gradeSelect.value = name; redraw(); },
  setSize: (name) => { sizeSelect.value = name; redraw(); },
};

loadSamples();
