# W3 — Integrating Real Vendor Data and Improving the Interface

## Objective

The goal for Week 3 was to make CityServe more realistic by moving beyond sample vendor information and working with actual local business data. Along with this, we reviewed the existing website prototype and made changes to improve its UI and overall usability.

## Work Done

This week, we focused on collecting information about local businesses that could potentially be listed on CityServe. Since our initial target area was around the Thapar ecosystem and nearby locations, we started looking at businesses and services available in **Patiala**.

We wanted the prototype to represent realistic vendors rather than relying entirely on dummy entries. For this purpose, we collected local business information and compiled it into a structured dataset in CSV format.

The information collected included details such as:

* Business/vendor name
* Service category and subcategory
* Address and locality
* City
* Contact details
* Website, if available
* Location coordinates
* Customer rating
* Number of reviews
* Source of the information
* Place ID, where available

The dataset covered multiple categories of local businesses, including repair services, salons, mechanics, laundry, tailoring, electricians, plumbers and other service providers.

## Organising the Vendor Data

After collecting the information, we worked on arranging the data in a consistent format. This was important because the information would eventually need to be used by the application rather than remaining as a separate spreadsheet.

We also considered how the different fields in the dataset would correspond to the entities and attributes required by CityServe.

For example, a business collected from the dataset could eventually be represented as a **partner/vendor** in the application, while its category, location and rating could be used to support filtering, discovery and comparison.

The location data was particularly useful because one of the purposes of CityServe is to help users find relevant services in their surrounding area.

## UI Changes

While working on the dataset, we also reviewed the existing CityServe interface and realised that some parts of the UI could be simplified.

The earlier prototype contained several sections and components that were useful for demonstrating the concept but were not necessarily required in the actual user flow. We therefore started making UI changes to make the interface cleaner and more focused.

Some of the improvements included:

* Simplifying unnecessary sections and components
* Improving the organisation of service categories
* Making vendor information easier to understand
* Adjusting the interface to support the actual categories present in the dataset
* Preparing the UI so that vendor information can eventually be populated dynamically
* Improving the overall flow for discovering local services

This helped us move the frontend closer to the type of interface that an actual user would interact with instead of treating it only as a visual prototype.

## Connecting Data With the Application

Another important realisation this week was that the collected CSV should eventually become part of the application's data flow.

Instead of manually writing vendor information into the frontend, our aim is to have the application retrieve vendor records from the database. This would allow the same system to support searching, filtering, displaying ratings and showing location-related information.

The overall flow we started working towards was:

**Local Business Data → Structured Dataset → Database → CityServe Backend → UI**

Similarly, service-related information can eventually be connected with service records and user interactions.

## Key Learning

Week 3 helped us understand the difference between having a prototype that *looks functional* and having one that is backed by realistic data.

Working with actual local business information made us think more carefully about data consistency, location, categories and how vendor information should be represented inside the application.

At the same time, making UI changes showed us that adding more components does not necessarily improve a product. The interface needs to present the right information at the right stage of the user's journey.

By the end of the week, we had a more realistic vendor dataset and a cleaner direction for the CityServe UI, which gave us a better foundation for connecting the frontend with the actual application data in the upcoming weeks.
