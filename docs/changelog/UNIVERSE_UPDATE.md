# Connect Social Universe – Planet Landing & Community Membership

## Added in this update
- Six community planets: Tech, Art, Music, Nature, Books and Sport.
- Selecting a planet opens its community panel.
- Signed-in users can join or leave a community.
- Membership is stored in Supabase (`community_members`) and restored after reload/sign-in.
- The panel shows public profile names of members who joined.
- Existing interest-based discovery remains available through the existing 3D planet section.

## Required Supabase setup
1. Open the Supabase project dashboard.
2. Go to **SQL Editor**.
3. Open `supabase/migrations/002_community_members.sql` from this project.
4. Run the complete SQL script.
5. Refresh Connect and sign in. Select a planet and use **Tham gia cộng đồng**.

The SQL script creates the membership table and row-level security policies. A user can only add or remove their own membership. Authenticated users can read membership rows; the UI only displays profiles marked `is_visible = true`.

## Notes
- The new feature requires the SQL migration above; it is not applied automatically by the website.
- Planet member counts on the planet cards still represent public profiles whose interests match that planet. The detail panel separately shows actual joined members.
- Community posts, comments and live chat are not included in this iteration.
