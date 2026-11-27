import { THEME } from "./theme.mjs";

/**
 * The page shell every generated page shares.
 *
 * One function, so a change to the head block reaches ~290 pages rather than
 * one. The parts that vary per page are the parts a search engine reads
 * differently per page: title, description, canonical, JSON-LD, breadcrumbs.
 *
 * # What is deliberately absent
 *
 * No external hosts. No font CDN, no analytics, no tag manager. A tool whose
 * entire argument is that it sends nothing anywhere cannot have a page that
 * makes three third-party requests before the reader has read a sentence — and
 * a `check-site` assertion enforces it, because that is the kind of thing that
 * gets added later "just for a week".
 */

/** Escapes text for an HTML attribute or text node. */
export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Escapes a string for embedding inside a JSON-LD block. */
function jsonLd(value) {
  // `</script>` inside a JSON string would close the block early; escaping the
  // slash is the standard fix and stays valid JSON.
  return JSON.stringify(value, null, 2).replaceAll("</", "<\\/");
}

/**
 * Problems found while rendering, reported together at the end of the build.
 *
 * Collected rather than thrown, because a build that fails on the first of
 * fourteen makes you run it fourteen times to find out how much work there is.
 */
export const problems = [];

/**
 * Every hand-written destination, grouped the way a reader looks for it.
 *
 * The header menus, the footer, and the homepage directory all render from
 * these two lists, so a page cannot be reachable from one of them and missing
 * from another. It used to be possible: nine pages were linked only from a row
 * of inline links at the end of one homepage paragraph, which nobody read as
 * navigation. `check-site.mjs` keeps its own copy of the header order on
 * purpose — it exists to notice this list drifting, not to agree with it.
 */
