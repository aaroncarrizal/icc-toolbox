---
name: kenect-reviews
description: Move a dealer's Kenect testimonials/reviews widget from their old website to the new ICC site. Use when the user shares an old-site URL that has the Kenect reviews carousel (or says "Kenect", "testimonials widget", "reviews carousel") and wants it on the new site. Finds the data-publicId in the old page, builds the CMS-safe loader script and container div, previews the widget live, and hands the user the code plus where to paste it.
---

# Kenect Reviews Widget

Input: **the old site's URL** that shows the Kenect reviews carousel. Nothing else is needed. If the user didn't give a URL, ask for it.

The CMS doesn't allow `<script>` tags inside page content (security and Cookie Consent Management), so the widget is added in two parts:

- a **loader script** in the page's **Page Footer Scripts** (Developer tab)
- an empty **container div** in the page content

This tool never edits the CMS. Build the code, preview it live, then hand it to the user.

## 1. Find the public ID

Fetch the old page with `curl` (never navigate the debug tab cross-origin; it breaks the injector) and look for the Kenect script:

```bash
curl -sL --max-time 30 "<old-url>" -o debug/old-page.html
grep -oiE "<script[^>]*kenect[^>]*>" debug/old-page.html
```

The script looks like this:

```html
<script async src='https://review-carousel-resource.kenect.com/reviews_widget.min.js' data-publicId='aWlHAHyZ9WmNzv_-QaUBWT4' type='text/javascript'></script>
```

- The **public ID** is the `data-publicId` value: letters, numbers, `_` and `-`. Copy it exactly; it's case-sensitive.
- Keep the `src` as found. If it isn't `review-carousel-resource.kenect.com/reviews_widget.min.js`, use whatever the old site uses.
- **Not found on the page you were given?** Try the homepage and a `/testimonials`-style page, and grep for `kenect` in general (it may sit in a tag manager or a differently named attribute). If it still isn't there, tell the user and ask for the page where the widget is visible. Never invent an ID.

**Note where it sits.** Look at the elements just before the script (or before a `#kenect-review-carousel` div) in the old page. That tells you where to place the container on the new site: usually the homepage, after the welcome section.

## 2. Build the code

**Loader script**, for **Page Footer Scripts** on the Developer tab of the page that shows the widget. Only replace `PUBLIC_ID`:

```html
<script>
    function loadReviewsWidget() {
        const script = document.createElement('script');
        script.src = 'https://review-carousel-resource.kenect.com/reviews_widget.min.js';
        script.async = true;
        script.type = 'text/javascript';
        script.setAttribute('data-publicId', 'PUBLIC_ID');
        document.getElementById('reviews-widget').appendChild(script);
    }

    document.addEventListener('DOMContentLoaded', function () {
        const reviewsDiv = document.getElementById('reviews-widget');
        if (reviewsDiv) {
            loadReviewsWidget();
        }
    });
</script>
```

**Container**, in the page content where the reviews should appear:

```html
<div class="home-reviews">
    <div class="container">
        <div id="reviews-widget"></div>
    </div>
</div>
```

- The ID must be `reviews-widget` in **both** the script and the div.
- The `.container` keeps the carousel off the page edges. The outer class names the section for CSS; use `home-reviews` on the homepage, or a page-specific name elsewhere.
- Save both pieces as files in `snippets/` (e.g. `snippets/home-reviews-script.html` and `snippets/home-reviews.html`) so the user can copy them.

**Why this works:** the Kenect script renders into `#kenect-review-carousel` if one exists. If not, it creates that element and inserts it right before its own `<script>` tag. Appending the script inside `#reviews-widget` therefore makes the carousel appear inside the container.

## 3. Preview live

Insert the container and load the script in the debug tab, the same way the loader does. `DOMContentLoaded` has already fired, so call the loader directly:

```bash
npm run dbg -- batch <<'EOF'
eval "(()=>{document.querySelector('.home-welcome').insertAdjacentHTML('afterend','<div class=\"home-reviews\"><div class=\"container\"><div id=\"reviews-widget\"></div></div></div>');const s=document.createElement('script');s.src='https://review-carousel-resource.kenect.com/reviews_widget.min.js';s.async=true;s.setAttribute('data-publicId','PUBLIC_ID');document.getElementById('reviews-widget').appendChild(s);return true})()"
EOF
```

Wait a few seconds, then check it rendered:

```bash
npm run dbg -- batch <<'EOF'
eval "[...document.getElementById('reviews-widget').children].map(c=>c.tagName+'#'+c.id)"
crop ".home-reviews" --at 1600,375
EOF
```

- `DIV#kenect-review-carousel` followed by the `SCRIPT` means it worked. Look at the screenshots: review cards with names, stars and dates.
- Empty, or only the `SCRIPT`: run `npm run dbg -- errors`. A wrong or expired public ID usually loads the script but renders nothing.
- Change `.home-welcome` in the `eval` to whichever section the container should follow on the new site.

## 4. CSS

The widget brings its own styles (heading, cards, stars, arrows). Only add spacing so it isn't flush against the neighbouring sections. Put it at the end of `styles/home.css` with a section comment, following the CSS Style Rules in AGENTS.md:

```css
/*
=====
Home Reviews
=====
*/
.home-reviews { padding: 48px 0 64px; background: #fff; }
```

Restyle the widget's internals only if the user asks.

## 5. Report

Tell the user:

1. **Page Footer Scripts:** paste the loader script on the Developer tab of the page (usually Home).
2. **Content:** paste the container where the widget should appear (say which section it goes after).
3. **Save & Publish**, then check the page. The homepage can be served from a stale cache for a few minutes; load `/?nc=1` to bypass it.
4. The public ID you found, and whether the live preview rendered reviews.

**Site-wide (footer) placement:** if the user wants the reviews on every page, the loader goes in **Footer Scripts on the domain node** (Developer tab), and the container goes at the top of the **Footer snippet**. Then check a few different pages.
