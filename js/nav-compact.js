/* Connect compact navigation: keep the four core destinations visible and group the rest. */
(() => {
  const nav = document.getElementById('navLinks');
  if (!nav || nav.dataset.compactReady === 'true') return;
  const priority = ['index.html', 'discover.html', 'friends.html', 'profile.html'];
  const links = [...nav.querySelectorAll(':scope > a')];
  if (links.length <= 4) return;
  const rank = (a) => {
    const href = (a.getAttribute('href') || '').split('#')[0].replace(/^\.\//, '');
    const i = priority.indexOf(href);
    return i < 0 ? 100 : i;
  };
  links.sort((a, b) => rank(a) - rank(b));
  links.forEach(a => nav.appendChild(a));
  const extras = links.slice(4);
  if (!extras.length) return;
  const menu = document.createElement('div');
  menu.className = 'nav-more';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-more-toggle';
  toggle.textContent = 'Thêm';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-haspopup', 'true');
  const panel = document.createElement('div');
  panel.className = 'nav-more-panel';
  panel.setAttribute('aria-label', 'Các trang khác');
  extras.forEach(a => panel.appendChild(a));
  menu.append(toggle, panel);
  nav.appendChild(menu);
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
  nav.dataset.compactReady = 'true';
})();
