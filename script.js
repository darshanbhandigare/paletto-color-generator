//State
let currentPalette = [];
let currentMode = 'complementary';
let colorCount = 5;
let currentView = 'strip';
let currentExportTab = 'css';
let savedPalettes = JSON.parse(localStorage.getItem('paletto_saved') || '[]');

//Color Math

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function textColor(bg) {
  return luminance(bg) > 0.35 ? '#111115' : '#f0f0f8';
}

//Harmony Generators

function generatePalette(hex, mode, count) {
  const [h, s, l] = hexToHsl(hex);
  let hues = [];

  switch (mode) {
    case 'complementary':   hues = [h, (h + 180) % 360]; break;
    case 'analogous':       hues = [h, (h + 30) % 360, (h + 60) % 360, (h - 30 + 360) % 360, (h - 60 + 360) % 360]; break;
    case 'triadic':         hues = [h, (h + 120) % 360, (h + 240) % 360]; break;
    case 'split':           hues = [h, (h + 150) % 360, (h + 210) % 360]; break;
    case 'tetradic':        hues = [h, (h + 90) % 360, (h + 180) % 360, (h + 270) % 360]; break;
    case 'monochromatic':   hues = [h, h, h, h, h]; break;
  }

  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = hues[i % hues.length];
    let sat = s, lit = l;
    if (mode === 'monochromatic') {
      const step = 60 / (count - 1 || 1);
      lit = Math.max(15, Math.min(85, 20 + i * step));
      sat = Math.max(20, s - i * 5);
    } else {
      lit = Math.max(20, Math.min(80, l + (i % 2 === 0 ? 0 : i % 3 === 0 ? -15 : 10)));
      sat = Math.max(15, Math.min(90, s + (i % 2 === 0 ? 0 : -8)));
    }
    colors.push(hslToHex(hue, sat, lit));
  }
  return colors;
}

function generateTints(hex) {
  const [h, s] = hexToHsl(hex);
  const steps = [95, 85, 70, 55, 40, 30, 20, 10];
  return steps.map(l => hslToHex(h, s, l));
}

//Color Naming

const colorNames = {
  red: [0, 15], orange: [15, 45], yellow: [45, 70], lime: [70, 90],
  green: [90, 150], teal: [150, 195], cyan: [195, 215], blue: [215, 255],
  indigo: [255, 280], violet: [280, 320], pink: [320, 345], rose: [345, 360]
};

function getColorName(hex) {
  const [h, s, l] = hexToHsl(hex);
  if (s < 10) return l > 70 ? 'white' : l < 30 ? 'black' : 'gray';
  for (const [name, [lo, hi]] of Object.entries(colorNames)) {
    if (h >= lo && h < hi) return name;
  }
  return 'color';
}

function modeName(mode) {
  const map = {
    complementary: 'Complement', analogous: 'Analogous', triadic: 'Triadic',
    split: 'Split-comp', tetradic: 'Tetradic', monochromatic: 'Mono'
  };
  return map[mode] || mode;
}

//Render

function generate() {
  const hex = document.getElementById('hexInput').value;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { showToast('Invalid hex color'); return; }
  currentPalette = generatePalette(hex, currentMode, colorCount);
  renderAll();
}

function renderAll() {
  renderStrip();
  renderCards();
  renderTints();
  renderExport();
  document.getElementById('paletteName').textContent = modeName(currentMode) + ' · ' + colorCount + ' colors';
}

function renderStrip() {
  const container = document.getElementById('stripView');
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'palette-row';
  currentPalette.forEach(hex => {
    const strip = document.createElement('div');
    strip.className = 'color-strip';
    strip.style.background = hex;
    strip.innerHTML = `
      <div class="copy-flash" id="cf_${hex.slice(1)}"></div>
      <div class="strip-info">
        <div class="strip-hex" style="color:${textColor(hex)}">${hex.toUpperCase()}</div>
      </div>`;
    strip.onclick = () => copyColor(hex);
    row.appendChild(strip);
  });
  container.appendChild(row);
}

function renderCards() {
  const container = document.getElementById('cardView');
  container.innerHTML = '';
  currentPalette.forEach((hex, i) => {
    const [h, s, l] = hexToHsl(hex);
    const [r, g, b] = hexToRgb(hex);
    const card = document.createElement('div');
    card.className = 'color-card';
    card.style.animationDelay = i * 0.06 + 's';
    card.innerHTML = `
      <div class="card-swatch" style="background:${hex}"></div>
      <div class="card-body">
        <div class="card-hex">${hex.toUpperCase()}</div>
        <div class="card-name">${getColorName(hex)}</div>
        <div class="card-vals">
          <div class="card-val">rgb(${r}, ${g}, ${b})</div>
          <div class="card-val">hsl(${h}, ${s}%, ${l}%)</div>
        </div>
      </div>`;
    card.onclick = () => copyColor(hex);
    container.appendChild(card);
  });
}

