# Connect Navigation Update

## Compact area navigation (2026-11-24)

The shared navigation now presents two direct destinations and four compact areas. Each area contains no more than two main pages:

- **Trang chủ:** `index.html`
- **Soul Match:** `match.html`
- **Kết nối:** `discover.html`, `friends.html`
- **Cộng đồng:** `square.html`, `voice.html`
- **Cá nhân:** `profile.html`, `avatar.html`
- **Giải trí & khám phá:** `icebreaker.html`, `quiz.html`

Account settings remain reachable from the account controls; `public-profile.html` remains a profile-detail route, and `admin.html`, `login.html`, and `register.html` remain dedicated system routes.

This is a navigation and information-architecture change only. It does not delete or rename HTML pages, alter database tables, change Supabase configuration, or remove feature scripts. Existing page URLs and feature implementations are retained. Each area menu closes on outside click or Escape, exposes its expanded state to assistive technology, and supports the existing mobile navigation layout.

## Validation

- Checked JavaScript syntax for `js/nav-compact.js`.
- Checked that every grouped destination has a corresponding HTML file.
- Checked that every page loading the shared navigation script contains the expected navigation container.
