// Scripted seller — deterministic on purpose, so a 2-minute take always runs the same way.
// Policy: floor RM3,950. Counter once at RM4,150, then RM3,950 final, accept anything at or above the floor.
(function () {
  var FLOOR = 3950;
  var COUNTERS = ['RM4,150 is the lowest I can do.', 'RM3,950, final.'];
  var counterIndex = 0;
  var settled = false;
  var agreedPrice = null;

  var list = document.getElementById('seller-messages');
  var box = document.getElementById('offer-message');
  var send = document.getElementById('seller-send');

  function money(n) {
    return 'RM' + n.toLocaleString('en-US');
  }

  function parseOffer(text) {
    var m = text.match(/(?:RM|MYR)\s?([\d,]+(?:\.\d+)?)/i);
    if (!m) m = text.match(/\b(\d[\d,]{2,})(?:\.\d+)?\b/);
    if (!m) return null;
    var n = Number(m[1].replace(/,/g, ''));
    return isFinite(n) && n > 0 ? n : null;
  }

  function append(role, who, text) {
    var li = document.createElement('li');
    li.className = 'msg ' + role;
    var tag = document.createElement('span');
    tag.className = 'who';
    tag.textContent = who;
    li.appendChild(tag);
    li.appendChild(document.createTextNode(text));
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
  }

  function reply(text) {
    append('seller', 'Seller', text);
  }

  function handle() {
    var text = (box.value || '').trim();
    if (!text) return;
    append('buyer', 'You', text);
    box.value = '';
    box.dispatchEvent(new Event('input', { bubbles: true }));

    if (settled) {
      reply('Already agreed at ' + money(agreedPrice) + ' — see you at checkout.');
      return;
    }

    var offer = parseOffer(text);
    if (offer !== null && offer >= FLOOR) {
      settled = true;
      agreedPrice = offer;
      reply('Deal at ' + money(offer) + '. I will hold it for you — complete the purchase request below.');
      return;
    }

    reply(COUNTERS[Math.min(counterIndex, COUNTERS.length - 1)]);
    if (counterIndex < COUNTERS.length - 1) counterIndex += 1;
  }

  send.addEventListener('click', handle);

  // Purchase request: confirm in the page. A browser alert() would freeze the extension.
  var form = document.getElementById('purchase-form');
  var confirmation = document.getElementById('order-confirmation');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var model = (data.get('laptopModel') || '').toString().trim() || 'ASUS TUF Gaming A15';
    var budget = (data.get('budget') || '').toString().trim();
    var price = parseOffer(budget) || agreedPrice;
    confirmation.querySelector('strong').textContent =
      'Order #4471 placed — ' + model + (price ? ', ' + money(price) : '');
    confirmation.hidden = false;
    confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
