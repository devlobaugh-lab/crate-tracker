# Crate Tracker User Guide

## Overview

Crate Tracker is a web application designed for tracking F1 Clash crate openings. It helps users record their crate winnings, predict future crates based on patterns, and maintain a personal history of their gameplay progress.

## Features

### Core Functionality
- **Crate Tracking**: Record each crate you win with color coding
- **Win Counter**: Automatic tracking of your game wins
- **Prediction Algorithm**: Algorithm predicts the next 10 crates based on patterns
- **Special Crate Forecasting**: Shows how many crates until you get a Platinum or Legendary crate
- **Undo Functionality**: Remove the last entered crate (can be used multiple times)
- **Fast Forward**: Quickly jump forward by entering multiple wins at once

### Data Management
- **Cloud Synchronization**: Data syncs across devices via Google Account
- **Offline Support**: Works offline and syncs when reconnection occurs
- **Backup & Restore**: Export/import your data as JSON files
- **Reset Functionality**: Start over with fresh data

### Administration
- **Invite-Only System**: Secure access restricted to authorized users
- **Admin Panel**: Administrators can manage user access
- **Email Invitations**: Automated invitation system for new users

## Getting Started

### 1. Authentication
- Click "Sign In" and authenticate with your Google Account
- You must be authorized by an administrator to access the app
- Contact an admin if you need access granted

### 2. First Time Use
- Upon first login, you'll see the introductory screen
- Start entering crates as you win them in games
- The app will begin making predictions after a few crates are entered

## How to Use

### Entering Crates
1. Open the app and sign in
2. Look at the crate grid showing different colors
3. Click the color that matches your won crate
4. The app automatically increments your win counter
5. The crate is added to your history and predictions update

### Understanding the Interface

#### Win Counter
- Located in the top-right corner
- Shows your total game wins (GP Wins)
- Used by the prediction algorithm

#### Last 10 Crates
- Shows your most recent crate openings
- Visual representation of your recent wins

#### Predictions
- Next 10 crates the algorithm predicts you'll get
- Based on patterns in your crate history

#### Special Crate Counter
- Shows how many crates until you get a special (Platinum/Legendary) crate
- Displays "The next crate is [color]" when it's imminent
- Shows "?" when insufficient data for prediction

### Advanced Features

#### Undo
- Located in the crate grid
- Removes the last entered crate
- Can be used multiple times to correct entries
- Also decrements your win counter

#### Fast Forward
- Located in the crate grid
- Allows bulk entry of multiple wins
- Enter additional GP wins and current total
- Simulates entering multiple crates at once

#### Configuration Panel
Access the config panel via the settings icon (⚙️):

- **Adjust Wins**: Sync your in-game win counter with the app
- **Backup Data**: Download your data as a JSON file
- **Restore Data**: Upload a previously backed-up JSON file
- **Reset All Data**: Clear everything and start fresh

### Admin Features

Administrators have access to additional functionality:

#### User Management
- View all authorized users
- Grant/revoke user access
- Send email invitations to new users

#### Invitation System
- Add users by Gmail address
- Choose user role (admin/normal)
- Generate email content for invitations
- Track invitation status

## Data Security

- All data is stored securely in Firebase Cloud Firestore
- Authentication requires Google Account verification
- Access is restricted to authorized Gmail addresses only
- Data is encrypted in transit and at rest
- Admin control ensures only invited users can join

## Technical Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Google Account for authentication
- Stable internet connection (with offline fallback)
- Mobile-responsive design works on all devices

## Troubleshooting

### Common Issues

**"Unauthorized Access"**
- You haven't been granted access by an admin
- Contact an administrator to request access

**Predictions Not Showing**
- Need at least a few crates entered to generate predictions
- Check that your win counter is accurate

**Data Not Syncing**
- Check internet connection
- Try refreshing the page
- Data will sync automatically when connection returns

**Can't Access Admin Panel**
- You must have admin privileges
- Contact a system administrator for elevated access

### Data Recovery

- Use the backup feature regularly to export your data
- Keep JSON files safe for restoration
- Import backup files through the config panel

## Best Practices

1. **Regular Backups**: Export your data periodically
2. **Accurate Win Counting**: Keep your win counter synced with in-game progress
3. **Consistent Entry**: Enter crates immediately after wins
4. **Verify Predictions**: Algorithm accuracy improves with more data
5. **Admin Coordination**: Coordinate with admins for user management

## Privacy & Terms

The app stores only crate tracking data associated with your Google Account. Data is used solely for the crate tracking functionality and is not shared with third parties. Users must be authorized by administrators before gaining access.
