# Custom forms

How lead forms work on dealer sites (Contact Us, Parts Request, Get a Quote, Trade-In…), and how to build a new one, change an existing one, or figure out why one isn't working.

Forms live in the CMS. The toolbox never edits the CMS: you build the markup, preview it live, and paste the final HTML in yourself.

> **With Claude Code:** `/custom-forms` follows this doc: it reads the current form, makes the change, previews it and hands you the markup.

**Golden rule: always start from a working form,** either one already on the same site or default markup someone gives you. Never retype field markup from memory: the validation attributes and patterns have to be exact.

---

## How a form is configured

A form's behavior isn't set anywhere in the CMS settings. It's set by **hidden inputs at the bottom of the form markup**, grouped in a `<p>` after the Submit button:

```html
<input name="FormType" value="Contact Us" type="hidden" />
```

- `name` is the setting, and it is **case-sensitive**: `FormType` works, `formtype` doesn't. Watch the odd casing of `AccountOverRideEmail`.
- `value` is what it's set to.
- `type="hidden"` keeps it invisible.

The `<p>` can sit inside the form's `.well` (Contact Us) or right after it (Parts Request). Both work, so keep whatever the form already has.

### The settings

| `name` | Default | What it does | Change it? |
|---|---|---|---|
| `FormType` | `Contact Us` | **The label the lead gets in the ICC inbox** | Yes. Every form needs its own descriptive value (`Parts Request`, `Get a Quote`) so leads can be told apart. |
| `AjaxTarget` | `/Forms/Ajax` | Where the form submits | **Never.** Required on every form. |
| `RedirectUrl` | `/contact-confirmation` | Page the visitor lands on after submitting | Only if asked. The page must exist. |
| `SuccessMessage` | `Request Sent Successfully` | Success message text | Only if asked |
| `JournalTemplate` | `journal.hbs` | Template for the lead's journal entry | No |
| `AccountEmailTemplate` | `lead_generic.hbs` | Lead email sent to the dealer | No |
| `CustomerEmailTemplate` | `contact_confirmation.hbs` | Confirmation email sent to the customer | No |
| `AccountOverRideEmail` | (not set) | Send this form's leads to specific addresses | Only when explicitly asked, see below |

