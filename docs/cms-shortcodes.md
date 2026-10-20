# CMS shortcodes

Shortcodes are placeholders like `[#DealerPhone]` that the CMS replaces with the dealer's real info when the page renders. Use them in **any HTML you put in the CMS** (pages, snippets, forms, hero/footer markup, meta text) instead of typing the dealer's name, phone or address.

**Why:** when the dealer changes their phone number, it's one edit in the dealer's settings, not a hunt through every page that has it typed out.

---

## The shortcodes

| Shortcode | Renders | Comes from | Use it for |
|---|---|---|---|
| `[#DealerName]` | Dealer name | Company Profile | Anywhere the name appears in copy: About Us text, SEO/meta text |
| `[#DealerPhone]` | Main phone, formatted: `(555) 555-5555` | Primary lot | Phone number people read |
| `[#DealerPhoneNoFormat]` | Main phone, digits only: `5555555555` | Primary lot | `tel:` links |
| `[#DealerAddress]` | Full address | Primary lot | Contact info, footers |
| `[#DealerCity]` | City | Primary lot | Copy ("RVs for sale in [#DealerCity]") |
| `[#DealerState]` | State | Primary lot | Copy |
| `[#DealerLocation]` | A location list that adapts to the number of lots and states | All lots | **Preferred on multi-location pages** |
| `[#CreditAppUrl]` | The credit application URL | Domain node → Developer tab | **Every** financing / credit-app link or button |
| `[#DealerAssetsFolder]` | The dealer's assets folder name | Company Profile | Mostly the Developer area (favicons etc.) |

---

## Common patterns

**Clickable phone number** (the formatted number is shown, the digits-only one is dialed):

```html
<a href="tel:[#DealerPhoneNoFormat]">[#DealerPhone]</a>
```

**Financing button:**

```html
<a class="btn btn-primary" href="[#CreditAppUrl]">Get Pre-Approved</a>
```

**Copy:**

```html
<p>Welcome to [#DealerName], your RV dealer in [#DealerCity], [#DealerState].</p>
<p>Visit us at [#DealerAddress] or call <a href="tel:[#DealerPhoneNoFormat]">[#DealerPhone]</a>.</p>
```

---

## Dealers with several locations

Every `Dealer*` shortcode for phone, address, city and state returns only the **primary** lot. (`DealerName`, `DealerLocation` and `CreditAppUrl` aren't tied to a lot.) For a specific location, use the per-lot versions:

| Shortcode | Renders |
|---|---|
| `[#LotPhone-{lotdesc}]` | That lot's phone, formatted |
| `[#LotPhoneNoFormat-{lotdesc}]` | That lot's phone, digits only |
| `[#LotAddress-{lotdesc}]` | That lot's address |
| `[#LotCity-{lotdesc}]` | That lot's city |
| `[#LotState-{lotdesc}]` | That lot's state |

### Working out `{lotdesc}`

Take the lot's **Lot Name** field, lowercase it, and remove the spaces and every other character that isn't a letter or number:

| Lot Name | `{lotdesc}` |
|---|---|
| Denton | `denton` |
| Chichester, NH | `chichesternh` |
| Knoxville Turkey Creek TN | `knoxvilleturkeycreektn` |

```html
<a href="tel:[#LotPhoneNoFormat-denton]">[#LotPhone-denton]</a>
```

- The Lot Name **isn't shown on the public site**. If you don't know it, ask (or check the dealer's lot settings) instead of guessing from the city name.
- A lot shortcode only renders if that lot is **enabled on the dealer's domain**.

---

## When to type the value instead

Hardcode a value only when it shouldn't follow the dealer's settings:

- **A department's own number or an extension:** `<a href="tel:6239798585,113">(623) 979-8585 ext. 113</a>`
- **A lot-specific value when you don't know its `{lotdesc}`** (and say so when you hand the page over, so it can be swapped later)
- **Text the dealer explicitly wants fixed**

Mention any hardcoded dealer info when you hand off the markup.

---

## Previewing pages that use shortcodes

Shortcodes are filled in **by the CMS when the page renders**. The toolbox's live previews (`npm run dbg -- replace` / `inner`) write straight into the open page, so the preview shows the literal text `[#DealerPhone]`. That's expected and not a bug.

If the literal text gets in the way of judging the layout, preview with a real value temporarily, but **the markup you paste into the CMS keeps the shortcode**.

After publishing, check the live page: if you still see `[#Something]` there, the shortcode is misspelled (they're exact), or it's a lot shortcode for a lot that isn't enabled on the domain.

---

## Checklist

- [ ] Dealer name, main phone, address, city and state use shortcodes, not typed values
- [ ] Phone links use `tel:[#DealerPhoneNoFormat]` with `[#DealerPhone]` as the visible text
- [ ] Every financing / credit-app link uses `[#CreditAppUrl]`
- [ ] Multi-location pages use `[#DealerLocation]` or the `Lot*` shortcodes with a confirmed `{lotdesc}`
- [ ] Any hardcoded dealer info is intentional and mentioned in the handoff
- [ ] Checked on the live page after publishing: no leftover `[#…]` text
