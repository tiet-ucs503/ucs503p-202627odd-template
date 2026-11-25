# Week 3

## Work Done

- Connected the three separate frontends of the project, the student, staff, and admin applications, into one working MVP.
- Rebuilt the prototypes as a single application using React Native, TypeScript, and Expo Router, where the role of the logged-in user decides whether the student, staff, or admin screens open.
- Developed the admin screens, including the dashboard, batches, complaints, students, staff, hostels, clothing categories, audit log, and reports.
- Created a shared set of screen components and one common data layer, so every screen reads and writes data through the same functions.
- Added a demo mode with in-memory sample data so that the complete workflow could be demonstrated without a backend.
- Tested the full flow in the browser: a student submits laundry, staff verify, tag, and hand it over, and the admin reviews the audit log.
- Documented the list of data operations required from the backend, so that the backend could be built to match the frontend.
- Prepared the application to be deployed as a website as well as a phone application.

## Learning

- Learned how three separate prototypes can be combined into one application using role-based navigation.
- Understood how placing all data access behind one layer allows the same screens to work with sample data now and the real database later.
- Gained experience in structuring a larger React Native and Expo project with shared components and reusable logic.
- Learned how to test a complete multi-role workflow instead of testing screens one by one.
- Understood how a documented list of backend operations helps the frontend and backend stay aligned.
- Gained practical exposure to preparing an application for deployment.

## Challenges Faced

- The three prototypes used different category lists, status names, and hostel details, which had to be unified into one consistent set.
- Refreshing a page took the user back to the home screen, which had to be fixed by restoring the saved login before showing any page.
- Keeping the role-based access correct, so that each user sees only the screens and data meant for their role.
- Testing the complete workflow across the three roles took time and required repeating the same flow many times.
- Keeping the combined application consistent with the project documentation and presentation.

## Next Steps

- Connect the application to the real backend and database in place of the sample data.
- Create the admin and staff accounts and prepare sample data for the final demonstration.
- Check the existing database structure and make the frontend match it.
- Test the full system with real data and fix the issues found.
- Deploy the application and update the project documentation with the final implementation details.
