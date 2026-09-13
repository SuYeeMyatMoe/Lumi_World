// Dev-only boot for the demo store's scripted seller.
//
// The crx dev plugin rewrites demo/index.html and keeps only modules under /src, so a
// plain <script src="/demo/seller.js"> tag (and any inline script) is silently dropped
// and the seller chat sits there never replying. Injecting the tag at runtime happens
// after the rewrite, so the browser fetches the file normally.
// seller.js guards against being wired twice, so a second load is harmless.
const SELLER_SRC = '/demo/seller.js';

function bootSeller(): void {
  if (!document.getElementById('seller-chat')) return;
  const script = document.createElement('script');
  script.src = SELLER_SRC;
  document.body.appendChild(script);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootSeller, { once: true });
} else {
  bootSeller();
}
