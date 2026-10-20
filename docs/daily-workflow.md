# Daily workflow

How to use icc-toolbox on a normal working day: start up, the recipes for the tasks that come up most, and how to wrap up. For installation and the full command reference, see the [README](../README.md).

> **Shells:** every `npm run` command works the same in PowerShell, Git Bash and cmd. The only exception is the multi-line `batch` input. Both versions are shown where it comes up.

---

## Start of the day

**1. Go to the dealer you're working on.**

```bash
git checkout <dealer-branch>          # e.g. camp-site-rv-inc
```

New dealer? Create its branch first, either with `/set-up <Dealer Name> <build-site URL>` in Claude Code or [by hand](../README.md#1-create-a-branch-for-the-dealer).

**2. Start the injector and leave it running.**

```bash
npm run dev
```

Chrome opens on the dealer site with `styles/home.css` applied. This terminal is now the injector's log: hot reloads, CSS warnings and errors show up here. **Open a second terminal** for everything else.

**3. Reset yesterday's leftovers** (they're stored outside git, so they carry over between dealers):

```bash
npm run css -- reset      # every stylesheet back on, real window size (no breakpoint emulation)
```

You're ready. Keep `styles/home.css` open in your editor.

---

## Recipes

### "Change how this thing looks"

The most common task. Find the element, see why it looks the way it does, try a fix live, then save it.

```bash
npm run dbg -- find "Browse Inventory"               # 1. which element? (gives you a selector)
npm run dbg -- box ".home-search .btn"               # 2. size, spacing, display, its parents
npm run dbg -- why ".home-search .btn" padding       # 3. which rule sets it now, and from where
npm run dbg -- preview ".home-search .btn{padding:12px 32px}"   # 4. try it, without touching a file
npm run dbg -- crop ".home-search" --at 375,1200     # 5. screenshot it on mobile + desktop → ./debug/
npm run dbg -- preview --save styles/home.css        # 6. looks right? append it to home.css
```

Then open `home.css` and put a section comment above the block that `--save` just added at the end:

```css
/*
=====
Home Search
=====
*/
.home-search .btn {padding: 12px 32px;}
```

You can also skip `preview` and type straight into `home.css`. It hot-reloads on every save. `preview` is handy for trying a few variants without leaving junk in the file.

**What `why` tells you about the override you need:**

| `why` says the winner is… | Then |
|---|---|
| a site rule with a weaker or equal selector | a scoped selector at the end of `home.css` wins on its own |
| a site rule with a stronger selector | add **one** level of specificity (`#site-header .logo img`), not five |
| a site rule with `!important` | yours needs `!important` too |
| `style attribute` | only `!important` beats it, or change the markup (see below) |
| `styles/home.css:<line>` | it's already yours: edit that rule instead of adding another |

