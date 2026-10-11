# InKognito launch runbook

Everything still to do before inkognito.co.il goes live, in order, and how to keep it running (9). Each step says who does it.
"Owner" steps are dashboard clicks; Claude can guide each one live. Written 4 October 2026 on
branch `inkognito`, from the build plus three research reports (Cloudflare Pages, email with
Resend, Israeli law) and an independent security review.

**Already done** (by 11.10):
- **The Supabase project** (Frankfurt). Migrations 0001–0012 are all live and verified.
  - 0009 (5.10): a byte budget for logs, names only from Google, profiles only once confirmed.
  - 0010 (5.10): the keep-awake request.
  - 0006 (5.10): the daily sign-ups email. A test was sent.
  - 0011 (7.10): email change, «הורדת המידע שלי», the deletion email, the owner's delete.
  - 0012 (8.10): a record of what each account agreed to, and when.
- **Sign-in** with Google, or with an email and a password.
- **The rest of the build:** the gate, the hosted build (`dist/`), the admin page and the legal
  pages.
- **The site runs on inkognito.co.il**, with www redirected to it (5.4). It is kept out of search
  engines until launch (7).
- **Email:** it goes out through Resend from contact@inkognito.co.il (4.1). The templates were
  pasted in their final versions on 8.10 (all four: the footer line, and the new Change Email Address).
- **Google sign-in** is open to every account (6).
- **The tool speaks to its users in the plural** (v59, public tool and hosted alike).

**Left** (the order agreed on 10.10):
- The owner's full test on the live site, in Gmail and in an Outlook or Microsoft 365 inbox:
  sign-up, confirmation, reset, email change with two inboxes, Google, a document, the demo, the
  admin page, deleting an account.
- Supabase Pro (7), with the custom domain for Google's sign-in screen (6), Turnstile on sign-up,
  leaked-password protection (8) and the password-changed notice. Turnstile loads Cloudflare's
  script on the sign-in page, so that page's security policy changes first, and the privacy page
  may need a line.
- The domain's auto-renew, the uptime monitor and the Gmail filter (9.2–9.4).
- Cloudflare's AI-crawler setting, a dry run, then launch day (7): `LAUNCHED = true`, Search
  Console and Bing. The reviewing lawyer reads the legal pages in the weeks after.
- Before announcing beyond a small circle: Resend's paid plan (4.2). The announcement: end of 7.

---

## 0. Two-step sign-in on every account (owner; done 4.10)

Supabase, Cloudflare, Google (the account that owns the OAuth client), Resend (once created),
GitHub, MyNames. Israel's data-security regulations ask for adequate sign-in protection even at
the lightest level, and these accounts control the whole service.

## 1. The domain on Cloudflare (owner; waits for the registry)

1. Wait for Cloudflare's email: **inkognito.co.il is Active**. (If not by the evening after the
   change, ask MyNames whether the nameserver change to `ada` and `tim` reached the registry.)
