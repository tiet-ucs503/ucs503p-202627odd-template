# Week 1 : Project Setup & Requirements

# Backend Initialization

## Goal:

Understand exactly what we're building and initialize the backend server.

## Relevant Context

We need to set up a Node.js + Express backend and configure MongoDB Atlas. The folder structure should include controllers, models, routes, middleware, and config. Environment variables need to be managed securely.

## Key Observation

The sprint plan mandates that the Express server must be running and the MongoDB connected successfully via `mongoose`. The structure must be modular enough to handle future weekly goals.

## Solution

- Created `package.json` and installed dependencies (`express`, `mongoose`, `dotenv`, `cors`).
- Initialized the Express application in `server.js`.
- Configured MongoDB connection logic in `config/db.js`.
- Organized the directory structure (`controllers`, `models`, `routes`, `middleware`, `config`) to prepare for MVC architecture.

