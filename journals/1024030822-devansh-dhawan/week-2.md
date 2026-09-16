## Week 2

## Work Done

- Set up the folder structure for the student app (login, register, hostel selection, and the main dashboard/submit/history/profile screens).
- Added fake/sample data for laundry batches, complaints, and notifications so the screens can be built and shown without waiting for the backend to be ready.
- Built the login flow: email login with OTP, a register screen for new students, and a hostel selection screen with all 18 real hostel names.
- Fixed a bug where the app skipped login entirely and went straight to the dashboard.
- Fixed an invisible button caused by the button and its text being the same color.
- Fixed a screen layout bug where a button was pushed off-screen.
- Renamed the app's branding from the default "Expo Starter" template to the actual project name.
- Tested the app on my phone using Expo Go, using tunnel mode since campus Wi-Fi blocked the normal connection.
- Committed and pushed all work only to my own branch (Devansh), never to main.

## Learning

- Learned how routing works in Expo Router, and that a file named index.tsx controls the home screen, which can cause bugs if not handled carefully.
- Learned that a web browser and a real phone don't always render the app the same way, so testing on both matters.
- Learned to always use theme colors instead of hardcoded colors like black/white, to avoid things becoming invisible in dark mode.
- Learned that building an app that works on phones is very different from actually publishing it on the App Store/Play Store, which needs a paid developer account and a fully working backend.

## Challenges Faced

- The invisible button bug took a while to figure out since there was no error, the button just wasn't visible.
- Campus Wi-Fi blocked my phone from connecting directly to my laptop, so I had to use a different connection method (tunnel mode).
- Some bugs looked like caching issues but were actually simple mistakes, so I had to check carefully before assuming the tool was broken.

## Next Steps

- Build the real Dashboard screen using the sample laundry data.
- Build Submit Laundry, History, Pickup QR, Notifications, and Complaints screens.
- Keep testing on both the browser and my phone as I build new screens.
- Check in with the backend teammate once the real APIs are ready.
