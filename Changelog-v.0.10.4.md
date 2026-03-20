# Atria v0.10.4

## Added
- **Intimacy layers** — each alter has a level (`Private / Internal / Shared / Public`) shown as a badge on cards and configurable from the Permissions tab. Prerequisite for P6.
- **Interactive tutorial** — 5-step guide shown on first Hub visit. Re-launchable from Config → About Atria.

## Fixed
- "Refresh" and "Manage profiles" buttons on the alter selection screen lost their background and border due to the global CSS button reset.
- Heatmap tab in Analytics was resetting to Dashboard when navigating away and back.
- Untranslated Spanish labels in the EN build (`Rosa`, `Azul`, `Entradas del diario`, `Tracker emocional`).

---

# Atria v0.10.3

## Fixed
- Language switcher (ES/EN): active button now highlights correctly on all devices.
- Mobile nav bar buttons no longer show unexpected native browser styling.
- Onboarding: pronouns field pre-fills correctly when editing an existing alter; step 2 scrolls to top.
- Config section cards (Personalisation, Data…) were disappearing due to a CSS specificity conflict.
- Emergency contacts in the SOS panel no longer overflow when a contact has multiple phone numbers or emails.

## Changed
- Font size selector applies instantly (zoom-based) without requiring a page reload.

---

# Atria v0.10.2

## Added
- **Memory ownership** — diary entries can be tagged with one or more owner alters; "My memories" filter in the diary sidebar.
- **Knowledge boundaries** — "Knows / Doesn't know" fields per alter in the editor and profile sheet (System tab).

---

# Atria v0.10.1

## Added
- **Alter states** — status badge (Active, Dormant, Emerging, Transitory) on cards and list; hidden when Active.
- **Subsystems** — admins can create named groups with a colour; alters assigned to a subsystem appear under a group header.

---

# Atria v0.10.0

## Added
- **Fronting heatmap** — 16-week × 7-day grid with session intensity and per-day tooltip.
- **Routine adherence** — tab with 30-day completion %, current streak, and 14-day dot chart.
- **Hub summary row** — today's routines + next reminder; tap to navigate to the module.
- **Alter relationships** — Relationships tab in the editor with 6 link types and an optional note.
- **Wellbeing report** — therapist-ready plain-text export with date-range filter.
- **Hub dashboard cards** — Today's state, Active projects, Next event; respect alter permissions.

## Changed
- Relationship chips removed from alter cards — now only in the profile sheet.
- Accent colour and font size changes show a reload banner instead of partially applying.
- System summary uses the date-range picker instead of a hardcoded last-30-days window.

---

# Atria v0.9.15

## Added
- Privacy toggle on tracker entries.
- Permissions visibility summary in the alter editor (✓/✕ chips per module).

## Fixed
- Tracker CSV export and plain-text summary no longer include private entries from other alters.

---

# Atria v0.9.14

## Added
- Real-time search in the emoji picker (67 emojis with tags).
- Custom colour for alters using the native device colour picker.
- Auto-fill avatar and banner when creating a profile sheet from an alter.
- Plain-text system summary export.
- Date-range filters on all CSV exports.
- New CSV exports: reminders, tasks, fronting sessions, emotional tracker, finances.
- Fronting planner with configurable blocks.
- Responsibilities dashboard per alter in Projects.
- Routines module with frequency and daily checklist tracking.
- List view for Alters and Profiles with sorting and filters.
- Banner support in alter profiles with overlapping avatar.
- Analytics view with key metrics, fronting/emotions/triggers charts, and 14-day heatmap.
- Free-text pronouns field with suggestions.

## Fixed
- PIN recovery: security question is no longer lost when restoring a backup.

---

# Atria v0.9.13

## Added
- Per-alter analytics in the emotional tracker (top mood, average intensity, active days).
- Extended tracker history to 30 days with a "load more" button.
- Editable post-crisis recovery field in crisis history.

## Fixed
- Crisis history would not open in some cases due to inconsistent trigger data.

---

# Atria v0.9.11

## Fixed
- Finance backup: transactions, savings, and budgets are now correctly included and restored.
- Memory leak in the PIN lock screen during recovery/reset flows.

---

# Atria v0.9.10

## Fixed
- Crisis history screen not loading.
- Notification settings are now included in backups.
- Backups now include per-alter custom calming messages.
