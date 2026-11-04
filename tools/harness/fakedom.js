// Minimal DOM stand-in, enough to run drawings and catch runtime errors (no rendering).
class ClassList { constructor(el) { this.el = el; } _s() { return new Set(String(this.el.className || '').split(/\s+/).filter(Boolean)); } add(...c) { const s = this._s(); c.forEach((x) => s.add(x)); this.el.className = [...s].join(' '); } remove(...c) { const s = this._s(); c.forEach((x) => s.delete(x)); this.el.className = [...s].join(' '); } toggle(c, on) { const s = this._s(); const want = on === undefined ? !s.has(c) : !!on; if (want) s.add(c); else s.delete(c); this.el.className = [...s].join(' '); return want; } contains(c) { return this._s().has(c); } }
class Node {
  constructor(tag) { this.tagName = String(tag || '').toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.className = ''; this._text = ''; this.style = { setProperty() {} }; this.classList = new ClassList(this); this.hidden = false; this.disabled = false; this.value = ''; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  append(...n) { for (const x of n) this.children.push(typeof x === 'string' ? Object.assign(new Node('#text'), { _text: x }) : x); }
  appendChild(n) { this.append(n); return n; }
  replaceChildren(...n) { this.children = []; this._text = ''; this.append(...n.filter((x) => x != null)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs || ('data-' + k) in this.attrs; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  closest() { return null; }
  addEventListener() {}
  getBoundingClientRect() { return { top: 0, left: 0, width: 600, height: 300 }; }
  get clientWidth() { return 600; }
  get options() { return this.children; }
}
global.Node0 = Node;
global.document = {
  createElement: (t) => new Node(t), createElementNS: (ns, t) => new Node(t), createTextNode: (t) => Object.assign(new Node('#text'), { _text: String(t) }),
  createDocumentFragment: () => new Node('#frag'), querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {}, activeElement: null,
};
global.Option = function (text, value) { const n = new Node('option'); n.textContent = text; n.value = value; return n; };
global.window = global; global.location = { hash: '' }; global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.requestAnimationFrame = (f) => f(); global.matchMedia = () => ({ matches: false }); global.innerHeight = 800;
module.exports = { Node };
