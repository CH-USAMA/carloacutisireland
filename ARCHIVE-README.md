# carloacutisireland.org

Offline copy of https://www.carloacutisireland.org/, taken with HTTrack on
2026-09-07 and repaired the same day, ahead of the Weebly site being shut down.

The site is now at the **repository root**, so URLs match the original domain
(`/about.html`, `/shop.html`, …). Open `index.html` to view it.

```
index.html  about.html  youth.html  relicvisit.html  schoolworkshops.html  shop.html
uploads/                  site images (all 71 files are referenced — nothing spare)
files/                    theme CSS/JS
cdn-cgi/                  Cloudflare email-decode script
cdn2/11/3.editmysite.com/ Weebly framework CSS, JS and fonts (now served locally)
contact.php               form handler — PHP hosting only, see below
```

---

## Deploying

### Vercel (static demo)

Vercel serves this as-is; there is no build step. `vercel.json` sets
`cleanUrls: false` so `.html` URLs are preserved exactly as on the original site.

**The two forms will not work on Vercel.** Vercel does not execute PHP, and static
hosting cannot accept a POST at all. `.vercelignore` therefore excludes
`contact.php` — if it were deployed it would be served as **plain text**, exposing
its source and the addresses inside it. On the demo, submitting a form gives a 404.
That is expected; tell the client the forms activate on the real host.

`vercel.json` also sets `X-Robots-Tag: noindex, nofollow` on everything, so the demo
cannot be indexed and compete with the live site in search results.
**Remove that header when this becomes the production site.**

### PHP hosting (production)

Upload everything. The forms then work through `contact.php` — see the Forms
section below for the two settings you must change first. Remove the `noindex`
header from `vercel.json` (or just delete the file if you are not using Vercel).

---

## Redesign (this branch)

`main` and the tag `v1-weebly-archive` hold the repaired Weebly site — that is the
fallback and it stays untouched. This `redesign` branch rebuilds the site properly.

**Phase 1 is the home page only.** `index.html` is new; the other five pages are still
the old Weebly markup, so the design changes as you navigate. That is expected until
Phase 2.

```
index.html            rebuilt home page
assets/css/site.css   design system — tokens, layout, components
assets/js/site.js     nav, scroll reveal, video facades, lightbox (no dependencies)
assets/fonts/         Lora + Lato + Montserrat, woff2 only
assets/img/video/     local YouTube poster frames
assets/img/favicon.svg
```

Approach: plain static HTML, hand-written CSS, vanilla JS. No framework and no build
step, so it deploys identically to a static host and to PHP hosting, and there is no
toolchain to maintain. Tailwind was considered and skipped — its CDN build is not
production-grade, and a compiled setup would add npm to a six-page brochure site.

Weight: **55 KB of HTML+CSS+JS, against 1,619 KB** of Weebly framework before, plus
175 KB of fonts against 3.9 MB. No jQuery.

What changed beyond styling:
- One `<h1>` (the old pages had none at all), real alt text written from looking at
  each photograph, skip link, visible focus states, semantic landmarks.
- Favicon and JSON-LD `Organization` data — the site had neither.
- The three YouTube iframes became click-to-load facades with local poster frames, so
  the page loads no third-party script or cookie until someone presses play.
- The prayer form no longer sits on top of Carlo's face. The photograph gets its own
  panel and the form a solid surface, which is what makes it legible.
- Form inputs are fluid; the old hard-coded 370px inputs were the one genuine mobile
  problem on the original.
- All motion is wrapped in `prefers-reduced-motion`.

Verified at 390px: `scrollWidth === innerWidth`, no overflow. Clean console.

---

## What was repaired

1. **9 broken background images.** HTTrack mis-parsed Weebly's escaped quotes in the
   inline `style="background-image:url(...)"` attributes, requested URLs with a stray
   `"` in them, got 404s, and saved the *error pages* as `.html` files that the CSS
   then pointed at. Every page hero and several section backgrounds were blank. The
   real images were re-fetched and the references repointed.

2. **Fonts were still loading from Weebly's CDN.** `social-icons.css` pulled the
   `wsocial` icon font (the Facebook / Instagram / Mail / YouTube footer icons) and
   `sites.css` pulled Proxima Light + Semibold from `cdn2`/`cdn11.editmysite.com` over
   absolute URLs — all of which would have gone blank when Weebly shuts down. All 10
   font files are now local and referenced by relative path.

3. **Cloudflare email obfuscation.** `email-decode.min.js` matched the literal server
   path `/cdn-cgi/l/email-protection#`, but HTTrack had rewritten every link to
   `cdn-cgi/l/email-protection.html#`, so the "Mail" social icon never became a
   `mailto:`. The matcher now keys off `email-protection` + `#`, working both offline
   and on a server. Addresses are still not in the HTML as plain text.

4. **YouTube embeds** used `http://` and were blocked as mixed content on HTTPS.
   Upgraded to `https://`.

