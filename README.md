# LuminEdge Mock Test Platform  

![LuminEdge](https://your-image-link.com) <!-- Replace with your project banner or logo -->

## Overview  
LuminEdge is a robust, feature-rich platform designed to conduct mock tests for **IELTS**, **TOEFL**, **GRE**, and more. With seamless **role-based management**, **dynamic scheduling**, and a user-friendly interface, it caters to 500+ active users across **Dhaka** and **Khulna branches**.  

### Key Features  
- **Role Management**:  
  - **Admin Panel**: Manage users, courses, and schedules.  
  - **Student Dashboard**: Access tests, track progress, and view analytics.  
  - **Examiner Panel**: Review submissions and manage test schedules.  
- **Dynamic Test Scheduling**:  
  - Create and manage schedules with ease.  
  - Support for multiple test types and custom time slots.  
- **Booking System**:  
  - Secure slot booking with real-time availability updates.  
  - Prevent duplicate bookings and ensure a smooth experience.  
- **Performance Analytics**:  
  - Detailed test performance reports.  
  - Attendance tracking and performance comparison.  
- **Scalable Architecture**:  
  - Built to handle high concurrent users without performance degradation.  

---

## Tech Stack  
**Frontend**:  
- [Next.js](https://nextjs.org/)  
- [TailwindCSS](https://tailwindcss.com/)  
- [Redux](https://redux.js.org/)  

**Backend**:  
- [Node.js](https://nodejs.org/)  
- [Express.js](https://expressjs.com/)  
- [MongoDB](https://www.mongodb.com/)  

**Other Technologies**:  
- **JWT**: Secure authentication and authorization.  
- **Date-fns**: Handle date and time functionalities.  
- **Nodemailer**: Email notifications and password recovery.  

---

## Setup Instructions  

### Prerequisites  
- Node.js (v16+)
- MongoDB instance  
- Environment variables configured in `.env` file  

### Installation  
1. Clone the repository:  
   ```bash  
   git clone https://github.com/your-username/luminedge-platform.git  
   cd luminedge-platform  
   ```  

2. Install dependencies:  
   ```bash  
   npm install  
   ```  

3. Set up environment variables in `.env`:  
   ```env  
    🙂
   ```  

4. Start the development server:  
   ```bash  
   npm run dev  
   ```  

5. Access the application at:  
   ```
   http://localhost:5000  
   ```

---

## API Endpoints  

### Public Endpoints  
- **GET** `/api/v1/courses` – Fetch all available courses.  
- **POST** `/api/v1/login` – User login.  
- **POST** `/api/v1/register` – User registration.  

### Admin Endpoints  
- **POST** `/api/v1/admin/create-schedule` – Create a new schedule.  
- **GET** `/api/v1/admin/bookings` – Fetch all bookings.  
- **DELETE** `/api/v1/admin/delete-schedule/:id` – Delete a schedule.  

### User Endpoints  
- **POST** `/api/v1/user/book-slot` – Book a test slot.  
- **GET** `/api/v1/user/bookings/:userId` – Get bookings for a user.  
- **PUT** `/api/v1/user/status/:userId` – Update user status.  

---

## Screenshots  
**Admin Panel:**  
*Manage courses, users, and schedules seamlessly.*  
![Admin Panel](https://your-image-link.com)  

**Student Dashboard:**  
*Track progress, book slots, and access tests.*  
![Student Dashboard](https://your-image-link.com)  

---
