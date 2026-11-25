# Week 2

## Work Done

- Developed the MVP of the student-side application for the Digital Hostel Laundry Management System, based on the finalized workflow and requirements.
- Built the student sign-in flow with email OTP verification and a one-time profile setup that collects the student's name, hostel, room number, and mobile number.
- Developed the Submit Laundry screen with the clothing categories and quantity counters, along with remarks for the staff.
- Implemented the counter-hours rule in the student application, so laundry can be submitted only on the hostel's laundry days and within the counter timings.
- Developed the laundry history and status tracking screens so a student can follow a request through every stage.
- Built the pickup screen with a QR code and a 6-digit backup code, along with the complaints and notifications screens.
- Developed the MVP of the staff-side application, including the verification queue where staff correct the physical count of clothes while the student's original entry is kept for the record.
- Built the tagging screen that generates a batch ID, and the queues for laundry in process, returned laundry, and laundry ready for pickup, including marking several batches as returned together.
- Implemented the pickup confirmation screen where staff scan the QR code or enter the backup code, and the code becomes invalid once the laundry is collected.
- Defined one common status lifecycle for both applications: Submitted, Verified, Tagged, In Laundry, Returned, Ready for Pickup, and Collected.

## Learning

- Learned how to convert the finalized workflow and diagrams into working screens for the student and staff users.
- Understood the importance of defining the status lifecycle once and using it consistently across different parts of the application.
- Learned how keeping the student's original count next to the staff-verified count helps avoid disputes.
- Gained practical experience in designing single-use pickup codes and handling already-used codes clearly.
- Learned how business rules such as laundry days and counter timings can be reflected in the user interface.
- Gained experience in building a prototype that can be demonstrated from the first screen to the last stage of the workflow.

## Challenges Faced

- Keeping the student and staff screens consistent, since both describe the same laundry batch from different points of view.
- Translating the counter timings and the hostel-wise laundry schedule into clear rules in the interface.
- Designing the pickup process so that a code cannot be used more than once.
- Deciding the information that staff and students should each see at every stage of the workflow.
- Making sure the prototype stayed consistent with the system design and the project report.

## Next Steps

- Develop the admin-side prototype and combine the student, staff, and admin screens into one application.
- Unify the clothing categories, status names, and hostel schedule across all the screens.
- Prepare the application so that the complete workflow can be demonstrated for all three roles.
- Plan how the combined application will connect with the backend and the database.
- Test the complete flow from laundry submission to collection and document the results.
