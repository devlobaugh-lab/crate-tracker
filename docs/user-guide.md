# User Guide

Crate Tracker helps F1 Clash players track their crate openings and predict which crates are coming next. Because F1 Clash crates follow a fixed repeating pattern, the app can tell you exactly what to expect — including when your next Platinum or Legendary crate is coming.

## Getting Access

The app is invite-only. You need a Gmail address and an admin to add you before you can sign in. Once you're invited:

1. Open the app and click **Sign in with Google**
2. Choose your Gmail account
3. You're in

If you see an "Unauthorized Access" screen, your account hasn't been added yet. Contact an admin.

---

## Your First Time

The first screen you'll see is an introduction. From there, start entering your crates in the order you won them. The more history you enter, the more accurate the predictions become.

If you already know your total win count from the game, head to **Settings** and enter it there — this keeps the app in sync with your actual progress.

---

## Tracking Crates

The main screen shows six buttons, one for each crate type. Tap the one that matches what you just won in-game:

| Button | Crate Type |
|--------|-----------|
| Green | Standard green crate |
| Gold | Gold crate |
| Platinum | Platinum crate |
| Legendary | Legendary crate |
| GP | Grand Prix (blue) crate |
| ? | Unknown — if you're not sure |

Each tap adds that crate to your history and increments your win counter. GP crates count toward both your total wins and your GP win count.

### What you see on screen

- **Last 10 crates** — your most recent wins, shown as colored boxes
- **Next 10 predictions** — what the algorithm expects you'll get next
- **Special crate countdown** — how many crates until your next Platinum or Legendary

If the predictions show **?**, it means the app doesn't have enough history to be certain. Keep entering crates and confidence improves.

### Undoing a mistake

Hit the **Undo** button to remove the last crate you entered. This also decrements your win counter. You can undo as many times as needed.

---

## Fast Forward

If you've won crates without logging them, use **Fast Forward** to catch up without tapping every single one.

1. Open the Fast Forward panel (button in the crate grid)
2. Enter how many additional GP crates you won
3. Enter your new total win count
4. Submit — the app fills in the gaps using the prediction algorithm

This is also useful when you're importing historical data or correcting a discrepancy between the app and your in-game progress.

---

## Settings

Tap the gear icon to open Settings.

### Adjusting win counts

If your in-game win totals don't match what the app shows, you can manually correct them here. Enter the right numbers and save.

### Backing up your data

Use **Export Data** to download a JSON file of everything — your crate history, win counts, and config. Save this file somewhere safe.

### Restoring from a backup

Use **Import Data** to upload a previously exported JSON file. This replaces your current data entirely, so make sure you're importing the right file.

### Resetting

**Reset All Data** wipes your crate history and sets all counters back to zero. You'll be asked to confirm before anything is deleted.

---

## Admin Features

Admins have access to a **User Administration** section in Settings.

### Managing users

- **Add a user** — enter their Gmail address and choose a role (admin or normal)
- **Activate/deactivate** — toggle access without deleting the account
- **Change roles** — promote someone to admin or demote them
- **Delete users** — permanently removes their access (requires confirmation)

The app generates invitation email content you can copy and send manually. There's no automatic email sending built in.

### Safety limits

Admins can't accidentally lock themselves out: the system prevents the last remaining admin from demoting or deactivating their own account.

---

## Multi-Device Sync

Your data syncs automatically across all devices via your Google account. Changes made on one device appear on another within seconds when both are online.

The app also works offline. Any crates you enter while offline are saved locally and sync automatically when your connection returns.

---

## Troubleshooting

**Predictions show all ?**
The algorithm needs enough history to find your position in the pattern. Keep entering known crates and certainty will increase.

**Win count doesn't match the game**
Go to Settings and manually correct the numbers. If you're far off, use Fast Forward to fill the gap.

**Data not syncing**
Check your internet connection. The app will sync automatically once it's restored. You can also try refreshing the page.

**"Unauthorized Access" screen**
Your Gmail address hasn't been added to the system. Contact an admin to request access.
