# Connect – Avatar Studio update

This package contains an updated Avatar Studio while preserving the rest of the Connect project.

## Changes
- Fixed the SVG viewBox to `0 0 240 300` so the full character, including the body, is visible.
- Added safe avatar-data normalization for loading saved and older avatar configurations.
- Kept the existing Supabase `profiles.avatar_data` save/load flow.
- Added a reset-to-default control.
- Added PNG export at 720 × 900 pixels.
- Improved option selection accessibility and success/error feedback.

## Files updated
- `avatar.html`
- `js/avatar.js`
- `js/avatar-data.js`

## Run
1. Extract the ZIP.
2. Open the `Connect` folder in VS Code.
3. Run the project using Live Server (or another local HTTP server).
4. Sign in to Connect to save the avatar to the Supabase profile.
5. Use **Tải PNG** to export the current avatar as an image.

## Validation
All JavaScript files passed `node --check`. The Supabase save/load flow still requires a live browser test with the project's configured Supabase account and database policies.
