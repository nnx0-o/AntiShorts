# AntiShorts

Firefox WebExtension that keeps direct access to individual YouTube Shorts while removing the main mindless-consumption paths.

Current behavior:

- Hides the Shorts shelf on the logged-in YouTube homepage.
- Hides Shorts recommendation shelves on `/watch` pages.
- On `/shorts/<id>` pages, blocks in-app navigation from one Short to another.
- Hides the Shorts up/down navigation buttons and blocks wheel, swipe, and keyboard navigation that would move to the next Short.
- Hides the generated preview thumbnails that YouTube renders for upcoming Shorts inside the Shorts viewer.
- Adds a toolbar popup with toggles for each of those behaviors.

## Load In Firefox

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click `Load Temporary Add-on...`.
3. Select `manifest.json` from this folder, or select `AntiShorts-firefox.xpi` from the project root.

Firefox will load the extension until the browser restarts.

## Packaged Files

- `../AntiShorts-firefox.xpi` is the archive Firefox can load directly.
- `../AntiShorts-firefox.zip` contains the same extension payload as a normal zip archive.

## Settings Popup

1. Pin or open the AntiShorts toolbar icon in Firefox.
2. Click the icon to open the popup.
3. Toggle the features you want enabled on YouTube.

## Reload After Edits

1. Return to `about:debugging#/runtime/this-firefox`.
2. Find `AntiShorts` in the temporary extensions list.
3. Click `Reload`.

## Implementation Notes

- The extension is intentionally limited to the recommendation surfaces described in the README: home Shorts shelves, watch-page Shorts shelves, and Shorts-viewer navigation/preview surfaces.
- It does not remove direct access to Shorts opened from bookmarks, pasted URLs, or search results.
- The settings are stored in `storage.local`, so the popup can change behavior without a full extension rebuild.
