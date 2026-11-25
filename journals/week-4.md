# Week 4

## Work Done

- Built the final backend of the system using Supabase (PostgreSQL), with email OTP authentication for students.
- Ran SQL queries to inspect the existing tables, status rules, row-level security, and database functions, so that the frontend could be connected to the backend exactly as it was structured.
- Added the missing columns and tables and wrote SQL functions for the staff, admin, complaint, and pickup operations, where each function checks who is calling so that students see only their own laundry and staff see only their own hostel.
- Implemented the laundry-day and counter-hours rule, the order of the laundry statuses, and the single-use pickup code inside the database.
- Connected the frontend to the backend and replaced the sample data with real data.
- Created the admin account and one staff account for every hostel using SQL scripts, and loaded sample students and laundry requests so that every screen could be demonstrated.
- Changed the staff login so that staff enter their mobile number and receive the OTP on their registered email, and registered the staff accounts with Gmail plus-addresses such as dhawanr1931+a@gmail.com so that all the codes reach the team's inboxes.
- Redesigned the login page with a cleaner layout and a Student and Staff/Admin switch.
- Fixed the bug where every student's profile showed Semester 7 and the year 2023, and made editing the admission year update the student's record instead of creating a second one.
- Tested the complete workflow from laundry submission to collection with real data, including rejection of an already-used pickup code, and made the final checks and improvements.
- Deployed the application on Vercel and pushed the final frontend to the project's GitHub repository.

## Learning

- Learned how to connect a React Native and Expo frontend to a Supabase backend and how SQL functions can be used to keep the data secure.
- Understood the importance of inspecting an existing database before connecting a frontend to it.
- Learned how row-level security and role checks inside the database protect data even if the application changes.
- Gained experience in solving a practical authentication limitation by changing the design of the login flow.
- Learned how testing the complete workflow with real data helps find bugs that single-screen testing does not.
- Gained practical experience in deploying an application and keeping the code repository updated.

## Challenges Faced

- Phone-number OTP could not be used for staff login because it needs an SMS service, which was not available.
- The profile screen showed the wrong semester, caused by the screen picking the first active semester and by duplicate records created when the profile was edited.
- Matching the frontend to a database that already existed, with its own table structure and rules.
- Setting up the staff and admin accounts for all the hostels with working email addresses for the OTP.
- Making sure that staff of one hostel cannot see the laundry of another hostel.

## Next Steps

- Complete the final testing of the deployed application with all three roles.
- Update the project report with the final implementation, screenshots, and testing results.
- Update the project presentation with the final system and prepare the demonstration.
- Coordinate with the team to make sure the documentation matches the final system.
- Prepare for the final demonstration of the project.