function renderTints() {
  const container = document.getElementById('tintsStrips');
  container.innerHTML = '';
  document.getElementById('tintsLabel').textContent = `${colorCount} × 8 tints`;
  currentPalette.forEach(hex => {
    const tints = generateTints(hex);
    const strip = document.createElement('div');
    strip.className = 'tints-strip';
    tints.forEach(t => {
      const cell = document.createElement('div');
      cell.className = 'tint-cell';
      cell.style.background = t;
      cell.innerHTML = `<div class="tint-label" style="color:${textColor(t)}">${t.toUpperCase()}</div>`;
      cell.onclick = () => copyColor(t);
      strip.appendChild(cell);
    });
    container.appendChild(strip);
    const spacer = document.createElement('div');
    spacer.style.height = '6px';
    container.appendChild(spacer);
  });
}

function renderExport() {
  const colors = currentPalette;
  let code = '';
  switch (currentExportTab) {
    case 'css':
      code = ':root {\n' + colors.map((c, i) => `  --color-${i + 1}: ${c.toUpperCase()};`).join('\n') + '\n}';
      break;
    case 'hex':
      code = 'const palette = [\n' + colors.map(c => `  "${c.toUpperCase()}"`).join(',\n') + '\n];';
      break;
    case 'tailwind':
      code = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n${colors.map((c, i) => `          ${(i + 1) * 100}: "${c.toUpperCase()}"`).join(',\n')}\n        }\n      }\n    }\n  }\n}`;
      break;
    case 'scss':
      code = colors.map((c, i) => `$color-${i + 1}: ${c.toUpperCase()};`).join('\n') +
        '\n\n$palette: (' + colors.map((c, i) => `\n  "color-${i + 1}": ${c.toUpperCase()}`).join(',') + '\n);';
      break;
  }
  document.getElementById('exportCode').textContent = code;
}

function renderSaved() {
  const grid = document.getElementById('savedGrid');
  if (!savedPalettes.length) {
    grid.innerHTML = '<div class="empty-saved">No saved palettes yet.</div>';
    return;
  }
  grid.innerHTML = '';
  savedPalettes.forEach(p => {
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <div class="saved-strip">${p.colors.map(c => `<div class="saved-seg" style="background:${c}"></div>`).join('')}</div>
      <div class="saved-label">${modeName(p.mode)} · ${p.colors.length}</div>`;
    item.onclick = () => {
      currentPalette = p.colors;
      currentMode = p.mode;
      renderAll();
      showToast('Palette loaded');
    };
    grid.appendChild(item);
  });
}

//UI Actions

function setMode(el) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentMode = el.dataset.mode;
  generate();
}

function changeCount(d) {
  colorCount = Math.min(10, Math.max(2, colorCount + d));
  document.getElementById('countVal').textContent = colorCount;
  generate();
}

function setView(v) {
  currentView = v;
  document.getElementById('stripView').style.display = v === 'strip' ? 'block' : 'none';
  document.getElementById('cardView').style.display = v === 'card' ? 'grid' : 'none';
  document.getElementById('viewStrip').classList.toggle('active', v === 'strip');
  document.getElementById('viewCard').classList.toggle('active', v === 'card');
}

function setExportTab(el, tab) {
  document.querySelectorAll('.export-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentExportTab = tab;
  renderExport();
}

function copyColor(hex) {
  navigator.clipboard.writeText(hex.toUpperCase()).catch(() => {});
  showToast(`Copied ${hex.toUpperCase()}`);
  const el = document.getElementById('cf_' + hex.slice(1));
  if (el) {
    el.textContent = 'Copied!';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 600);
  }
}

function copyCode() {
  const code = document.getElementById('exportCode').textContent;
  navigator.clipboard.writeText(code).catch(() => {});
  showToast('Code copied to clipboard');
}

function savePalette() {
  if (!currentPalette.length) { showToast('Generate a palette first'); return; }
  const entry = { colors: [...currentPalette], mode: currentMode, ts: Date.now() };
  savedPalettes.unshift(entry);
  if (savedPalettes.length > 20) savedPalettes.pop();
  localStorage.setItem('paletto_saved', JSON.stringify(savedPalettes));
  renderSaved();
  showToast('Palette saved!');
}

function clearSaved() {
  savedPalettes = [];
  localStorage.setItem('paletto_saved', '[]');
  renderSaved();
  showToast('Saved palettes cleared');
}

function randomBase() {
  const h = Math.floor(Math.random() * 360);
  const s = 50 + Math.floor(Math.random() * 40);
  const l = 35 + Math.floor(Math.random() * 30);
  const hex = hslToHex(h, s, l);
  document.getElementById('colorPicker').value = hex;
  document.getElementById('hexInput').value = hex.toUpperCase();
  document.getElementById('colorSwatch').style.background = hex;
  generate();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

//Event Listeners

document.getElementById('colorPicker').addEventListener('input', e => {
  const hex = e.target.value;
  document.getElementById('colorSwatch').style.background = hex;
  document.getElementById('hexInput').value = hex.toUpperCase();
  generate();
});

document.getElementById('hexInput').addEventListener('input', e => {
  let v = e.target.value;
  if (!v.startsWith('#')) v = '#' + v;
  e.target.value = v.toUpperCase();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    document.getElementById('colorPicker').value = v;
    document.getElementById('colorSwatch').style.background = v;
    generate();
  }
});

//Init
document.getElementById('colorSwatch').style.background = '#6c63ff';
renderSaved();
generate();
