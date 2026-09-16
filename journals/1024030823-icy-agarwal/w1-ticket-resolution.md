# Week 1

## Work Done

- Finalized the problem statement and objectives for the **Digital Hostel Laundry Management System**.
- Identified the three main system actors: **Student, Laundry Staff, and Admin**.
- Defined the major functional and non-functional requirements of the system.
- Reviewed the project repository structure and documentation requirements.
- Designed the initial **Use Case Diagram**.
- Designed the initial **Activity Diagram**.
- Designed the initial **Class Diagram**.
- Designed the initial **Data Flow Diagram (DFD)**.
- Designed the initial **Sequence Diagram**.
- Identified the initial database entities and their relationships.
- Finalized the system architecture and selected the technology stack consisting of **React Native with Expo for the frontend, Node.js with Express for the backend, and Supabase for PostgreSQL database and authentication services**.
- Designed the database schema required for students, hostels, semesters, staff, laundry requests, laundry items, laundry batches, pickup tokens, complaints, notifications, and audit logs.
- Created the required database tables and relationships in **Supabase**.
- Set up the Node.js and Express backend environment.
- Connected the backend to Supabase and verified the database connection successfully.
- Implemented the initial authentication routes for college-email-based authentication using Supabase Auth.
- Tested the authentication endpoint and verified that the login email could be successfully requested.
- Initialized the **React Native Expo frontend** in the project repository.
- Organized the project into separate frontend and backend components to support modular development.

## Learning

Learned how to convert system requirements into a complete implementation plan involving frontend, backend, database, and authentication components. Gained practical experience with designing relational database schemas in Supabase, setting up a Node.js and Express backend, connecting it with Supabase, and initializing a React Native application using Expo.

Also learned the importance of separating frontend and backend responsibilities and maintaining a structured project repository so that different team members can work on different components independently.

## Challenges Faced

- Translating the physical laundry workflow into a digital system while keeping the process practical for students and laundry staff.
- Determining the responsibilities and access levels of the Student, Laundry Staff, and Admin roles.
- Designing the database structure while maintaining relationships between students, hostel assignments, semesters, laundry requests, and laundry items.
- Configuring Supabase authentication and understanding the difference between OTP-based and magic-link email authentication.
- Setting up the frontend and backend as separate components while keeping them organized within the existing course repository.

## Next Steps

- Complete the frontend authentication and login interface.
- Connect the React Native frontend with the backend and Supabase authentication.
- Implement student registration/profile functionality.
- Implement the laundry request submission workflow.
- Implement the initial student dashboard and laundry status screens.
- Develop and test the corresponding backend APIs.
- Continue integrating the frontend, backend, and database into the first working prototype.