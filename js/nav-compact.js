/* Connect shared navigation: four primary destinations + a compact utilities menu. */
(() => {
  const nav = document.getElementById('navLinks');
  if (!nav || nav.dataset.compactReady === 'true') return;

  const primary = ['index.html', 'discover.html', 'friends.html', 'profile.html'];
  const links = [...nav.querySelectorAll(':scope > a')];
  const hrefOf = (a) => (a.getAttribute('href') || '').split('#')[0].replace(/^\.\//, '');
  links.sort((a, b) => {
    const ai = primary.indexOf(hrefOf(a));
    const bi = primary.indexOf(hrefOf(b));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  links.forEach(a => nav.appendChild(a));

  const extras = links.filter(a => !primary.includes(hrefOf(a)));
  if (extras.length) {
    const menu = document.createElement('div');
    menu.className = 'nav-more';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-more-toggle';
    toggle.textContent = 'Thêm tiện ích';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    const panel = document.createElement('div');
    panel.className = 'nav-more-panel';
    panel.id = 'navMorePanel';
    panel.setAttribute('aria-label', 'Các tiện ích khác');
    toggle.setAttribute('aria-controls', panel.id);
    extras.forEach(a => panel.appendChild(a));
    menu.append(toggle, panel);
    nav.appendChild(menu);

    const close = (focus = false) => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (focus) toggle.focus();
    };
    toggle.addEventListener('click', () => {
      const open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) panel.querySelector('a')?.focus();
    });
    document.addEventListener('click', e => { if (!menu.contains(e.target)) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) close(true);
    });
    panel.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    if (panel.querySelector('[aria-current="page"]')) {
      toggle.classList.add('has-current');
      toggle.setAttribute('aria-label', 'Thêm tiện ích, có trang hiện tại');
    }
  }
  nav.dataset.compactReady = 'true';
})();
