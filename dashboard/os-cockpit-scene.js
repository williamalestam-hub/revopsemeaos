// PLACEHOLDER. The real scene is being chosen from three candidates and will replace this file.
// It only has the right shape (window.OSCockpit.create) so the page builds meanwhile. Do not edit or review it.
(function (root) {
  const create = (canvas, opts) => {
    const g = canvas.getContext('2d'); let crew = [], W = 480, H = 160, s = 1, cssW = 480, raf = 0, pos = {};
    const place = () => { crew.forEach((a, i) => { const tx = a.state === 'needs' ? 40 + i * 22 : 200 + i * 50, ty = a.state === 'needs' ? 120 : 80; pos[a.id] = pos[a.id] || { x: 200 + i * 50, y: 80 }; pos[a.id].tx = tx; pos[a.id].ty = ty; }); };
    const api = {
      setCrew(c) { crew = Array.isArray(c) ? c.slice() : []; place(); }, setFocus() {},
      resize(w) { cssW = w; W = w < 720 ? 240 : 480; H = w < 720 ? 176 : 160; s = w / W; const d = window.devicePixelRatio || 1; canvas.width = Math.round(w * d); canvas.height = Math.round(H * s * d); canvas.style.width = w + 'px'; canvas.style.height = H * s + 'px'; return H * s; },
      frame(t) { const d = window.devicePixelRatio || 1; g.setTransform(s * d, 0, 0, s * d, 0, 0); g.fillStyle = '#2b3a4a'; g.fillRect(0, 0, W, H); g.fillStyle = '#c9a26b'; g.fillRect(0, 50, W, H - 50);
        crew.forEach((a) => { const p = pos[a.id]; p.x += Math.sign(p.tx - p.x) * Math.min(2, Math.abs(p.tx - p.x)); p.y += Math.sign(p.ty - p.y) * Math.min(2, Math.abs(p.ty - p.y)); g.fillStyle = a.state === 'unknown' ? '#555' : '#e5557a'; g.fillRect(p.x - 5, p.y - 14, 10, 14); g.fillStyle = '#fff'; g.font = '6px monospace'; g.fillText(a.name + (a.waiting ? ' ' + a.waiting : ''), p.x - 8, p.y - 17); });
        const c = new Date(opts.now()); g.fillStyle = '#fff'; g.fillText(String(c.getHours()).padStart(2, '0') + ':' + String(c.getMinutes()).padStart(2, '0') + ' t=' + Math.round(t), 4, 10); },
      start() { const loop = (t) => { api.frame(t); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }, stop() { cancelAnimationFrame(raf); }, destroy() { cancelAnimationFrame(raf); },
      hit(x, y) { for (const a of crew) { const p = pos[a.id]; if (p && Math.abs(x / s - p.x) < 8 && Math.abs(y / s - (p.y - 7)) < 10) return a.id; } return null; },
      anchor(id) { const p = pos[id]; return p ? { x: p.x * s, y: (p.y - 7) * s } : null; },
    };
    return api;
  };
  root.OSCockpit = { create };
})(window);
