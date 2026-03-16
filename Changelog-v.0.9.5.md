# Changelog

All notable changes to Atria are documented here.

---

## [v0.9.5] — PIN Recovery

### Added
- **PIN recovery system** — fully local, no server required.
  - When activating the PIN, you can optionally set a security question and answer (hashed, stored only on your device).
  - After 3 failed PIN attempts, a "Forgot your PIN?" button appears.
  - With a security question set: answering it correctly removes the PIN while keeping all data intact.
  - Without a question (or wrong answer): last-resort flow — type `DELETE` to wipe all data and regain access.
  - New row in Security settings to view, configure, edit, or remove the recovery question.
- **"Clear cache" button** in Danger Zone — forces a clean Service Worker reload.
- **Ko-fi and GitHub links** added to the About section.

### Changed
- Alter form: **Extras tab removed** — custom fields now belong exclusively to profile cards.
- Archiving an alter is now directly visible in the main form (no wrapping tab).
- Deletion confirmations now require typing `DELETE` instead of a browser `confirm()` dialog.

### Fixed
- Importing a backup no longer overwrites the PIN on the current device (`tid_pin_hash`, `tid_pin_enabled`, `tid_session_unlocked` are excluded from import).

---

## [v0.9.3] — Profile Card Custom Fields

### Added
- Profile cards now have their own **Extras tab** with an independent custom field editor.
- Cards display additional fields: Archetype, Reflection, Discomfort, Safety, Values, and any custom fields.
- Export image includes all new fields.

### Changed
- Custom fields are now owned by the **card**, not the alter — each card manages its own fields independently.
- Card action buttons renamed for clarity: `✎ Edit`, `↓ Export`, `✕ Delete`.

---

## [v0.9.2] — Custom Fields Fix

### Fixed
- Alter list scroll blocked when system had more than 9 alters.
- Custom fields on an alter were lost when saving without having opened the Extras tab.
- Broken layout in the custom fields row inside the alter modal.
- Profile card lookup now uses `alterId` instead of matching by name (more reliable).
- Creating a card from an alter profile now correctly passes `alterId` through prefill.

---

## [v0.9.1] — Granular Data Deletion

### Added
- **Danger Zone** rewritten: delete data per module individually (System, Chat, Personal, Cards, Library, Calendar, Projects, Finances, Crisis) or wipe everything at once.

---

## [v0.9.0] — Moods, Finances & Navigation

### Added
- **Mood check-in on entry** — a quick modal appears when selecting an alter to log the current emotional state.
- Moods are fully customizable from Settings (add, edit, delete).
- **Finances admin view** — system-wide transaction breakdown per alter with month/year filters.
- Transactions now store the `alterId` of the active alter at creation time.
- **Collapsible mobile nav** via hamburger button (hidden by default).

### Changed
- Hub navigation reorganized into three groups: **System**, **Personal**, **Tools**.
- Language selector restricted to Spanish and English only.

### Fixed
- Chat input no longer obscured by the nav bar on mobile.
- PIN keypad text color now visible in dark mode.
