/* Shared responsive navigation controls. */
(() => {
  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.getElementById('navLinks');
  if (!menuBtn || !navLinks || menuBtn.dataset.menuReady === 'true') return;

  const setOpen = (open) => {
    navLinks.classList.toggle('active', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng');
    menuBtn.textContent = open ? '✕' : '☰';
  };
  menuBtn.addEventListener('click', () => setOpen(!navLinks.classList.contains('active')));
  navLinks.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('click', e => {
    if (!navLinks.contains(e.target) && !menuBtn.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 820) setOpen(false); });
  menuBtn.dataset.menuReady = 'true';
})();
