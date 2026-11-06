function fillOnce(html, marker, value) {
  if (!html.includes(marker) || html.indexOf(marker) !== html.lastIndexOf(marker)) {
    throw new Error(`Expected exactly one ${marker} marker`);
  }
  return html.replace(marker, () => value);
}

const SITE_ORIGIN = 'https://agileaimanifesto.org';
const EDITION_STATUSES = ['current', 'archived'];
const EDITION_FIELDS = ['number', 'year', 'status'];

const targetOf = (edition) => (edition.status === 'current' ? '/' : `/editions/${edition.number}/`);

function editionLabel(editions, shown) {
  const links = editions
    .map((edition) => `<li><a href="${targetOf(edition)}"${edition === shown ? ' aria-current="page"' : ''}>${edition.number}</a></li>`)
    .join('');
  // The list is visible by default so it works without JavaScript; the page script collapses it behind the button.
  const toggle = `<button type="button" class="edition-toggle" aria-expanded="false" aria-controls="edition-list" hidden>${shown.number}<span aria-hidden="true"> ▾</span></button>`;
  return `<div class="edition">EDITION <nav class="edition-picker" aria-label="Manifesto edition">${toggle}<ul id="edition-list" class="edition-list">${links}</ul></nav> &nbsp;·&nbsp; ${shown.year}</div>`;
}

function validateEditions(editions) {
  const seen = new Set();
  for (const entry of editions) {
    const { number, year, status } = entry;
    if (typeof number !== 'string' || !/^\d{2}$/.test(number)) throw new Error(`Edition number ${JSON.stringify(number)} must be two digits`);
    if (seen.has(number)) throw new Error(`Edition ${number} is listed more than once`);
    seen.add(number);
    if (!EDITION_STATUSES.includes(status)) throw new Error(`Edition ${number} has unknown status ${JSON.stringify(status)}`);
    if (!Number.isInteger(year)) throw new Error(`Edition ${number} year must be an integer`);
    const unknown = Object.keys(entry).find((field) => !EDITION_FIELDS.includes(field));
    if (unknown) throw new Error(`Edition ${number} has unknown field ${JSON.stringify(unknown)}`);
  }
  const currents = editions.filter((edition) => edition.status === 'current');
  if (currents.length !== 1) throw new Error(`Expected exactly one current edition, found ${currents.length}`);
  return currents[0];
}

export function renderPages({ template, css, manifest, readContent }) {
  const editions = [...manifest.editions].sort((a, b) => Number(b.number) - Number(a.number));
  const current = validateEditions(editions);
  const contents = new Map(editions.map((edition) => [edition, readContent(`editions/${edition.number}.html`).trim()]));
  const styled = fillOnce(template, '/* SITE_STYLES */', css);
  const notice = (edition) => (edition === current ? ''
    : `\n  <div class="wrap"><p class="edition-notice">You are reading Edition ${edition.number}. The current edition is <a href="/">Edition ${current.number}</a>.</p></div>`);
  const canonical = (edition) => `<link rel="canonical" href="${SITE_ORIGIN}${targetOf(edition)}">`;
  const render = (edition) => {
    let page = fillOnce(styled, '<!-- EDITION_CANONICAL -->', canonical(edition));
    page = fillOnce(page, '<!-- EDITION_NOTICE -->', notice(edition));
    page = fillOnce(page, '<!-- EDITION_LABEL -->', editionLabel(editions, edition));
    return fillOnce(page, '<!-- EDITION_CONTENT -->', contents.get(edition));
  };
  const pages = { '/': render(current) };
  for (const edition of editions) pages[`/editions/${edition.number}/`] = render(edition);
  return pages;
}
