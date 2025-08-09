cat > polyfill.js <<'JS'
const { JSDOM } = require('jsdom');
if (typeof global.window === 'undefined') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = { userAgent: 'node.js' };
  global.localStorage = dom.window.localStorage;
}
JS
