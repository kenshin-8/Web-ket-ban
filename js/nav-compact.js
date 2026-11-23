/* Connect shared navigation: clear primary destinations + grouped cosmic utilities. */
(() => {
  const nav = document.getElementById('navLinks');
  if (!nav || nav.dataset.compactReady === 'true') return;

  const primary = ['index.html', 'discover.html', 'friends.html'];
  const accountDestination = 'profile.html';
  const groups = [
    { title: 'KẾT NỐI', links: ['match.html', 'voice.html'] },
    { title: 'KHÁM PHÁ & GIẢI TRÍ', links: ['square.html', 'avatar.html', 'icebreaker.html', 'quiz.html'] }
  ];
  const hrefOf = (a) => (a.getAttribute('href') || '').split('#')[0].replace(/^\.\//, '');
  const links = [...nav.querySelectorAll(':scope > a')];

  // Keep three primary destinations in a predictable order.
  // Profile is intentionally accessed from the account menu to avoid duplicate navigation.
  links.filter(a => hrefOf(a) === accountDestination).forEach(a => a.remove());
  links.sort((a, b) => {
    const ai = primary.indexOf(hrefOf(a));
    const bi = primary.indexOf(hrefOf(b));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  links.filter(a => primary.includes(hrefOf(a))).forEach(a => nav.appendChild(a));

  const extras = links.filter(a => !primary.includes(hrefOf(a)) && hrefOf(a) !== accountDestination);
  if (extras.length) {
    const menu = document.createElement('div');
    menu.className = 'nav-more';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-more-toggle';
    toggle.innerHTML = '<span class="nav-more-icon" aria-hidden="true">⠿</span><span>Tiện ích</span><span class="nav-more-chevron" aria-hidden="true">⌄</span>';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');

    const panel = document.createElement('div');
    panel.className = 'nav-more-panel';
    panel.id = `navMorePanel-${Math.random().toString(36).slice(2, 8)}`;
    panel.setAttribute('aria-label', 'Các tiện ích Connect');
    toggle.setAttribute('aria-controls', panel.id);

    groups.forEach(group => {
      const groupLinks = extras.filter(a => group.links.includes(hrefOf(a)));
      if (!groupLinks.length) return;
      const section = document.createElement('section');
      section.className = 'nav-more-group';
      const heading = document.createElement('h3');
      heading.className = 'nav-more-heading';
      heading.textContent = group.title;
      section.appendChild(heading);
      groupLinks.forEach(a => {
        a.classList.add('nav-utility-link');
        section.appendChild(a);
      });
      panel.appendChild(section);
    });

    // Preserve any future utility links even if they are not in a named group yet.
    const grouped = new Set(groups.flatMap(group => group.links));
    const ungrouped = extras.filter(a => !grouped.has(hrefOf(a)));
    if (ungrouped.length) {
      const section = document.createElement('section');
      section.className = 'nav-more-group';
      const heading = document.createElement('h3');
      heading.className = 'nav-more-heading';
      heading.textContent = 'TIỆN ÍCH KHÁC';
      section.appendChild(heading);
      ungrouped.forEach(a => section.appendChild(a));
      panel.appendChild(section);
    }

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
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) close(true); });
    panel.addEventListener('click', e => { if (e.target.closest('a')) close(); });

    if (panel.querySelector('[aria-current="page"]')) {
      toggle.classList.add('has-current');
      toggle.setAttribute('aria-label', 'Tiện ích, có trang hiện tại');
    }
  }
  nav.dataset.compactReady = 'true';
})();