export const NAV_GROUPS = [
  {
    id: "product",
    label: "Product",
    intro: "What owlwarden checks, and how it stays local.",
    items: [
      { label: "turn", href: "turn/", blurb: "Only what this turn introduced." },
      { label: "vet", href: "vet/", blurb: "Check a repository before you open it." },
      { label: "seal", href: "seal/", blurb: "Notice when the agent's execution surface moves." },
      { label: "Agent config", href: "agent-config-security/", blurb: "Hooks, MCP servers, instructions, and editor tasks." },
      { label: "Offline", href: "offline/", blurb: "No account, no telemetry, no network by default." },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    intro: "Agent hosts, the MCP server, and CI.",
    items: [
      { label: "Claude Code", href: "claude-code/", blurb: "gate on edits and commands, turn at Stop." },
      { label: "Cursor", href: "cursor/", blurb: "The same hooks, plus a rules file." },
      { label: "MCP", href: "mcp/", blurb: "Four read-only tools the model can call." },
      { label: "CI", href: "ci/", blurb: "SARIF, JUnit, and exit codes." },
    ],
  },
  {
    id: "learn",
    label: "Learn",
    intro: "How to read a finding, and what a scan cannot see.",
    items: [
      { label: "Exposure", href: "exposure/", blurb: "Which finding to fix first." },
      { label: "Runtimes", href: "runtimes/", blurb: "Does the fix run on Bun, Deno, or Workers?" },
      { label: "OWASP coverage", href: "owasp/", blurb: "Mapped categories, and the gaps." },
      { label: "ASI coverage", href: "asi/", blurb: "Agent-config rules against OWASP ASI." },
      { label: "Benchmark", href: "benchmark/", blurb: "How noisy it is, and why there is no number yet." },
    ],
    compare: [
      { label: "Semgrep", href: "vs/semgrep/" },
      { label: "Snyk", href: "vs/snyk/" },
      { label: "model review", href: "vs/claude-security/" },
      { label: "eslint-plugin-security", href: "vs/eslint-plugin-security/" },
    ],
  },
];

/** Destinations with no menu of their own: one click away, from every page. */
export const NAV_LINKS = [
  { label: "Rules", href: "rules/", blurb: "Every rule, what triggers it, and the fix for your framework." },
  { label: "Changelog", href: "changelog/", blurb: "Release notes, and rule ids that changed." },
];

/**
 * A description that will actually render in a result.
 *
 * Google truncates around 155–160 characters. Shorter than ~110 and the snippet
 * looks thin next to competitors; longer than 165 and the end is cut mid-word,
 * which is where the reason to click usually lives.
 */
export function checkDescription(description, where) {
  if (description.length < 110 || description.length > 165) {
    problems.push(
      `${where}: description is ${description.length} chars, aim for 110-165\n    ${description}`,
    );
  }
  return description;
}

/** A title that will not be truncated in a result. */
export function checkTitle(title, where) {
  if (title.length > 62) {
    problems.push(`${where}: title is ${title.length} chars, aim for under 60\n    ${title}`);
  }
  return title;
}

/**
 * Renders one page.
 *
 * @param {object} page
 * @param {string} page.path        Site-relative path, e.g. `rules/ssrf/`.
 * @param {string} page.title       Under 60 chars, brand suffix added here.
 * @param {string} page.description 110-165 chars, written to be clicked.
 * @param {string} page.heading     The single `<h1>`.
 * @param {string} page.body        Rendered HTML for `<main>`.
 * @param {object} [page.hero]      Structured product intro for marketing pages.
 * @param {Array}  page.breadcrumbs `[{ label, href }]`, current page last.
 * @param {Array}  page.schema      JSON-LD objects.
 * @param {string} site             Origin, from `site.url`.
 * @param {string} version          Engine version for the footer.
 * @param {string} assetVersion     Content hash for immutable browser caching.
 */
export function renderPage(page, site, version, assetVersion) {
  const canonical = `${site}/${page.path}`;
  // Directory depth, not path segments: `404.html` sits at the root and needs
  // `./`, while `rules/ssrf/` sits two deep and needs `../../`. Counting
  // segments would give the 404 page a `../` prefix on every link — pointing
  // one level above the site, which is the kind of break nobody clicks until a
  // reader does.
  const segments = page.path.split("/").filter(Boolean);
  const depth = page.path.endsWith("/") || page.path === "" ? segments.length : segments.length - 1;
  // Relative asset paths so the whole site works from a subdirectory *and* from
  // a custom domain without a rebuild of every href.
  const up = depth <= 0 ? "./" : "../".repeat(depth);

  const description = checkDescription(page.description, page.path || "/");
  const title = checkTitle(
    page.title.includes("owlwarden") ? page.title : `${page.title}: owlwarden`,
    page.path || "/",
  );

  const graph = [
    {
      "@type": "WebSite",
      "@id": `${site}/#website`,
      name: "owlwarden",
      url: `${site}/`,
      description: "Local security scanner for Node apps and coding-agent configuration.",
      inLanguage: "en",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumbs`,
      itemListElement: page.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: crumb.href.startsWith("http") ? crumb.href : `${site}/${crumb.href}`,
      })),
    },
    ...(page.schema ?? []),
  ];
  const robots = page.path === "404.html"
    ? "noindex,follow"
    : "index,follow,max-image-preview:large,max-snippet:-1";

  return normalizeSiteCopy(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">

<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="${THEME.paper}">

<meta property="og:type" content="${page.ogType ?? "article"}">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="owlwarden">
<meta property="og:title" content="${esc(page.heading)}">
<meta property="og:description" content="${esc(page.ogDescription ?? description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${site}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="An owlwarden finding: a SessionStart hook in .claude/settings.json that runs a command when the workspace is opened">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.heading)}">
<meta name="twitter:description" content="${esc(page.ogDescription ?? description)}">
<meta name="twitter:image" content="${site}/og.png">
<meta name="twitter:image:alt" content="An owlwarden scan showing the exact vulnerable line and its fix">

<link rel="icon" type="image/svg+xml" href="${up}favicon.svg">
<link rel="alternate icon" type="image/png" sizes="192x192" href="${up}favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="${up}apple-touch-icon.png">
<link rel="manifest" href="${up}manifest.webmanifest">
<link rel="alternate" type="application/atom+xml" title="owlwarden releases" href="${site}/changelog/feed.xml">
<link rel="stylesheet" href="${up}styles.css?v=${esc(assetVersion)}">

<script type="application/ld+json">
${jsonLd({ "@context": "https://schema.org", "@graph": graph })}
</script>
</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>

<header class="site-header">
  <a class="wordmark" href="${up}">
    <img src="${up}favicon.svg" width="32" height="32" alt="">
    <span>owlwarden</span>
  </a>
  <nav aria-label="Primary" class="primary-nav">
${renderPrimaryNavigation(page.path, up)}
  </nav>
  <a class="header-cta" href="https://github.com/suthat/owlwarden" rel="noopener">GitHub <span aria-hidden="true">↗</span></a>
</header>

<nav class="breadcrumbs" aria-label="Breadcrumb">
  <ol>
${page.breadcrumbs
  .map((crumb, index) => {
    const last = index === page.breadcrumbs.length - 1;
    const href = crumb.href.startsWith("http") ? crumb.href : `${up}${crumb.href}`;
    return last
      ? `    <li aria-current="page">${esc(crumb.label)}</li>`
      : `    <li><a href="${esc(href)}">${esc(crumb.label)}</a></li>`;
  })
  .join("\n")}
  </ol>
</nav>

<main id="main-content" class="${page.hero ? "with-hero" : "article-page"}">
${renderHero(page)}
${page.body}
</main>

<footer class="site-footer">
  <div class="footer-brand">
    <img src="${up}favicon.svg" width="36" height="36" alt="">
    <p><strong>owlwarden ${esc(version)}</strong><br>Local security checks for Node apps and coding-agent configuration.</p>
  </div>
  <nav aria-label="Footer" class="footer-nav">
${renderFooterNavigation(up)}
  </nav>
  <p class="licence">No account / no telemetry / MIT OR Apache-2.0 / <code>npx owlwarden turn</code></p>
</footer>
</body>
</html>
`);
}

/** Keeps generated copy on plain punctuation across metadata and page text. */
function normalizeSiteCopy(html) {
  return html
    .replaceAll("·", "/")
    .replaceAll("—", "-")
    .replaceAll("–", "-");
}

/** Renders the primary navigation: one menu per group, then the direct links. */
function renderPrimaryNavigation(path, up) {
  const current = currentHref(path);
  const menus = NAV_GROUPS.map((group) => renderMenu(group, current, up));
  const links = NAV_LINKS.map(
    (link) => `    <a class="nav-link" href="${up}${link.href}"${here(link.href, current)}>${esc(link.label)}</a>`,
  );
  return [...menus, ...links].join("\n");
}

/**
 * One header menu.
 *
 * A popover rather than a script: the browser opens it from its button, closes
 * it on Escape or a click outside, keeps one open at a time, and tells
 * assistive technology whether it is expanded. Where popovers are unsupported
 * the buttons hide themselves, and the footer still lists every page.
 */
function renderMenu(group, current, up) {
  const id = `menu-${group.id}`;
  const entries = [...group.items, ...(group.compare ?? [])];
  const section = entries.some((item) => item.href === current) ? " is-current" : "";
  const tiles = group.items
    .map(
      (item) =>
        `            <li><a href="${up}${item.href}"${here(item.href, current)}><span class="nav-name">${esc(item.label)}</span><span class="nav-blurb">${esc(item.blurb)}</span></a></li>`,
    )
    .join("\n");
  const compare = group.compare
    ? `\n          <p class="nav-compare"><span>Compared with</span>${group.compare
        .map((item) => ` <a href="${up}${item.href}"${here(item.href, current)}><span class="nav-name">${esc(item.label)}</span></a>`)
        .join("")}</p>`
    : "";

  return `    <div class="nav-menu">
      <button type="button" class="nav-trigger${section}" popovertarget="${id}">${esc(group.label)}</button>
      <div class="nav-panel" id="${id}" popover>
        <div class="nav-panel-head">
          <p class="nav-panel-title">${esc(group.label)}</p>
          <p class="nav-panel-intro">${esc(group.intro)}</p>
        </div>
        <div class="nav-panel-body">
          <ul class="nav-tiles">
${tiles}
          </ul>${compare}
        </div>
      </div>
    </div>`;
}

/**
 * The footer: every destination, always expanded.
 *
 * Nothing here depends on a menu opening, so it is also the fallback for a
 * browser without popovers, and the one place a reader can see the whole site
 * at once without clicking anything.
 */
function renderFooterNavigation(up) {
  const internal = (item, label = item.label) => `<a href="${up}${item.href}">${esc(label)}</a>`;
  const external = (href, label) =>
    `<a href="${href}" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;
  const column = (title, links) => `    <div class="footer-group">
      <p class="footer-title">${esc(title)}</p>
      <ul>
${links.map((link) => `        <li>${link}</li>`).join("\n")}
      </ul>
    </div>`;
  const compare = NAV_GROUPS.flatMap((group) => group.compare ?? []);

  return [
    ...NAV_GROUPS.map((group) => column(group.label, group.items.map((item) => internal(item)))),
    column("Compare", compare.map((item) => internal(item, `vs ${item.label}`))),
    column("Project", [
      ...NAV_LINKS.map((item) => internal(item)),
      external("https://github.com/suthat/owlwarden/blob/main/RULES.md", "RULES.md"),
      external("https://github.com/suthat/owlwarden", "GitHub"),
      external("https://www.npmjs.com/package/owlwarden", "npm"),
    ]),
  ].join("\n");
}

/**
 * The homepage's map of the site, from the same lists as the header menus.
 *
 * It replaces a row of eleven inline links at the end of a paragraph. Each
 * entry says what the page answers, because a bare "exposure" or "seal" means
 * nothing to someone who has not read the page yet.
 */
export function renderDirectory(up) {
  const entry = (item) =>
    `      <li><a href="${up}${item.href}"><span class="name">${esc(item.label)}</span><span class="blurb">${esc(item.blurb)}</span></a></li>`;
  const groups = [...NAV_GROUPS, { label: "Reference", items: NAV_LINKS }];

  return `<div class="directory">
${groups
  .map((group) => {
    const compare = group.compare
      ? `\n    <p class="directory-compare">Compared with ${group.compare
          .map((item) => `<a href="${up}${item.href}">${esc(item.label)}</a>`)
          .join(", ")}.</p>`
      : "";
    return `  <div class="directory-group">
    <h3>${esc(group.label)}</h3>
    <ul>
${group.items.map(entry).join("\n")}
    </ul>${compare}
  </div>`;
  })
  .join("\n")}
</div>`;
}

/** The navigation entry that stands for `path`. Every rule page belongs to Rules. */
function currentHref(path) {
  if (path.startsWith("rules/")) return "rules/";
  const entries = [...NAV_GROUPS.flatMap((group) => [...group.items, ...(group.compare ?? [])]), ...NAV_LINKS];
  return entries.find((item) => item.href === path)?.href;
}

/** The current-page marker, on the one link that stands for this page. */
function here(href, current) {
  return href === current ? ' aria-current="page"' : "";
}

/** Renders the one product-hero interface used by every marketing page. */
function renderHero(page) {
  if (!page.hero) return `<h1>${esc(page.heading)}</h1>`;
  const actions = page.hero.actions
    .slice(0, 3)
    .map(
      (action) =>
        `<a class="button button-${esc(action.kind ?? "secondary")}" href="${esc(action.href)}">${esc(action.label)}</a>`,
    )
    .join("\n");

  return `<section class="page-hero">
  <div class="hero-copy">
    <p class="eyebrow">${esc(page.hero.kicker)}</p>
    <h1>${esc(page.heading)}</h1>
    <p class="hero-summary">${page.hero.summary}</p>
    <div class="hero-actions">${actions}</div>
  </div>
  ${page.hero.visual}
</section>`;
}

/** A fenced code block with a real language class. */
export function code(language, source) {
  return `<pre class="code"><code class="language-${esc(language)}">${esc(source)}</code></pre>`;
}

/** The severity chip used everywhere a finding is described. */
export function chip(kind, label) {
  return `<span class="chip chip-${esc(kind)}">${esc(label ?? kind)}</span>`;
}