5. **reCAPTCHA** had been rewritten to a stale cached copy, which cannot work.
   Restored to Google's live URL.

6. **`ASSETS_BASE`** (the JS base URL Weebly uses to build asset paths) pointed at
   `http://cdn11.editmysite.com/`. Repointed to the local copy.

7. **Dead Muli stylesheet link removed.** It pointed at a file that 404s on the live
   site too, so HTTrack had saved a 404 page and the pages were linking to it as CSS.
   The `font-family:"Muli"` rule is deliberately left in place — it falls back to
   sans-serif, exactly as it does on the live site.

8. **POWR social feed replaced** — see below.

## Verified

- All 71 upload files are referenced; nothing spare to prune.
- 92 unique assets (HTML, CSS, JS, images, fonts) all return 200 over a local server,
  including assets referenced from inside CSS.
- All 6 pages render correctly in headless Chrome with a clean console.
- At 390px the local copy rendered **byte-for-byte identically** to the live site, so
  mobile layout is faithful.
  (Correction: an earlier note here claimed the live site had a horizontal overflow on
  narrow screens. That was wrong — it was an artefact of headless Chrome, which forces a
  500px minimum layout viewport regardless of the window size you ask for, so any page
  captured that way looks clipped. Measured properly in a 390px iframe,
  `scrollWidth === innerWidth === 390`: no overflow.)
- Both forms were driven end-to-end through the real page markup with Weebly's JS
  running, and `contact.php` received every field correctly.

## Still needs the internet

Inherent to the content, same as the live site: the 3 YouTube embeds and Google
Analytics. Everything else is local.

---

## Forms — `contact.php`

The forms used to POST to `https://www.weebly.com/weebly/apps/formSubmit.php`, which
dies with Weebly. They now post to `contact.php`. Weebly's own JavaScript does a
*native* submit (its reCAPTCHA is disabled — `data-recaptcha="0"`), so repointing
`action` was enough; the form markup and styling are untouched.

### Two things to change before it can send mail

1. **`MAIL_FROM`** — currently `website@carloacutisireland.org`. This must be a real
   mailbox at your own domain or most hosts reject the mail or spam-bin it. It is
   deliberately *not* the visitor's address; theirs goes in `Reply-To`.
2. **`RECIPIENTS`** — both forms currently go to `info@carloacutisireland.org`.

### What it does

- Maps Weebly's opaque field names (`_u952557491606322518` …) to readable labels, so
  mail arrives as `Name / Email address / Phone number / Items requested`.
- Validates required fields, email and phone server-side, with a themed error page
  listing exactly what was wrong.
- **Logs every submission before sending**, so a mail outage cannot silently lose an
  order. If `mail()` fails the visitor is told plainly and given the direct address.
- Anti-spam without reCAPTCHA: a honeypot field, a 3-second minimum time-on-page
  (stamped by JS, skipped if JS is off), and a 10/hour per-IP limit.

### ⚠ Untested: actual delivery

Everything up to the moment of sending is verified. `mail()` itself has never
succeeded here, because this development machine has no mail server. **Send one test
order on the real host and confirm it arrives.**

### ⚠ Check the prayer-form confirmation text

The order form's confirmation is reproduced verbatim from the live site. The **prayer
request** form's is not — Weebly generates it server-side, so it was never in the
mirror. The wording in `FORMS['prayer']['message']` is a stand-in; replace it with the
original if you have it.

### Security

`form-submissions.log` holds names, emails and phone numbers. It is excluded by
`.gitignore` and `.vercelignore`, and `.htaccess` blocks web access to `*.log`.
**`.htaccess` only works on Apache** — on nginx, move `LOG_FILE` outside the web root
or add an equivalent deny rule.

---

## Social feed on youth.html

The page used a POWR "Social Feed" widget showing the six latest posts from Instagram
`@carlo_acutis_youth_irl`. It rendered a POWR advert underneath ("Social Feed — Create
your own for free!") and depended on POWR, on the Weebly site id inside its token, and
on Instagram image URLs that carry **expiring signatures**.

It is now a static local gallery: the same six images in the same three-column layout,
saved to `uploads/1/2/2/5/122563310/social-feed/1-6.jpg`, with a "Follow
@carlo_acutis_youth_irl on Instagram" link below. The advert is gone and the section
depends on nothing external.

Trade-off: it is a snapshot from 2026-09-07 and **will not auto-update**. Replace those
six JPEGs to refresh it, or ask for a live embed if self-updating matters more.

---

## Optional further slimming

The repo is ~26 MB, which is comfortably inside Vercel's limits, so nothing more is
required. If you ever want it smaller, the fonts are the only real weight (~3.5 MB):
each family ships `.eot`, `.ttf`, `.woff` and `.woff2`, and every browser since about
2016 only needs `.woff2`. Dropping the other three formats would cut roughly 2.5 MB but
means editing each family's `font.css`. Not done here — the risk outweighs the benefit
at this size.
