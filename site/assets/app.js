// Bones Companion's landing page. Everything works without this file: the
// download links, the mobile "Email yourself the link", the FAQ. It only adds:
// - picking the download for this computer (the other one stays a click away);
// - on a phone or tablet, the "send it to my computer" panel first;
// - Copy link and Share, where the browser has them.
// No requests, no storage, no tracking.
(() => {
  const root = document.documentElement;
  const ua = navigator.userAgent || '';
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const touchMac = /Mac/i.test(platform) && navigator.maxTouchPoints > 1; // iPadOS reports a Mac
  let os = 'other';
  if (/Android|iPhone|iPad|iPod/i.test(ua) || touchMac || /CrOS/.test(ua)) os = 'mobile';
  else if (/Win/i.test(platform) || /Windows NT/i.test(ua)) os = 'win';
  else if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) os = 'mac';
  else if (/Linux/i.test(platform) || /Linux/i.test(ua)) os = 'linux';
  root.dataset.os = os;
  root.dataset.device = os === 'mobile' ? 'mobile' : 'desktop';
  if (root.dataset.pick !== 'none') {
    if (os === 'mac' || os === 'win') {
      // This system's file: lead with it. No file for it yet: its own "coming soon", with the other system a click away.
      if (root.dataset[os] === 'ready') root.dataset.pick = os;
      else { root.dataset.pick = 'none'; root.dataset.soonFor = os; }
    } else if (os !== 'mobile') {
      root.dataset.pick = 'choose'; // Linux or unknown: both downloads, neither first
    }
  }

  // A link to a question opens it (#check).
  const openTarget = hash => { const el = hash && document.getElementById(hash.slice(1)); if (el && el.tagName === 'DETAILS') el.open = true; };
  openTarget(location.hash);
  addEventListener('hashchange', () => openTarget(location.hash));
  for (const a of document.querySelectorAll('a[href^="#"]')) a.addEventListener('click', () => openTarget(a.getAttribute('href')));

  const status = document.getElementById('status');
  const say = text => { if (status) { status.textContent = ''; setTimeout(() => { status.textContent = text; }, 50); } };
  const link = (document.querySelector('link[rel="canonical"]') || {}).href || location.href.split('#')[0];

  for (const button of document.querySelectorAll('[data-copy]')) {
    if (!navigator.clipboard) continue;
    button.hidden = false;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link);
        const label = button.querySelector('span');
        label.textContent = 'Link copied';
        setTimeout(() => { label.textContent = 'Copy link'; }, 3000);
        say('Link copied. Paste it anywhere you’ll see it on your computer.');
      } catch {
        say('Couldn’t copy the link. Copy it from the address bar instead.');
      }
    });
  }
  if (navigator.share) {
    for (const button of document.querySelectorAll('[data-share]')) {
      button.hidden = false;
      button.addEventListener('click', () => {
        navigator.share({ title: 'Bones Companion', text: 'Bones Companion, an AI companion for World of Warcraft: Forever', url: link }).catch(() => {});
      });
    }
  }
})();
