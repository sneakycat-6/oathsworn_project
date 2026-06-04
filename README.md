# Oathsworn Companion

An unofficial companion web app for **Oathsworn: Into the Deepwood** by Shadowborne Games.
Dark fantasy theme, fully static — deployable to GitHub Pages or any static host.

---

## Project Structure

```
oathsworn_project/
│
├── index.html                  # Landing / home page
│
├── pages/
│   ├── monster-deck.html            # Monster Deck app
│   └── app-two.html            # Sub-app page 2 (full-width card grid layout)
│
├── css/
│   ├── variables.css           # All design tokens (colours, spacing, fonts …)
│   ├── base.css                # CSS reset + typography baseline
│   ├── layout.css              # Nav, footer, containers, grid helpers
│   ├── components.css          # Buttons, cards, badges, modals, forms …
│   ├── theme.css               # Dark-fantasy atmosphere, hero, animations
│   └── pages/
│       └── app-page.css        # Generic app-page layout (sidebar, toolbar, panels)
│
├── js/
│   ├── utils.js                # Shared helpers: DOM, toasts, modals, storage, tabs
│   ├── components/
│   │   └── nav.js              # Navigation: active link, scroll class, mobile toggle
│   └── pages/
│       └── app-page.js         # Starter logic for sub-app pages
│
└── assets/
    ├── icons/
    │   └── favicon.svg
    ├── images/                 # Drop page images / artwork here
    └── fonts/                  # Drop self-hosted font files here
```

---

## Adding a New Page

1. Copy `pages/monster-deck.html` (or `app-two.html`) into `pages/` with a descriptive name.
2. Add a `<link>` entry in the new file's `<head>` for any page-specific CSS you need.
3. Add a `<script>` entry for any page-specific JS (`js/pages/<name>.js`).
4. Add the new page's `<li>` to the `<ul class="nav__menu">` in **every** HTML file.
5. Link to it from `index.html`'s Apps section.

All shared logic (nav, utils, theme, layout) loads automatically.

---

## Layouts Available

| Layout | How to use |
|--------|-----------|
| Sidebar + detail panel | Default `app-layout` — see `monster-deck.html` |
| Full-width card grid | `app-layout--full` + `.grid` — see `app-two.html` |

Both layouts are fully responsive and collapse to a single column on mobile.

---

## Local Development

No build step required. Open `index.html` in a browser, or serve with any static file server:

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

---

## GitHub Pages Deployment

Push to `main` (or `gh-pages`) and enable GitHub Pages in the repository settings.
Set the source to the repository root. The app is fully static with no backend dependencies.

---

## Customisation Reference

| File | What to change |
|------|---------------|
| `css/variables.css` | Colours, fonts, spacing, shadows |
| `css/theme.css` | Hero section, glows, ornamental elements |
| `css/components.css` | Button styles, card variants, badges |
| `index.html` | Hero text, lore quote, app card descriptions |
| `pages/monster-deck.html` | Monster Deck content |
| `pages/app-two.html` | App Two content, card grid, filter buttons |
| `js/pages/app-page.js` | Shared starter logic for sub-app pages |

---

*Oathsworn: Into the Deepwood is © [Shadowborne Games](https://shadowborne-games.com/).
This project is fan-made and not affiliated with or endorsed by Shadowborne Games.*