2. **DNS → Records:** there should be no A, AAAA or CNAME for `inkognito.co.il` or `www` (the
   site's records are added by Pages in step 5). Keep any MX and TXT.
3. **Turn these off** (each would inject scripts our pages' security policy blocks, or send data
   to Cloudflare's analytics):
   - **Scrape Shield → Email Address Obfuscation: OFF.** It rewrites the `mailto:` links on the
     legal pages, and under our policy they would break.
   - **Web Analytics** (Analytics & Logs → Web Analytics, or Speed → Observatory → RUM):
     **disable** for the site. On free plans it can switch itself on, outside the EU.
     (4.10: its script did appear once the domain was attached, and the setting was not where
     these menus say. The pages now carry `no-transform`, which keeps Cloudflare's scripts out
     whatever the setting; checked live.)
   - Bot Fight Mode and Rocket Loader: leave **off** (the defaults).
   - **Browser Cache TTL.** The zone's default (4 hours) replaces the site's own "check again every
     time" on the public scripts (config.js, login.js, cloud.js…), so after a deploy a browser
     could run a new page with an old script. The owner's dashboard did not offer "Respect
     Existing Headers" (5.10), so it is solved in the build instead (7ad01d9). Every page names its
     public scripts and styles with a content hash (`config.js?v=a5ade2eb53`), so a new page always
     loads its own version. The tool's files under /app/ are `private`, which Cloudflare leaves
     alone.
4. **DMARC** (done with Email → DMARC Management): `_dmarc` is `v=DMARC1; p=none` with Cloudflare's own
   address for the reports, which are read there.
   Tighten to `quarantine` later, once reports are clean.
5. **Renewal:** every year, before the end date (9.2).

## 2. contact@inkognito.co.il → your Gmail (owner, 5 minutes)

Cloudflare → Email → Email Routing → **Onboard domain** → accept the records it adds (three MX
on the root, an SPF TXT, a DKIM TXT). Destination addresses → add your Gmail → click the link in
the email Cloudflare sends. Routing rules → custom address `contact` → send to that Gmail.
Test from a different account.

Replying *as* contact@ from Gmail ("Send mail as") is being retired by Google for outside
addresses (January 2027, maybe refused for new setups already). For now, reply from your own
Gmail; decide later between a mail program that sends through Resend, or Google Workspace.

The Gmail filter and the daily routine for this inbox: 9.4.

## 3. Resend, the sender of sign-in emails (owner, 15 minutes)

1. Sign up at resend.com, turn on two-step sign-in.
2. Domains → **Add domain → `inkognito.co.il`** (the root, so the sender is
   `noreply@inkognito.co.il`). Region: **Ireland (eu-west-1)**. Note: Resend stores its data
   (logs, the emails for 30 days) in the US whatever the region; the privacy page already says so.
3. DNS: click **Sign in to Cloudflare** to add the records automatically. Leave **Receiving
   OFF** (it would clash with Email Routing's MX). If adding by hand: names only (`send`,
   `resend._domainkey`), and any CNAME set to **DNS only** (grey cloud).
4. **Verify**. Usually minutes.
5. API Keys → create **two** keys, each **Sending access**, restricted to `inkognito.co.il`:
   one named `supabase`, one named `digest`. Each is shown once: paste it straight where it goes
   (steps 4.1 and 4.4), never into a chat.
6. Leave click and open tracking **off** (the default): tracking rewrites sign-in links.

## 4. Supabase (owner, 15 minutes; https://supabase.com/dashboard/project/cwsiranjlxbclmaqtucc)

1. **Authentication → Emails → SMTP Settings → Enable custom SMTP:**
   sender email `contact@inkognito.co.il` (switched from noreply@ on 5.10, so that a reply reaches
   the owner), sender name `InKognito`, host `smtp.resend.com`, port `465`, username `resend`,
   password = the `supabase` key. Save.
   (A Hebrew sender name, אינקוגניטו, may work; test it once before switching.)
2. **Authentication → Emails → Templates** (unlocked by step 1). Each body is a file in
   `supabase/templates/`, from its `<!DOCTYPE html>` line to the end, copied in an editor (never a
   terminal: it reverses Hebrew) and pasted into the Source view. Save each. Then leave them alone
   for weeks: Supabase advises changing sign-in emails rarely and all at once, while a new domain
   earns Gmail's trust (deliverability review 4.10; tests/mail_t.js holds what it settled).
   - **Confirm signup**: subject `אימות כתובת המייל לאינקוגניטו`, body `confirm-signup.html`.
   - **Reset Password**: subject `איפוס סיסמה לאינקוגניטו`, body `reset-password.html`.
   - **Change Email Address**: subject `אימות שינוי כתובת המייל לאינקוגניטו`, body `change-email.html` (from 0011; the link goes to both addresses).
   - **Magic Link**: subject `קישור כניסה לאינקוגניטו`, body `magic-link.html`. The sign-in page
     never asks for one (sign-in is Google, or an email and a password, 4.10); only the
     dashboard's "Send magic link" sends it, so its words do not assume the recipient asked.
   Then **Authentication → Sign In / Providers → Email**: minimum password length **8**, password
   requirements **none** (a "letters and digits" rule counts only English letters, so it would
   refuse a Hebrew password; length is what matters).
   Then **Authentication → Rate Limits → emails per hour**: raised to 100 for the whole site
   (done 4.10); every sign-up, resend and password reset counts. Resend's free plan also has a
   daily cap, and the sign-in page says so plainly when either cap is reached. **Move Resend to a
   paid plan before announcing** to more than a small circle (deferred by the owner, 5.10). The
   numbers are in `../notes/limits.md`.
   The templates were pasted again in their final versions on 8.10 (all four: the footer line, and the new Change Email Address).
3. **Authentication → URL Configuration** (done 4.10 with step 5.3, once https://inkognito.co.il/login
   opened; the pages.dev entry then deleted, so that no email can carry a pages.dev link again):
   Site URL `https://inkognito.co.il/login`, with `/login`: when a request names no return page
   (an email sent from the dashboard) or names one not on the list, Supabase sends the person to
   the Site URL, and the sign-in page is the one that reads the link. (The landing page passes
   such a link on as well.) Redirect URLs: add `https://inkognito.co.il/login` and
   `https://inkognito.co.il/login.html`. (Cloudflare serves `login.html` as `/login`, so the page
   asks Supabase to return to `/login`. Supabase accepts any path on the Site URL's host anyway.)
   Keep the 127.0.0.1 and localhost entries for testing.
4. **The daily sign-ups email** (done 5.10): the owner put the two secrets in Vault
   (`resend_digest_key`, the `digest` key from Resend, and `digest_to`). Claude enabled **pg_net**
   and applied `supabase/migrations/0006_signup_digest.sql`, and sent a test that Resend accepted.
   The email carries only the number of new sign-ups and a link to the admin page, at 08:00 Israel
   time on days after a sign-up. To redo it on a new project (with your values):
   ```sql
   select vault.create_secret('<the digest key from Resend>', 'resend_digest_key');
   select vault.create_secret('<your email address>', 'digest_to');
   ```
5. Check (already so): Authentication → Sign In / Providers → **anonymous sign-ins OFF**;
   Email → **Confirm email ON**, **Secure email change ON**, email OTP expiration **900** (the
   confirmation and password links last 15 minutes; the sign-in page sends a new one).
6. **Adding someone by hand** (Authentication → Users → Add user → Create new user): the password
   typed there is dropped the moment the address is confirmed, "Auto Confirm" included. Supabase
   confirms such an account with an update, and 0008 drops any password set before that update.
   The person then signs in with Google, or sets a password with "forgot password".

## 5. Cloudflare Pages: put the site live (owner with Claude; done 4.10, `www` 5.10)

From the repository folder, on branch `inkognito`:

```
npm install
npm run build:hosted
npx --yes wrangler@4.147.0 login
npx --yes wrangler@4.147.0 pages project create inkognito --production-branch=main
npx --yes wrangler@4.147.0 pages deploy dist --project-name=inkognito --branch=main
```

(`functions/` is picked up from the current folder. Cloudflare gave the project the address
`inkognito-4f1.pages.dev`, which can never change.)

1. Pages project → Settings → **Runtime → Fail closed.** Important: when the free plan's daily
   function requests run out, the default "fail open" serves the app's files *without the gate*.
   Fail closed shows an error page instead.
2. Test on `https://inkognito-4f1.pages.dev` (Claude runs these): the landing page, `/login`,
   sign in, the app opens, the admin page, and the gate probes:
   `curl -si https://inkognito-4f1.pages.dev/app/` → 302 to `/login.html`, and the same for
   `/app%2Fsupport.js`, `/%61pp/support.js`, `//app/support.js`, `/APP/support.js`,
   `/fonts/..%2Fapp%2Fsupport.js`. Anything that returns 200 is a stop.
3. Pages → Custom domains → **Set up a domain → `inkognito.co.il`**. Wait for Active.
   (Done early, 4.10, before the launch: the first sign-in emails went to Gmail spam with
   SPF, DKIM and DMARC all passing. A day-old domain with no website, and links to pages.dev. On
   the real domain the links match the sender. Until launch the build keeps it out of search
   engines: `LAUNCHED = false` in scripts/build-hosted.js. Supabase URL Configuration, step 4.3,
   goes with it.)
4. `www` (done 5.10): a **Bulk Redirect** (www.inkognito.co.il → https://inkognito.co.il, 301,
   keeping path and query) plus a proxied DNS record `A www 192.0.2.1`. www is not attached to
   Pages. Checked live: `https://www.inkognito.co.il/privacy?x=1` and `http://www…/login` answer
   301 to the same path on https://inkognito.co.il.
5. Repeat the checks on `https://inkognito.co.il`, and view the source of `/privacy` to confirm
   nothing was injected (no `email-decode`, no `beacon.min.js`). Every public script and style the
   pages name carries `?v=` and its content hash (1.3), and each of those addresses answers 200.
6. **To undo a deploy:** Cloudflare keeps every deployment (9.1).

## 6. Google sign-in for everyone (owner; done 5.10)

Google Cloud → Google Auth Platform → **Branding:** homepage `https://inkognito.co.il`, privacy
policy `https://inkognito.co.il/privacy`, authorized domain `inkognito.co.il` (if Google asks
you to prove ownership, it gives a TXT record to add in Cloudflare DNS). No logo (a logo means a
review of weeks). Then **Audience → Publish app**. Done 5.10: In production, and tested with an
account that was not a test user.

Only the basic scopes (openid, email, profile), so publishing needs no review. But until Google
verifies the brand, its sign-in screen names the app by the address Google returns to:
"continue to cwsiranjlxbclmaqtucc.supabase.co" (Supabase's docs: "does not inspire trust").
Brand verification alone gets stuck on that address (Google's checker sees supabase.co, not the
homepage's name). The fix is a Supabase custom domain, e.g. `auth.inkognito.co.il` (a paid add-on
on the Pro plan), then brand verification. Decide before announcing widely: lawyers will see that
address on the Google screen.

Checked 5.10:
- **Cost:** Pro is $25 a month, and the custom domain $10 a month more (supabase.com/pricing).
- **Before verification:** Google names an unverified app by the address it returns to. With the
  custom domain, the screen says `inkognito.co.il` as soon as the domain is set up. Brand
  verification can then make it say the app's name.
- **Our own sign-in flow on inkognito.co.il would avoid the cost, but isn't worth it.** Google
  discourages the browser-only way (the "implicit flow"). The other ways either load Google's
  script on the sign-in page, or need a server that holds the Google client secret.

## 7. Before announcing (owner + Claude)

- Settled on 4.10: the courts clause (the competent courts in Israel, not exclusive), a narrow
  liability clause (no indirect damage, direct capped at ₪100 while free), the usage log only
  with active consent (asked when the first document is sent), the daily email as a count.
- Left for the lawyer: whether the accessibility rules apply at all (small-business exemptions),
  and the transfer basis for the US processors.
- The database definitions document (מסמך הגדרות מאגר): drafted for you outside the repository
  (`../notes/database-definitions.he.md`); keep it, and review it every year by
  31 December.
- Search engines (done 4.10): the home, privacy, terms, accessibility, security and help pages and the four guides are indexable
  under their inkognito.co.il addresses (canonical links, sitemap.xml); the tool, the demo, and the
  admin, sign-in, what's-new, account-deleted and 404 pages, and every pages.dev copy, are kept out. **On launch day, Claude sets
  `LAUNCHED = true` in scripts/build-hosted.js, builds and deploys**: until then the whole
  domain sends `X-Robots-Tag: noindex`. After launch, add the site in Google Search Console and
  submit `https://inkognito.co.il/sitemap.xml`. (The three step screenshots
  show no product name or version, so the rename needs no new ones.)
- Done 6.10: the GitHub Pages address forwards here (docs/ROLLBACK.md).
- **Supabase Pro** ($25 a month) matters beyond Google's screen: the free plan keeps no backups,
  and Pro also turns on leaked-password protection (8). Moved before launch by the owner (9.10). A free
  project also pauses after a quiet week, and sign-in and the tool would stop until it is
  restored in the dashboard. So since 5.10 the database asks its own API one tiny question every
  four hours (0010, `public.ping()` with the site's public key). If that ever stops, Supabase
  still emails the owner a week before it pauses.
- From the night review (5.10), decided by the owner on 5.10:
  - **The site's code on GitHub:** publish the `inkognito` branch, after a scan for anything
    private (done: nothing secret or personal; the scan's small points are fixed in this file).
  - **Mail to contact@ is kept 12 months** (privacy page, section 6). Once a month, in Gmail (9.4).
  - **The tool speaks to its users in the plural** (v59, PR #77; tests/address_t.js keeps it so).
    The site's own pages were already neutral.
- **One database migration: applied 5.10.** Three findings from the night review, each low on
  its own:
  - **Storage has no byte budget.** One account may store about 39 MB of logs a day (100 logs of up
    to 384 KB). The free plan's 500 MB would then fill in about 13 days, and the database goes
    read-only. The fix: one size cap per call, a daily byte budget per account, and a daily cap
    across all accounts.
  - **The first person to register an address sets its name for good.** A stranger can sign up
    with someone's address and a made-up name. The real owner keeps that name in their account
    panel and on the admin page. The fix: take the name only from Google's identity.
  - **Unconfirmed sign-ups count as users.** An address that was never confirmed shows on the
    admin page as "active" and counts in the totals and the daily email. The fix: create the
    profile when the address is confirmed.

  Written as `supabase/migrations/0009_budget_names_confirmed.sql` (5.10), with an account's logs
  capped at 250 KB a day and the service's at 700 KB, and what its two reviews added: sign-up
  metadata over 4 KB is emptied, sign-ups never confirmed are deleted after 7 days (privacy page,
  section 6), and a Google identity that did not vouch for an address goes when the address is
  confirmed.
  Applied 5.10 by Claude:
  - **The preflight first** (counts only): nothing to stop on, both privileges present, no
    profile to remove and no name to change, 2 Google identities that both vouched, 3 accounts,
    0 logs, the database 11 MB.
  - **Then 0009 in one go.** Its 13 functions match the repository's byte for byte.
  - **Then the live checks.** `budget_names_smoke.sql`, confirm, consent, delete, hardening,
    retention and smoke each printed its expected line and left nothing behind. privileges.sql
    shows the 13. The security advisor shows nothing new.
  - **Still to do:** one real email sign-up and one real Google sign-up, in the owner's full test.
  If a sign-up or a confirmation fails afterwards, `supabase/rollback/0009_restore_signups.sql`
  makes them work again at once; `supabase/rollback/0009_full.sql` goes back to 0008.

### The announcement (owner, after launch day; then 10 minutes a week)

- **Who hears first:** a small circle. First the lawyer the tool was built for (its first
  user), then a few lawyers who already feel the problem: they redact by hand, work on family,
  minors', medical or criminal files, or have clients who forbid AI. Ask each of them for one
  line of feedback after a week. Keep the circle small until Resend's paid plan (4.2). The free
  plan sends 100 emails a day, and every sign-up, resend, password reset, email change (two
  emails), account deletion and morning sign-ups email counts toward that.
- **The reason to share:** the plain-language guide to the Bar's AI opinion 60/24
  (`guide-bar-opinion-60-24`, drafted 10.10 on the review page). It waits for your choices,
  then for the reviewing lawyer to check the three sentences that are our interpretation. The
  message links to the guide, and the guide links to the tool. There is room for it:
  `_routes.json` holds 84 of Cloudflare's 100 rules since 11.10, and a page takes one.
- **Each week:**
  - Cloudflare → inkognito.co.il → **Analytics** → **Traffic**: requests and unique
    visitors, counted at Cloudflare's edge (free, no script, no cookie). Crawlers are
    included, and the two uptime monitors add about 1,150 requests a day.
  - Three numbers from the admin page:
    - «נרשמו ב־7 הימים האחרונים»
    - «פעילים ב־7 הימים האחרונים»
    - «מסמכים עד היום»
  - Each morning after a sign-up, the sign-ups email (4.4).

  Write the numbers down each week: they show whether lawyers feel the problem, before more
  features are built.

Cloudflare's **Web Analytics** stays off (1.3):
- **Why it would not load.** It is a script from `static.cloudflareinsights.com`, and every
  page's security policy refuses it (`script-src 'self'`). `no-transform` also stops
  Cloudflare's automatic injection ("the Beacon script will not be automatically injected",
  Cloudflare's Web Analytics FAQ). For the switch on the Pages project, Cloudflare says only
  that the snippet is added on the next deployment, so there the security policy is what stops
  it.
- **Why it stays off.** Cloudflare says Web Analytics "does not collect or use your visitors'
  personal data", but turning it on would still break two promises:
  - the privacy page uses information «רק למטרות האלה», and says
    «שימוש במידע למטרה חדשה ייעשה רק בהסכמה מפורשת מראש» (section 4);
  - the security page says «הכלי באתר הזה לא פונה לאתרים אחרים» (section 1).
- **What turning it on would take:** a new security policy, new lines in sections 3–5 of the
  privacy page and in the security page, and the 14 days' notice of the privacy page's
  section 8.
- **The Traffic numbers** need no new line, on our reading: they are totals of the requests
  Cloudflare already handles (sections 3 and 5), and no person can be identified in them. Add
  that reading to the reviewing lawyer's list.
- **To check that it is off:** Workers & Pages → `inkognito` → **Metrics** shows **Enable**
  under Web Analytics. (No beacon was on the live pages when checked on 10.10.)

## 8. Later, when it grows

- Done 5.10 (4ae7e5f): the admin page reads every user and every log page by page, in a fixed
  order, up to the count the database gives. It no longer stops silently at Supabase's
  1,000-row page.
- The tool's page (425 KB) goes out uncompressed. `no-transform`, which keeps Cloudflare's
  scripts out, also stops Cloudflare compressing it; gzipped it is about 117 KB. The gate can
  compress it itself (`content-encoding: gzip`). Check it live with a session.

- At 10,000 users the data-security level rises from "managed by an individual" to "basic":
  a written security procedure, access management, and processor terms.
- On Supabase's paid plan: Authentication → Email → **Prevent use of leaked passwords**
  (HaveIBeenPwned). The security advisor lists it as off; the free plan cannot turn it on.
- Supabase's performance advisor (5.10): two policies call `auth.uid()` once per row (`own
  profile` on profiles, `anyone signed in reads settings` on app_settings), and four call
  `is_admin()` the same way (`own profile` and the owner's three; on the log download, once per
  log). Write them as `(select auth.uid())` and `(select public.is_admin())` in a migration once
  there are many users; at a few hundred it makes no difference. (Left out of 0009: changing a
  policy locks its table against every reader, the gate's included, for the migration's moment.)
- **Logs refused (0009).** If logs stop arriving and Supabase's API logs show 429 on `submit_log`,
  see who used the last 24 hours (SQL editor):
  `select user_id, count(*), sum(pg_column_size(log) + coalesce(pg_column_size(leaks), 0) + 256) from public.usage_logs where created_at > now() - interval '1 day' group by 1 order by 3 desc;`
  Blocking an account on the admin page gives its share of the service's day back at once; its
  logs go with `delete from public.usage_logs where user_id = '<id>';`. On Pro (8 GB), the two
  numbers in `private.log_limit` can be ten times larger and still leave room.
- **Refused logs are not counted** (review of 0009). An account that said yes to the log can send
  logs that fail the shape check as fast as it likes, each costing the server up to a few tenths
  of a second; the limits count only stored logs. If the site slows down and the API logs show
  many `submit_log` 400s from one account, block it. A later migration can count refusals.
- **Sign-in sessions** stay until sign-out on the free plan, one per sign-in (the preflight of 0009
  shows their table's size). On Pro: Authentication → Sessions, a time-box.
- Before charging: open the tax files; the consumer-law identity details (name, ID, address)
  and the 14-day cancellation right may apply; marketing emails need opt-in and the word
  "פרסומת".

## 9. Keeping it running (owner + Claude)

1. **Undo a bad deploy** (owner, 2 minutes). Roll back first, look for the cause after.
   Workers & Pages → `inkognito` → **Deployments** → **All deployments** → the **⋯** menu of the
   last good one → **Rollback to this deployment** → confirm. The switch is instant. Any
   production deployment can be chosen, including a newer one again later (Cloudflare's Pages
   docs, "Rollbacks"). The whole deployment comes back: pages, tool, gate and headers. Each row
   names the commit it was built from and has its own address
   (`https://<id>.inkognito-4f1.pages.dev`, kept out of search engines), so you can open the old
   one first. Then Claude runs the live checks (5.2, 5.5). Open tabs keep their version until
   refreshed, and saved cases are not touched.
   Do this once, before it is ever needed: open the **⋯** menu of an older row, check that it
   offers **Rollback to this deployment**, and close it. (Cloudflare's page talks about
   production deployments in general, and ours are uploaded with wrangler.)

   It does not undo:
   - **The database.** Migrations stay applied. 0009, 0011 and 0012 have undo files in
     `supabase/rollback/`, and Claude runs the matching one with your go-ahead. Before you go
     back past a migration (the last is 0012, 8.10), Claude checks that the older site works
     with it.
   - **Settings outside the deployment:** Supabase (templates, URL Configuration, SMTP),
     Cloudflare DNS, the `www` redirect, Email Routing, and the project's own settings (Fail
     closed, the domain).
   - **The code.** The `inkognito` branch still holds the bad commit, and the next deploy would
     bring it back. Claude reverts it first (through a PR on `main` when it came from there).
   - **After launch day,** a deployment from before launch puts `noindex` back on every page
     (`LAUNCHED = false`). Go back no further than launch, or let Claude rebuild the older
     version with `LAUNCHED = true`.

   **Claude rebuilds an older version** (15 minutes) when the one wanted is not in the list, or
   needs a change:
   - `git tag --list "live/*"` lists v48 to v62: the old public tool's tags, for the GitHub
     Pages address (docs/ROLLBACK.md). They hold no `site/`, `functions/` or
     `scripts/build-hosted.js`, so they cannot build this site.
   - Since 11.10 Claude tags each inkognito.co.il deploy once its live checks pass, `ink/vNN.k`
     (`ink/v73.3`, `ink/v73.4`; `ink/v73.4-2` for a second deploy of the same version), and
     pushes the tag. Earlier deploys have none: use the commit shown in the deployment's row.
     Older rows may name commits the repository no longer has: find the same change by its date
     and title.
   - Claude builds it in a folder beside the repository, so the repository folder stays as it
     is. The deploy runs from that folder's root, so the gate in `functions/` goes too. From the
     repository folder (a commit hash can stand in for the tag):
     ```
     git fetch --tags origin
     git worktree add ../redeploy ink/v73.4
     cd ../redeploy
     npm ci
     npm run build:hosted
     npx --yes wrangler@4.147.0 pages deploy dist --project-name=inkognito --branch=main
     cd -
     git worktree remove ../redeploy
     ```
     Keep `--branch=main`. Without it, wrangler takes the branch name from the folder, which is
     a tag here, and the upload becomes a preview instead of production. Then the live checks
     (5.2, 5.5).

2. **The domain's renewal** (owner, 10 minutes now, then one reminder a year). inkognito.co.il
   was registered through MyNames on 3.10.2026 for one year: the registry's WHOIS shows
   `assigned: 03-10-2026`, `validity: 03-10-2027` and the registrar Drubit Raid LTD
   (mynames.co.il). Renewing is entirely the holder's job: neither the registry nor MyNames
   promises a reminder (ISOC-IL's registration rules, 17.3; MyNames' terms, 7.5).
   - In MyNames, turn on **«חידוש אוטומטי»**. MyNames calls it only a helper (terms 7.5), so
     check afterwards that the renewal went through. Claude can read the new `validity` in the
     registry's WHOIS.
   - **«הגדרות חשבון»** → a payment method valid past 3.10.2027. MyNames is paid in advance
     (terms 7.2), by card or from «קרדיט» loaded on the account (7.2.1). See which one the
     renewal takes, and keep it able to pay: a failed or cancelled payment loses the domain
     (terms 7.9.2).
   - A calendar reminder for 3.9.2027, a month before the end. If it has not renewed by then,
     renew by hand. Renewal opens on 3.7.2027, three months before the end, and the new period
     counts from the old end date, so renewing early loses nothing. Up to five years can be
     bought at once (ISOC-IL 17.1).
   - The same week, Claude moves `Expires` in `site/.well-known/security.txt` (now 2027-10-06)
     to just under a year from that day, e.g. 2028-09-01 if done on 3.9.2027.
     `tests/hosted_t.js` fails once the date passes, and also while it is more than 366 days
     ahead (RFC 9116 asks for less than a year).

   If it lapses, the registry may suspend the name without notice, which takes it out of the
   DNS. It may cancel the name once a 30-day grace period has passed, and may extend that grace
   by up to 90 more days (ISOC-IL 4.6 and 17.3). Then:
   - the site, the tool and the demo stop answering, and the old GitHub Pages address forwards
     to nothing;
   - sign-in emails can no longer be checked against the domain's records, so they land in spam
     or are refused, and their links lead to https://inkognito.co.il/login; mail to contact@
     bounces (its MX records are on the domain);
   - Google sign-in passes Google and Supabase, then sends the person to
     https://inkognito.co.il/login, which is gone;
   - about a week later, Cloudflare deletes the zone. A free zone whose nameservers are gone
     becomes "Moved" and is deleted 7 days after. Every DNS record from steps 1–5 goes with it:
     Resend's, Email Routing's, DMARC, `www`;
   - once the name is released, whoever takes it gets contact@'s mail. The sign-in links would
     also hand them live sessions, because the sign-in uses the implicit flow, which puts the
     tokens in the address. If the name is ever lost, remove it from Supabase's URL
     Configuration (4.3) at once.

3. **An alert when the site is down** (owner, 10 minutes). UptimeRobot's free plan has 50
   monitors, a check every 5 minutes, keyword checks and email alerts (uptimerobot.com/pricing,
   uptimerobot.com/keyword-monitoring). Its terms (modified 24.6.2026) say "UptimeRobot is
   available for any use, including commercial and business use", while its pricing page calls
   Free "Good for hobby and non-profit projects". Look again before charging.
   - Sign up with your Gmail (the one contact@ forwards to): alerts go there.
   - **New monitor**, type **Keyword**: URL `https://inkognito.co.il/`, keyword
     `"alternateName":"InKognito"`, including the quotes. It is in the home page's structured
     data, and on no Cloudflare error page or parked-domain page. Down when the keyword
     **does not exist**, every **5 minutes**, by email.
   - A second monitor for the gate, which the home page skips: type **Keyword**, URL
     `https://inkognito.co.il/app/`, keyword `login.js`, **Follow redirections** left on (the
     default). With no session, the gate sends that address to the sign-in page, which loads
     `login.js`. Cloudflare's error page (Fail closed, once the free daily requests are spent)
     or a deploy that left the gate out would show something else. This monitor uses 288 of the
     100,000 free daily requests.
   - Test once: change the first keyword to `"alternateName":"InKognitoX"`, wait for the email
     (within 10 minutes), check that it did not go to spam, then change the keyword back.
   - Neither monitor sees Supabase: without a session, the gate never asks it. On
     https://status.supabase.com/, use **Subscribe to updates** to get emails (the project is
     in eu-central-1, Frankfurt). For a paused project, Supabase sends its own emails, a week
     before and when it happens.

   When it fires, open the address yourself, on the phone over mobile data too. Then check:
   - https://www.cloudflarestatus.com/: an incident at Cloudflare (Pages, DNS) is theirs to fix;
   - Workers & Pages → `inkognito` → **Deployments**: was there a deploy just before? Roll it
     back (9.1);
   - if only the gate's monitor fired, the free daily requests may be spent; they come back at
     midnight UTC (03:00 in Israel in summer, 02:00 in winter);
   - if the name does not resolve: the domain (9.2), and Cloudflare → inkognito.co.il →
     **Overview**;
   - if people write that the tool shows «השירות לא זמין כרגע», the gate could not reach
     Supabase: check https://status.supabase.com/ and the Supabase dashboard (for a paused
     project, **Resume project**);
   - if people write that the sign-in email does not come: that email's status in Resend's
     dashboard, and https://resend-status.com/. The free plan's 100 emails a day may be
     spent (4.2).

   Then tell Claude when the alert came; Claude runs the live checks (5.2, 5.5).

4. **The support inbox** (owner, 5 minutes now, then a look every working day). Mail to
   contact@inkognito.co.il reaches your Gmail through Cloudflare (2). The site promises an
   answer within two working days: «ונענה תוך שני ימי עסקים» in the home page's FAQ and on the
   help page, «נענה תוך שני ימי עסקים» on the security page. It also promises an answer to a
   privacy request within 30 days (a refusal to show someone their data, with the reason,
   within 21), and an accessibility fault fixed within 60 days.
   - One Gmail filter: search box → **Show search options** → **To**
     `contact@inkognito.co.il` → **Create filter** → **Star it**, **Apply the label**
     `InKognito` (New label…), **Never send it to Spam**, **Also apply filter to matching
     conversations** → **Create filter**. DMARC reports do not come to this inbox; they are in
     Cloudflare → Email → **DMARC Management** (1.4).
   - Every working day, check the `InKognito` label. Unstar a mail once it is answered, so a
     star means waiting. Act only on a request sent from the account's own address:
     - a deletion: the admin page → «חיפוש לפי שם או מייל» → «מחיקה»;
     - a copy of someone's data: «ייצוא» on the admin page, or they download it themselves
       with «הורדת המידע שלי» in the account panel;
     - a security report: tell Claude the same day.
   - Once a month (7), delete old mail:
     - Search `to:contact@inkognito.co.il older_than:11m`, tick the box above the list (then
       **Select all conversations that match this search** if there is more than one page),
       and delete. Run monthly, `11m` keeps nothing past the privacy page's 12 months. With
       Gmail's conversation view on (the default), your replies go too; the privacy page
       promises the same 12 months for them.
     - Then search `in:trash to:contact@inkognito.co.il`, select all → **Delete forever**.
       Otherwise Trash keeps them 30 more days.
     - Set a calendar reminder for the first Sunday of each month.
