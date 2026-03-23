# Fix Log - March 23, 2026

## Issue: Custom Icons and Branding Overrides Not Saving
**Symptoms:** 
- Users would upload a custom icon, but it wouldn't "stick" after pressing save.
- Manual overrides for Brand Name and Domain would revert to auto-detected values.
- The "Edit" button occasionally crashed the app or didn't populate fields.

## The Solution
The root cause was **State Fragmentation**. The app was trying to manage the same data in three different places:
1. The `newEntry` object (for general fields).
2. A separate `entryIcon` state (for the image).
3. A separate `customBrandInput` state (for overrides).

When the `Save` button was clicked, these three states would occasionally be "stale" or out of sync due to the **Auto-Lock timer** triggering re-renders every second.

### Key Changes:
1. **State Unification:** I moved the `customIcon` directly into the `newEntry` object. This ensures that the image is always part of the same "source of truth" as the password and username.
2. **Override Prioritization:** I updated `handleSaveEntry` to explicitly check the "Override" fields first. If you type a custom name, that name is now forced into the final saved entry, bypassing the auto-detection logic.
3. **Save-Path Optimization:** I refactored `handleSaveEntry` to be "Immediate." It now captures the current state of all inputs at the exact millisecond you click save, preventing the auto-lock timer from "stealing" the focus or resetting the data.
4. **Grouped View Support:** I fixed an oversight where the folder-based "Grouped View" was still looking for old icon URLs instead of your new custom uploads.

## Verification
- [x] Custom Icons persist after save.
- [x] Manual Name/Domain overrides persist after save.
- [x] Edit modal correctly populates all fields including custom branding.
- [x] Auto-lock timer no longer interferes with form entry.
