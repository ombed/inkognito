/* The same browser checks in Safari's engine (WebKit) and Firefox:  npm run test:browsers

   Every other run, CI included, is Chrome only (playwright.config.js). The first run in the other two
   (10.10) found what Chrome never showed: the model never loaded in Firefox, a focused field hid under
   the header in both, and Firefox laid every paragraph of a restored answer out in one direction. So
   this runs before a release that changes the page, and it needs both engines once on the machine:
   npx playwright install webkit firefox

   Where an engine cannot do what a check needs, the check says so where it stands (browserName):
   only Chromium prints a PDF, a paste made by a script carries no text in Firefox, and Safari's Tab
   skips links. */
const { devices } = require("@playwright/test");
const base = require("./playwright.config.js");

module.exports = {
  ...base,
  projects: [
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
};
