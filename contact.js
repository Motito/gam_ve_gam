// Email links: mailto: opens the visitor's mail app. On computers with no mail app set up
// nothing happens, so when the page is still in front a second and a half after the click,
// show the address with a Copy button instead.
(function () {
  const links = document.querySelectorAll('a[href^="mailto:"]');
  if (!links.length) return;

  let toast = null;
  let hideTimer = null;

  function hide() {
    clearTimeout(hideTimer);
    if (toast) { toast.remove(); toast = null; }
  }

  function show(address) {
    hide();
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.textContent = address;

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy email';
    copy.addEventListener('click', () => {
      const done = () => { copy.textContent = 'Copied'; clearTimeout(hideTimer); hideTimer = setTimeout(hide, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(done, () => selectText(text));
      } else {
        selectText(text);
      }
    });

    toast.append(text, copy);
    document.body.appendChild(toast);
    hideTimer = setTimeout(hide, 10000);
  }

  function selectText(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  links.forEach(link => {
    link.addEventListener('click', () => {
      const address = link.getAttribute('href').replace(/^mailto:/, '').split('?')[0];
      let left = false;
      const markLeft = () => { left = true; };
      window.addEventListener('blur', markLeft, { once: true });
      document.addEventListener('visibilitychange', markLeft, { once: true });
      setTimeout(() => {
        window.removeEventListener('blur', markLeft);
        document.removeEventListener('visibilitychange', markLeft);
        if (!left) show(address);
      }, 1500);
    });
  });
})();
