// Writes the latest release of tommygeoco/bones-companion-releases into the page, so
// the download buttons link straight to the right file with no JavaScript.
//   node release-links.mjs <site dir> <out dir> [--fixture release.json] [--include-prereleases] [--soon]
// It copies <site dir> to <out dir> (leaving out tools/ and README.md) and rewrites
// out/index.html:
//   <html data-pick data-mac data-win>   which download leads, and whether each system
//                                        has a file ("ready") or not yet ("soon");
//   data-href="mac|win|sums|release"     the links: each system's file, the checksums,
//                                        the release page;
//   data-text="…"                        the version, size and date lines.
// "Latest" is GitHub's: the newest published release that isn't a prerelease (so an
// unannounced prerelease for testers never reaches this page). --include-prereleases
// takes the newest published release of any kind instead. With no release, or no file
// for a system, that system stays "coming soon" and its links go to the releases page.
// --soon writes the "coming soon" state whatever the releases are: the Pages workflow passes it
// until the builds are signed and notarized (the repo variable DOWNLOADS_LIVE turns it off).
// In GitHub Actions, GITHUB_TOKEN (read-only) is sent to avoid the anonymous rate limit.
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'tommygeoco/bones-companion-releases';
const RELEASES = `https://github.com/${REPO}/releases`;
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const [siteDir, outDir] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--fixture'));
if (!siteDir || !outDir) {
  console.error('usage: node release-links.mjs <site dir> <out dir> [--fixture release.json] [--include-prereleases] [--soon]');
  process.exit(2);
}

async function api(url) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'bones-companion-site' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function latestRelease() {
  const fixture = opt('--fixture');
  if (fixture) return JSON.parse(fs.readFileSync(fixture, 'utf8'));
  if (!flag('--include-prereleases')) return api(`https://api.github.com/repos/${REPO}/releases/latest`);
  const list = await api(`https://api.github.com/repos/${REPO}/releases?per_page=20`);
  return (list || []).find(r => !r.draft) || null;
}

// The files: the Mac disk image (the universal one when there are several) and the
// Windows installer; never a blockmap, a zip for the updater or an update feed.
function pick(assets) {
  const named = re => assets.filter(a => re.test(a.name) && !/\.blockmap$/i.test(a.name));
  const dmgs = named(/\.dmg$/i);
  const mac = dmgs.find(a => /universal/i.test(a.name)) || dmgs[0] || null;
  const exes = named(/\.exe$/i);
  const win = exes.find(a => /setup/i.test(a.name)) || exes[0] || null;
  const sums = assets.find(a => /^SHA256SUMS(\.txt)?$/i.test(a.name)) || null;
  return { mac, win, sums };
}

const mb = bytes => `${Math.max(1, Math.round(bytes / 1e6))} MB`;
const day = iso => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (from === siteDir && (entry.name === 'tools' || entry.name === 'README.md')) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

const release = flag('--soon') ? null : await latestRelease();
const files = release ? pick(release.assets || []) : { mac: null, win: null, sums: null };
const version = release ? String(release.tag_name || release.name || '').replace(/^v/i, '') : '';
// Whole templates, never a fragment glued on: "Version 0.2.0 · 148 MB", "Version 0.2.0 (early access) · 148 MB".
const early = !!(release && release.prerelease);
const ver = early ? `Version ${version} (early access)` : `Version ${version}`;
const state = { mac: files.mac ? 'ready' : 'soon', win: files.win ? 'ready' : 'soon' };
const pickOs = files.mac ? 'mac' : files.win ? 'win' : 'none';
const pageUrl = release ? release.html_url : RELEASES;

const href = {
  mac: files.mac ? files.mac.browser_download_url : pageUrl,
  win: files.win ? files.win.browser_download_url : pageUrl,
  sums: files.sums ? files.sums.browser_download_url : pageUrl,
  release: pageUrl,
};
const text = {};
if (files.mac) {
  text['mac-meta'] = `Free · ${mb(files.mac.size)} · macOS 14 or later`;
  text['mac-size'] = `${ver} · ${mb(files.mac.size)}`;
}
if (files.win) {
  text['win-meta'] = `Free · ${mb(files.win.size)} · Windows 10 or 11`;
  text['win-size'] = `${ver} · ${mb(files.win.size)}`;
}
if (release && (files.mac || files.win)) text['release-line'] = `${ver} · ${day(release.published_at || release.created_at)}`;

copyDir(siteDir, outDir);
const file = path.join(outDir, 'index.html');
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/<html lang="en" data-pick="[^"]*" data-mac="[^"]*" data-win="[^"]*">/,
  `<html lang="en" data-pick="${pickOs}" data-mac="${state.mac}" data-win="${state.win}">`);
html = html.replace(/data-href="(mac|win|sums|release)" href="[^"]*"/g, (_, k) => `data-href="${k}" href="${esc(href[k])}"`);
html = html.replace(/(<(\w+)[^>]*\sdata-text="([\w-]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, tag, key, inner, close) => key in text ? `${open}${esc(text[key])}${close}` : m);
fs.writeFileSync(file, html);
console.log(JSON.stringify({ release: release ? release.tag_name : null, prerelease: !!(release && release.prerelease), pick: pickOs, state, files: { mac: files.mac?.name ?? null, win: files.win?.name ?? null, sums: files.sums?.name ?? null } }));
