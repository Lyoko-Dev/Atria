# Atria v0.10.2

## Added

- **Memory ownership** — diary entries can be tagged with one or more owner alters (Owners picker in the diary editor, defaults to empty = shared with all). Owner chips are shown on each entry card. A "My memories" filter in the diary sidebar shows only entries owned by the active alter (or shared with everyone).
- **Knowledge boundaries** — each alter now has two free-text fields in the Basic editor tab ("What do they know about the system?" and "What do they NOT know?"), stored on the alter object and shown read-only in the System tab of their profile sheet.

---

# Atria v0.10.1

## Added

- **Alter states** — each alter now has a state field (Active, Dormant, Emerging, Transitory) shown as an inline badge next to the alter name in grid and list views; hidden when Active (the default).
- **Subsystem grouping** — admins can define named subsystems with a color and description (Alters → Manage subsystems); alters assigned to a subsystem appear under a group header; ungrouped alters collect under "No subsystem".
- **Subsystem field in alter editor** — admin-only dropdown in the Basic tab to assign an alter to an existing subsystem.

---

# Atria v0.10.0

## Added

- **Fronting heatmap** — 16-week × 7-day calendar grid in the Analysis view, with color intensity by session count, per-day tooltip, most-active alter stat, and a Less/More legend.
- **Routine adherence** — new Adherence tab in Routines showing 30-day completion percentage, current streak, and a 14-day dot chart per routine.
- **Hub snapshot row** — compact summary on the home screen showing routines done today (with a progress bar) and the next upcoming reminder; tapping navigates to that module.
- **Alter relationships** — new Relationships tab in the alter editor to define typed links between alters (Protector, Co-front, Complementary, Conflict, Origin/fragment, Other) with an optional note; shown read-only in the System tab of the alter's profile sheet.
- **Wellbeing report** (Config → Data → Wellbeing report) — therapist-ready plain-text export covering system composition, fronting activity, emotional state breakdown per alter, diary entries (with privacy filtering), and crisis episodes; all with date-range selection.
- **Hub dashboard cards** — three at-a-glance cards on the home screen: Today's state (tracker mood + intensity), Projects (active count, pending tasks, overdue warning), Next event (next agenda item title and date). Cards respect alter permissions and navigate to their module on tap.

## Changed

- Relationship chips removed from alter grid/list cards — they now live exclusively in the profile sheet's System tab.
- Accent color and font size changes in Config → Personalization now show a reload banner with an OK button instead of silently applying a partial update.
- System summary (Config → Data) now uses the date-range picker instead of a hardcoded last-30-days window.

---

# Atria v0.9.15

## Added

- **Privacy toggle on tracker entries** — mark an entry as private so other alters cannot see it in the history or analysis view.
- **Permissions visibility summary** — the Permissions tab in the alter editor now shows a live chip grid (✓ / ✕ per module) so admins can see at a glance what each alter can access.

## Changed

- Privacy labels are now uniform across all modules: notes, diary entries, and tracker entries all show `🔒 Private`.

## Fixed

- Tracker CSV export and plain-text system summary no longer include private entries belonging to other alters.

---

# Atria v0.9.14

## Added

- Real-time search in the emoji picker (20 → 67 emojis available).
- Custom color support for alters using the native device color picker.
- Auto-filled avatar and banner when creating a profile from an alter.
- Plain-text system summary export (alters, last 30 days of fronting, mood distribution, active projects).
- Date range filters for all CSV exports (including an "All" option).
- New CSV exports: reminders, tasks, fronting sessions, emotional tracker entries, finances.
- Fronting planner with configurable blocks (alter, date, time range, co-fronting, status).
- Responsibilities dashboard per alter in Projects.
- Routines module — repeatable habits/checklists with frequency and daily tracking.
- List view for Alters and Profiles.
- Sorting and filtering for Alters and Profiles (A-Z, creation date, role, archetype).
- Banner support in alter profiles with overlapping avatar.
- New Analytics view with key metrics, 14-day chart, fronting activity by alter/hour/weekday, emotion distribution with 30-day trend, and trigger frequency with associated crisis level.
- Pronouns field is now free text with suggestions instead of a fixed selector.

## Changed

- Automatic image compression on upload: avatar 240×240 px, banner 700×220 px.

## Improved

- Image upload error messages now include: unsupported format (with detected extension) and file size (current vs. allowed limit).

## Fixed

- PIN recovery: security question is no longer lost when restoring a backup.
- Minor bug fixes.

---

# Atria v0.9.13

## Added

- Per-alter analytics in the emotional tracker (most frequent mood, average intensity, active days).
- Extended tracker history (30 days by default with option to load more).
- Editable post-crisis recovery field in crisis history.

## Fixed

- Crisis history would not open in some cases due to inconsistent trigger data.

---

# Atria v0.9.11

## Fixed

- Finance backup: transactions, savings, and budgets are now correctly included and restored.
- Memory leak in PIN lock screen during recovery/reset flows.
- Minor bug fixes.

---

# Atria v0.9.10

## Fixed

- Crisis history screen not loading.
- Notification settings are now included in backups.
- Backups now include per-alter custom calming messages.
- Minor bug fixes.