The default block, exactly as it ships (copy it, don't retype it):

```html
<p><input name="FormType" value="Contact Us" type="hidden" /> <input name="RedirectUrl" id="RedirectUrl" value="/contact-confirmation" type="hidden" /> <input name="AjaxTarget" value="/Forms/Ajax" type="hidden" /> <input name="SuccessMessage" id="SuccessMessage" value="Request Sent Successfully" type="hidden" /> <input name="JournalTemplate" value="journal.hbs" type="hidden" /> <input name="AccountEmailTemplate" id="AccountEmailTemplate" value="lead_generic.hbs" type="hidden" /> <input name="CustomerEmailTemplate" id="CustomerEmailTemplate" value="contact_confirmation.hbs" type="hidden" /></p>
```

### Sending leads to specific inboxes

```html
<input type="hidden" name="AccountOverRideEmail" value="parts@dealer.com" />
<input type="hidden" name="AccountOverRideEmail" value="parts@dealer.com,manager@dealer.com" />
```

- The lead email goes to these addresses **no matter what the dealer's lead distribution or assigned salesperson is**. That's why you only add it when someone explicitly asks for it.
- Several addresses are comma-separated. The **first** one is used as the "from" address.
- Get the addresses confirmed in writing. Never guess them.
- Put it inside the same config `<p>`.

---

## The fields

### Standard contact fields

Every default form has the same contact block: two columns (`.row` > `col-md-6`).

| Left column (all required) | Right column | Below |
|---|---|---|
| `FirstName` (full name, must contain a space), `Email`, `Phone`, `Zip` | `Comments` textarea, label changed per form ("How can we help you?") | `EmailOptIn` checkbox (checked by default), `SubmitButton` |

**Keep these names exactly as they are.** They're what the backend reads for the lead's contact info.

### Anatomy of a required field

```html
<div class="form-group"><span class="field-validation-valid" data-valmsg-for="Email" data-valmsg-replace="true"></span><i class="fa fa-exclamation-triangle"></i><label for="Email">Email <em>*</em></label> <input name="Email" id="Email" class="form-control" data-val="true" data-val-required="Email is required." data-val-regex="Please enter a valid email address." data-val-regex-pattern="^\S+@\S+\.\S+$" type="text" /></div>
```

| Piece | Job |
|---|---|
| `<span class="field-validation-valid" data-valmsg-for="Email">` | Where the error message appears. `data-valmsg-for` **must match** the input's `name`. |
| `<i class="fa fa-exclamation-triangle">` | Error icon |
| `<em>*</em>` in the label | Visual "required" marker |
| `data-val="true"` | Turns validation on |
| `data-val-required` | The "this is required" message |
| `data-val-regex` + `data-val-regex-pattern` | The format message and the pattern the value must match |

**To make a field optional,** remove the span, the icon, the `<em>*</em>` and every `data-val*` attribute. `Comments` is an example of an optional field.

### Custom questions: `jem[Group]_Field`

Anything form-specific (RV year, parts needed, trade-in mileage) uses this name format:

```
jem[GroupName]_Field_Name      e.g.  jem[RvDetails]_Year   jem[TradeIn]_Mileage
```

- Use the **same string** for the input's `name`, its `id`, and the label's `for`.
- Fields with the same group name are shown together in the lead (e.g. an "RV Information" section).
- Spaces in the field part become `_`: `jem[RvDetails]_Parts_Needed`.
- Pick one group name per section and use it consistently. If the site already has forms, reuse their group names where they fit.

The default Parts Request layout: label in `col-sm-5`, control in `col-sm-7`, inside a `.form-horizontal`:

```html
<div class="form-group"><label for="jem[RvDetails]_Make" class="col-sm-5 control-label text-left">What is the Make?</label>
    <div class="col-sm-7"><input class="form-control" name="jem[RvDetails]_Make" id="jem[RvDetails]_Make" type="text" /></div>
</div>
```

Use `<textarea class="form-control" rows="4">` for longer answers and `<select class="form-control">` for choices, with the same naming.

---

## Changing an existing form

With `npm run dev` running and the form's page open in the injector's window:

1. **Grab the current markup:**
   ```bash
   npm run dbg -- find "How can we help you?"     # any label on the form, to locate it
   npm run dbg -- html ".well"                    # or the wrapper find suggests
   ```
2. **See what's configured:**
   ```bash
   npm run dbg -- eval "[...document.querySelectorAll('input[type=hidden][name]')].map(i => ({ name: i.name, value: i.value }))"
   ```
3. **Make the change** in a file (e.g. `snippets/forms/parts-request.html`). Leave `AjaxTarget` alone, and keep every other setting unless the change is about it.
4. **Preview it:**
   ```bash
   npm run dbg -- replace ".well" @snippets/forms/parts-request.html
   npm run dbg -- crop ".well" --at 375,768,1200
   npm run dbg -- errors
   npm run dbg -- restore
   ```
   If the config `<p>` sits **outside** the `.well`, replace their common parent instead so the preview includes it.
5. **Paste** the complete final markup into the CMS. Any styling goes at the end of `styles/home.css` as usual.

## Building a new form

1. **Start from a working form:** dump the site's Contact Us form (`npm run dbg -- html ".well"`), or use default markup you were given.
2. **Add the custom questions** as `jem[Group]_Field` fields, and relabel `Comments` if needed. Every `name` / `id` / `for` must be unique within the form.
3. **Set a new `FormType`.** Ask the requester what label they want in ICC.
4. Keep `AjaxTarget` and the other default settings. Change `RedirectUrl` / `SuccessMessage`, or add `AccountOverRideEmail`, only if asked.
5. Save it as `snippets/forms/<name>.html`, then preview and paste as above.

### Migrating a form from the dealer's old site

Match the **old form's fields exactly**: only the fields it had, required only where it was required. Don't carry over the default form's extras (`Comments`, `EmailOptIn`) or its required `Phone`/`Zip` if the old form didn't have them. Map to the standard names (`FirstName`, `Email`, `Phone`, `Zip`) where they fit, and use `jem[...]` for the rest.

---

## "The form isn't working"

| Symptom | Check |
|---|---|
| Submitting does nothing / errors | `npm run dbg -- errors` for script errors and failed requests. Is `AjaxTarget` present with value `/Forms/Ajax`? |
| Leads arrive but with the wrong label in ICC | `FormType` value, and its spelling/casing (`FormType`, not `formType`) |
| Leads don't reach the expected inbox | Is `AccountOverRideEmail` set, spelled `AccountOverRideEmail`, with the right addresses? Without it, leads follow the dealer's lead distribution. |
| Visitor lands on a 404 after submitting | `RedirectUrl` points to a page that doesn't exist |
| Validation message never appears, or appears under the wrong field | `data-valmsg-for` must equal the input's `name` |
| A second form on the same page misbehaves | **Duplicate ids.** The default forms hard-code `#FirstName`, `#Email`, `#SubmitButton`, `#RedirectUrl`… Check with `npm run dbg -- select "#SubmitButton"`: the count should be 1. |
| A custom answer is missing from the lead | Its `name` must follow `jem[Group]_Field`, with `name` = `id` = label `for` |

---

## Checklist before pasting into the CMS

- [ ] `FormType` set to the label wanted in ICC
- [ ] `AjaxTarget` present, value `/Forms/Ajax`
- [ ] `RedirectUrl`, `SuccessMessage`, `JournalTemplate`, `AccountEmailTemplate`, `CustomerEmailTemplate` kept (unless changed on purpose)
- [ ] Setting names spelled with the exact casing above
- [ ] `RedirectUrl` page exists
- [ ] `AccountOverRideEmail` (if any) confirmed, with the intended "from" address first
- [ ] Every required field's `data-valmsg-for` matches its `name`; custom fields use one consistent `jem[Group]_` prefix with `name` = `id` = `for`
- [ ] No duplicate ids on the page (`dbg select "#SubmitButton"` → 1)
- [ ] **After publishing: do a real test submission** and confirm it lands in ICC (and the override inbox, if set). The preview can't test that.
