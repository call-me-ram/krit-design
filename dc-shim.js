// Minimal standalone renderer for the design files (x-dc / sc-for / sc-if / {{holes}}),
// so the mockups can be viewed without the Claude canvas.
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
      if (this.__render) this.__render();
    }
    forceUpdate() { if (this.__render) this.__render(); }
  }
  window.DCLogic = DCLogic;

  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const PART = /\{\{\s*([^}]+?)\s*\}\}/g;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  }
  const interp = (str, scope) => str.replace(PART, (_, p) => {
    const v = lookup(p, scope);
    return v == null ? '' : String(v);
  });

  function renderNodes(nodes, scope, out) {
    nodes.forEach((n) => renderNode(n, scope, out));
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const list = lookup((node.getAttribute('list') || '').replace(/[{}]/g, ''), scope) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => {
        renderNodes(Array.from(node.childNodes), Object.assign(Object.create(scope), { [as]: item, $index: i }), out);
      });
      return;
    }
    if (tag === 'sc-if') {
      if (lookup((node.getAttribute('value') || '').replace(/[{}]/g, ''), scope)) renderNodes(Array.from(node.childNodes), scope, out);
      return;
    }
    const ns = node.namespaceURI;
    const el = ns && ns !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(ns, node.tagName) : document.createElement(node.tagName);
    Array.from(node.attributes).forEach((a) => {
      if (a.name.startsWith('hint-')) return;
      const whole = a.value.match(WHOLE);
      if (/^on[a-z]+$/i.test(a.name) && whole) {
        const fn = lookup(whole[1], scope);
        if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn);
        return;
      }
      let v = whole ? lookup(whole[1], scope) : interp(a.value, scope);
      if (a.name === 'href' && typeof v === 'string') v = v.replace(/\.dc\.html(?=$|#)/, '.html');
      if (v === false || v == null) return;
      if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, a.name, String(v));
      else el.setAttribute(a.name, String(v));
    });
    // <template>-less clone of children
    renderNodes(Array.from(node.childNodes), scope, el);
    out.appendChild(el);
  }

  function boot() {
    const host = document.querySelector('x-dc');
    const script = document.querySelector('script[data-dc-script]');
    if (!host || !script) return;

    // Move <helmet> contents (fonts, styles) into <head>.
    const helmet = host.querySelector('helmet');
    if (helmet) { Array.from(helmet.children).forEach((c) => document.head.appendChild(c)); helmet.remove(); }

    const template = Array.from(host.childNodes);
    template.forEach((n) => n.remove());

    let props = {};
    try {
      const decl = JSON.parse(script.getAttribute('data-props') || '{}');
      Object.keys(decl).forEach((k) => { if (k[0] !== '$' && 'default' in decl[k]) props[k] = decl[k].default; });
    } catch (e) { /* ignore */ }

    const Component = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
    const inst = new Component(props);
    const render = () => {
      const frag = document.createDocumentFragment();
      renderNodes(template, inst.renderVals() || {}, frag);
      host.replaceChildren(frag);
      fit();
    };
    inst.__render = render;
    render();
    if (inst.componentDidMount) inst.componentDidMount();
  }

  // Scale the fixed-width artboard down to fit narrower screens.
  function fit() {
    const root = document.querySelector('x-dc > *');
    if (!root) return;
    const w = root.offsetWidth;
    const scale = Math.min(1, window.innerWidth / w);
    document.body.style.zoom = scale < 1 ? String(scale) : '';
  }
  window.addEventListener('resize', fit);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