**House rules for `home.css`:** new rules go at the **end**, each section starts with the comment above, no other comments, no `@import`, use the brand variables (`var(--primary-bg-color)`) instead of hex values, prefer `display: flex`, and use `text-decoration: none` on link hover. Full list: [AGENTS.md → CSS Style Rules](../AGENTS.md#css-style-rules).

**After saving,** glance at the injector terminal. `WARNING home.css:212 invalid declaration "widht: 100%"` means Chrome dropped that line.

### "It's broken on mobile / tablet"

```bash
npm run dbg -- check ".home-hero h1"        # visible? how wide? at every Bootstrap breakpoint
npm run dbg -- bp xs                        # make the window behave like a 375px phone
```

`bp` stays on while you browse and edit, so you can fix the mobile CSS with the page staying at that width. Breakpoints: `xs` 375, `sm` 576, `md` 768, `lg` 992, `xl` 1200, `xxl` 1400, or any width with `npm run dbg -- resize 820`. **Turn it off when you're done:** `npm run dbg -- bp reset`.

Screenshot several widths in one go to compare before/after:

```bash
npm run dbg -- crop ".home-hero" --at 375,768,992,1400
```

### "Is it our CSS or the site's?"

```bash
npm run css -- list              # what's loaded, on/off
npm run css -- off home.css      # turn OUR CSS off. Still broken? It's the site's.
npm run css -- on home.css
npm run css -- remote-off-all    # turn ALL the site's CSS off (page goes bare)
npm run css -- remote-on-all
npm run css -- off "*theme*.css" # turn off one site stylesheet by name pattern
npm run css -- reset             # back to normal
```

Nothing is deleted. These only switch stylesheets on and off in the open page.

### "The markup itself has to change"

When CSS can't do it (an element is missing, nested wrong, needs a class), try the HTML change live, then hand the final markup to the CMS. The toolbox never edits the CMS.

```bash
npm run dbg -- html ".home-welcome"                       # current markup
npm run dbg -- inner ".home-welcome" @snippets/welcome.html   # preview new inner HTML from a file
npm run dbg -- replace ".home-welcome" @snippets/welcome.html # …or replace the whole element
npm run dbg -- restore                                    # undo all HTML previews
```

Writing the HTML in a file under `snippets/` (and passing it with `@`) is easier than quoting it on the command line, and it's what you'll paste into the CMS.

**Use the CMS shortcodes, never hardcoded dealer info:**

```html
<a href="tel:[#DealerPhoneNoFormat]">[#DealerPhone]</a>
<p>Welcome to [#DealerName] in [#DealerCity], [#DealerState].</p>
<a class="btn btn-primary" href="[#CreditAppUrl]">Get Pre-Approved</a>
```

The live preview shows the literal `[#DealerPhone]` text. That's expected: the CMS fills it in when the page renders. All shortcodes, including per-lot ones: [CMS shortcodes](cms-shortcodes.md).

### "Something else on the page stopped working"

```bash
npm run dbg -- errors
```

Lists console errors, exceptions and failed requests since the last page load. On these sites one failing script can silently stop carousels or tabs elsewhere on the page, so check here first when something unrelated breaks.

### "The mockup says 48px"

```bash
npm run clamp -- 48   # clamp(43.2px, 2.5vw, 48px): font sizes, so they scale with the screen
npm run vw -- 120     # 6.25vw: widths/spacing against a 1920px-wide mockup
npm run vh -- 540     # 50vh: heights against a 1080px-tall mockup
```

Use `clamp` for font sizes instead of a px value per breakpoint. If the mockup doesn't spell out font weight / size / line-height, ask the designer rather than measuring pixels.

### "These images need uploading"

Keep images **outside the repo** (e.g. in Downloads):

```bash
npm run img:compress -- "C:/Users/me/Downloads/dealer-photos"   # → .../compressed/, each ≤ 1 MB
npm run img:png -- "C:/Users/me/Downloads/dealer-photos"        # → .../png/, if the site needs PNG
```

Originals are never touched. Upload the contents of `compressed/` (or `png/`). Converting to PNG makes files bigger, so to get both, convert first and then compress the `png` folder.

### New page, new form, reviews widget

These are bigger jobs with a step-by-step skill each. In Claude Code:

| Task | Command |
|---|---|
| Move a page from the dealer's old site | `/content-migration <old-page-url>` (writes `snippets/pages/<page>.html`) |
| Build or change a lead form | `/custom-forms` (writes `snippets/forms/<form>.html`) |
| Move the Kenect reviews carousel | `/kenect-reviews <old-page-url>` |

Without Claude Code: start new pages from [snippets/pages/base.html](../snippets/pages/base.html) (plain Bootstrap 3), and read the matching `SKILL.md` in `.claude/skills/` for the rules each one follows.

---

## Switching dealers during the day

```bash
# in the injector terminal
Ctrl+C
git checkout <other-dealer-branch>
npm run dev
# in the second terminal
npm run css -- reset
```

Commit (or `git stash`) what you have first. Git won't switch branches with uncommitted changes that conflict.

---

## End of the day (or after each fix)

Commit each fix on its own, on the dealer branch:

```bash
git add -A
git commit -m "fix: center the reviews carousel on mobile"
```

Prefixes the team uses: `fix:` for a correction, `feat:` for something new on the site, `chore:` for setup/config. One fix per commit makes it easy to see what changed and to undo one thing.

Then take the work to the CMS: the finished `styles/home.css` and any markup from `snippets/`.

Push the branch if you want it backed up or shared: `git push -u origin <dealer-branch>`.

---

## Do / Don't

| Do | Don't |
|---|---|
| Work on the dealer's own branch | Commit dealer work to `master` |
| Keep each dealer branch separate | Merge dealer branches into `master` or into each other |
| Add new CSS at the end of `styles/home.css` | Create new CSS files or insert rules higher up in `home.css` |
| Run `why` before writing an override | Pile on selectors or `!important` "just in case" |
| Use brand variables and CMS shortcodes | Hardcode colors, phone numbers or addresses |
| Fix it in CSS first, then HTML, JS only as a last resort | Reach for JS (`"scripts": true`) for something CSS can do |
| Keep images outside the repo | Commit photos or screenshots (`debug/` is git-ignored for a reason) |
| Stay on the dealer's site in the injector's Chrome window | Use that window for other sites. `css`/`dbg` look for the dealer's tab. |

---

## Cheat sheet

```text
START       git checkout <dealer>  →  npm run dev  →  npm run css -- reset

FIND        dbg find "<text>"        dbg box "<sel>"        dbg html "<sel>"
WHY         dbg why "<sel>" <prop>   dbg rules "<sel>"      dbg styles "<sel>"
TRY         dbg preview "<css>"      dbg set "<sel>" <prop> <value>     dbg preview reset
SAVE        dbg preview --save styles/home.css   (then add the section comment)
HTML        dbg inner|replace "<sel>" @file.html   dbg restore
SCREENS     dbg screenshot   dbg fullpage   dbg crop "<sel>" --at 375,1200   dbg outline "<sel>"
WIDTHS      dbg bp xs|sm|md|lg|xl|xxl|reset   dbg resize <w>   dbg check "<sel>"
BROKEN?     dbg errors
OURS/THEIRS css list   css off|on <file|pattern>   css remote-off-all|remote-on-all   css reset
UNITS       clamp <px>   vw <px>   vh <px>
IMAGES      img:compress <folder>   img:png <folder>
DONE        git add -A  →  git commit -m "fix: …"

(dbg = npm run dbg --    css = npm run css --    units/images = npm run <name> --)
```

Several `dbg` commands at once, over one connection:

```bash
# Git Bash
npm run dbg -- batch <<'EOF'
find "Reviews"
why ".reviews img" width
crop ".reviews" --at 375,1200
EOF
```

```powershell
# PowerShell ('@ must start its line)
@'
find "Reviews"
why ".reviews img" width
crop ".reviews" --at 375,1200
'@ | npm run dbg -- batch
```

Stuck? See [README → Troubleshooting](../README.md#troubleshooting).
