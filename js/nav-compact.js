/* Connect shared navigation: home + Soul Match + three compact areas.
   Existing HTML routes and feature scripts stay intact; this only reorganizes navigation. */
(() => {
  const nav = document.getElementById('navLinks');
  if (!nav || nav.dataset.compactReady === 'true') return;

  const primary = ['index.html', 'match.html'];
  const groups = [
    { title: 'KẾT NỐI', label: 'Kết nối', links: ['discover.html', 'friends.html'] },
    { title: 'CỘNG ĐỒNG', label: 'Cộng đồng', links: ['square.html', 'voice.html'] },
    { title: 'GIẢI TRÍ & KHÁM PHÁ', label: 'Giải trí', links: ['icebreaker.html', 'quiz.html'] }
  ];
  const hrefOf = (a) => (a.getAttribute('href') || '').split('#')[0].replace(/^\.\//, '');
  const allLinks = [...nav.querySelectorAll(':scope > a')];
  // Hồ sơ và Avatar đã nằm trong menu tài khoản / trang Hồ sơ, không lặp ở menu chính.
  allLinks.filter(a => ['profile.html', 'avatar.html'].includes((a.getAttribute('href') || '').split('#')[0].replace(/^\.\//, ''))).forEach(a => a.remove());
  const links = allLinks.filter(a => !['profile.html', 'avatar.html'].includes((a.getAttribute('href') || '').split('#')[0].replace(/^\.\//, '')));
  const byHref = new Map(links.map(a => [hrefOf(a), a]));

  // Keep the two most frequently used destinations visible.
  links.filter(a => primary.includes(hrefOf(a)))
    .sort((a, b) => primary.indexOf(hrefOf(a)) - primary.indexOf(hrefOf(b)))
    .forEach(a => nav.appendChild(a));

  // Group every other existing destination into areas of two pages.
  groups.forEach((group, index) => {
    const groupLinks = group.links.map(href => byHref.get(href)).filter(Boolean);
    if (!groupLinks.length) return;

    const menu = document.createElement('div');
    menu.className = 'nav-more nav-area';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-more-toggle';
    toggle.innerHTML = `<span>${group.label}</span><span class="nav-more-chevron" aria-hidden="true">⌄</span>`;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-label', `${group.label}, mở danh mục`);

    const panel = document.createElement('div');
    panel.className = 'nav-more-panel';
    panel.id = `navAreaPanel${index}`;
    panel.setAttribute('aria-label', group.title);
    toggle.setAttribute('aria-controls', panel.id);

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
    menu.append(toggle, panel);
    nav.appendChild(menu);

    const close = (focus = false) => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (focus) toggle.focus();
    };
    toggle.addEventListener('click', () => {
      const open = !menu.classList.contains('is-open');
      nav.querySelectorAll('.nav-area.is-open').forEach(other => {
        other.classList.remove('is-open');
        other.querySelector('.nav-more-toggle')?.setAttribute('aria-expanded', 'false');
      });
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
      toggle.setAttribute('aria-label', `${group.label}, đang ở trong danh mục này`);
    }
  });

  // Keep any unrecognized future links accessible rather than silently dropping them.
  const known = new Set([...primary, ...groups.flatMap(group => group.links)]);
  const ungrouped = links.filter(a => !known.has(hrefOf(a)));
  if (ungrouped.length) {
    const menu = document.createElement('div');
    menu.className = 'nav-more nav-area';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-more-toggle';
    toggle.textContent = 'Khác';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    const panel = document.createElement('div');
    panel.className = 'nav-more-panel';
    const section = document.createElement('section');
    section.className = 'nav-more-group';
    ungrouped.forEach(a => section.appendChild(a));
    panel.appendChild(section);
    menu.append(toggle, panel);
    nav.appendChild(menu);
    toggle.addEventListener('click', () => {
      const open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (!menu.contains(e.target)) {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  nav.dataset.compactReady = 'true';
})();
