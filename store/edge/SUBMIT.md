# Publish on Microsoft Edge Add-ons: step by step (free)

Everything you need is in this folder (`store/edge/`). Text to paste is in [`listing.md`](listing.md).
It takes about 20 minutes, plus Microsoft's review (usually a few business days, up to about 7).

## 0. Before you start (important)

- [ ] Load the extension in Edge yourself and let it solve one daily problem: `edge://extensions` → Developer mode → **Load unpacked** → the unzipped folder. Reviewers test it, and a broken extension gets rejected.
- [ ] Have the upload zip: download `daily-streak-keeper-1.0.0.zip` from the [v1.0.0 release](https://github.com/researchInBlockchain/daily-streak-keeper/releases/tag/v1.0.0), or run `python scripts/package.py` and use `dist/daily-streak-keeper-1.0.0.zip`.

## 1. Register as an Edge developer (free, one time)

1. Open **https://partner.microsoft.com/dashboard/microsoftedge/overview** and sign in with any Microsoft account (Outlook/Hotmail/Live, or create one).
2. Choose **Register** / **Get started** for the Microsoft Edge program.
3. Account type **Individual**. Country/region **India**. Fill in your name and contact email.
4. **Publisher display name**: this is shown publicly on the store page (for example `researchInBlockchain`). It must be unique.
5. Accept the agreement and confirm the verification email if Microsoft sends one. Registration for Edge has **no fee**. If any page asks for payment, you are in the wrong program (Microsoft Store apps, not Edge).

## 2. Create the extension and upload the package

1. In the Edge dashboard click **Create new extension**.
2. **Packages** → drag in `daily-streak-keeper-1.0.0.zip`. Wait until validation finishes (name, version 1.0.0 and permissions appear).
3. Click **Continue**.

## 3. Availability

- Visibility: **Public**
- Markets: leave **all markets** selected
- **Save**

## 4. Properties

Copy from the *Properties tab* table in `listing.md`:

- Category: **Productivity**
- Personal information: **Yes**, then the privacy policy URL
- Website URL and Support contact URL
- Mature content: **No**
- **Save**

## 5. Store listings

1. Click **English** (add it as a language if asked).
2. **Description**: paste the *Description* block.
3. **Short description**: paste the *Short description* block (if the field is shown).
4. **Extension Store logo**: `logo-300.png`
5. **Small promotional tile**: `promo-small-440x280.png`
6. **Large promotional tile**: `promo-large-1400x560.png`
7. **Screenshots**: `screenshot-1.png` to `screenshot-5.png`, in that order.
8. **Search terms**: the 7 terms, one per box.
9. **Save**

## 6. Submit

1. Click **Publish** (top right of the submission overview).
2. In **Notes for certification** paste the *Notes for certification* block.
3. Confirm. Status changes to **In review**. You get an email when it's published, or if they need changes.

## 7. After approval

- Your store link looks like `https://microsoftedge.microsoft.com/addons/detail/<id>`. Send it to Claude (or add it yourself) to put a **"Get it for Microsoft Edge"** button on the website and in the README.
- Edge installs updates automatically for users.

## Publishing an update later

1. Bump `version` in `extension/manifest.json` (it must be higher than the store version).
2. `python scripts/package.py`
3. Partner Center → your extension → **Update** → upload the new `dist/daily-streak-keeper-X.Y.Z.zip` → **Publish**.
4. Also create a GitHub release so the website download updates (see the README).

## If the review is rejected

The email names the policy. Common fixes:
- *Name / trademark*: rename to something without "LeetCode" in the name (for example "Daily Streak Keeper"), keeping "for LeetCode" only in the description.
- *Functionality*: make sure the reviewer notes are in the submission, and that the extension works on a fresh profile.
- *Permissions*: the justifications are in the reviewer notes. Reply to the reviewer with them if asked.

Regenerate the images any time with `python scripts/make_store_images.py` (run from `scripts/`).
