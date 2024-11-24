require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { addHours, addMinutes, format } = require('date-fns');
const cookieParser = require("cookie-parser");
const {  emailSender } = require("./emailSender");
const nodemailer = require('nodemailer');



const app = express();
const port = process.env.PORT || 5000;
app.use(cookieParser());


app.use(cors({ origin: 'http://localhost:3000',credentials: true })); // 
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    //console.log("Connected to MongoDB");

    const db = client.db("luminedge");
    const usersCollection = db.collection("users");
    const coursesCollection = db.collection("courses");
    const schedulesCollection = db.collection("schedules");
    const bookingMockCollection = db.collection("bookingMock");

    // Step 1: Initialize Courses
    // const initializeCourses = async () => {
    //   const courses = ["IELTS", "Pearson PTE", "GRE", "TOEFL"];
    //   for (const course of courses) {
    //     const existingCourse = await coursesCollection.findOne({ name: course });
    //     if (!existingCourse) {
    //       await coursesCollection.insertOne({ name: course, createdAt: new Date(), updatedAt: new Date() });
    //     }
    //   }
    //   //console.log("Courses initialized");
    // };
    // await initializeCourses();

    // Admin Route to Create Schedule for a Course
    //get all course by anyone
    app.get("/api/v1/courses", async (req, res) => {
      const courses = await coursesCollection.find({}).toArray();
      res.json({ courses });
    });

    app.post("/api/v1/admin/create-schedule", async (req, res) => {
      //console.log(req.body);
      const schedules = req.body; // Expecting an array of schedule objects
      const failedSchedules = [];
      const successfulSchedules = [];

      for (const schedule of schedules) {
        const { courseId, startDate, endDate, slot, timeSlots, startTime, endTime, interval = 30 } = schedule;
        //convert slot to number
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        const existingSchedule = await schedulesCollection.findOne({
          courseId,
          startDate,
          endDate,
        });
        schedule.createdAt = new Date().toISOString();

        if (existingSchedule) {
          failedSchedules.push({ courseId, startDate, endDate, message: "Schedule already exists", timestamp: new Date().toISOString() });
        } else {
          // Convert slot to a number if it's not already
          schedule.timeSlots = schedule.timeSlots.map(slot => ({
            ...slot,
            slot: Number(slot.slot) // Ensure slot is a number
          }));

          await schedulesCollection.insertOne(schedule);
          successfulSchedules.push({ courseId, startDate, endDate, createdAt: new Date().toISOString() });
        }
      }

      res.json({
        success: true,
        message: "Schedules processed",
        successfulSchedules,
        failedSchedules,
      });
    });
    //get schedule by date
    app.get("/api/v1/schedule/:date/:courseId", async (req, res) => {
      const { date,courseId } = req.params;
     // //console.log('date',date);
      const schedules = await schedulesCollection.find({ startDate: date,courseId:courseId }).toArray();
      res.json({ schedules });
    });

    // get users by schedule id and slot id
    // app.get("/api/v1/schedule/:scheduleId/:slotId", async (req, res) => {
    //   const { scheduleId,slotId } = req.params;
    //   console.log(scheduleId,slotId);
    //   console.log('come');
    //   console.log("bookingMockCollection");
    //   const users = await bookingMockCollection.find({ scheduleId,slotId }).toArray();
    //   if(users.length > 0){
    //     res.json({ users });
    //   }else{
    //     res.status(404).json({ message: "No users found" });
    //   }
    // });
    

    // get all schedule by user id
    app.get("/api/v1/schedule/:userId", async (req, res) => {
      const { userId } = req.params;
      //console.log(userId);
      const schedules = await schedulesCollection.find({ userId: userId }).toArray();
      res.json({ schedules });
    });

 // User Route to Book a Slot
 app.post("/api/v1/user/book-slot", async (req, res) => {
  //when book a slot add a field name of test 
  const { scheduleId, userId, slotId,status,testType,testSystem,name } = req.body;
  //console.log(req.body);

  // Fetch the user
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  // Check if the user has enough mock tests
  if (!user || user.mock < 1) {
    return res.status(400).json({ message: "Insufficient mock tests available" });
  }
  ////console.log(user);

  // Fetch the schedule
  const schedule = await schedulesCollection.findOne({ _id: new ObjectId(scheduleId) });
  if (!schedule) {
    return res.status(404).json({ message: "Schedule not found" });
  }
  ////console.log(schedule);
  // Retrieve the selected time slot details for the schedule being booked
  const selectedTimeSlot = schedule.timeSlots.find(slot => slot.slotId === slotId);
  if (!selectedTimeSlot || Number(selectedTimeSlot.slot) < 1) {
    return res.status(400).json({ message: "Invalid or unavailable time slot selected." });
  }
////console.log(userId,scheduleId,schedule.startDate,slotId);
// Check if the user has an existing booking with the same date and exact same time slot
const existingBooking = await bookingMockCollection.findOne({
  userId: userId,
  scheduleId: scheduleId,
  bookingDate: schedule.startDate,
  slotId: slotId
});

if (existingBooking) {
  return res.status(400).json({ message: "User has already booked this time slot for the selected date." });
}


  // Proceed with booking
  await schedulesCollection.updateOne(
    { _id: new ObjectId(scheduleId), "timeSlots.slotId": slotId },
    {
      $inc: { "timeSlots.$.slot": -1 }, // Decrease slot count by 1
      
    }
  );

  // Decrease mock count for the user
  await usersCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { mock: -1 } }
  );

  // Create a booking record in the bookingMock collection
  const bookingRecord = {
    userId: userId,
    scheduleId: scheduleId,
    slotId: slotId,
    status,
    name,
    testType,
    testSystem,
    bookingDate: schedule.startDate,
    startTime: selectedTimeSlot.startTime,
    endTime: selectedTimeSlot.endTime
  };
  //console.log(bookingRecord);
  await bookingMockCollection.insertOne(bookingRecord);
  res.json({ success: true, message: "Slot booked successfully", bookingRecord });
});
//get all bookings
app.get("/api/v1/admin/bookings", async (req, res) => {
  const bookings = await bookingMockCollection.find({}).toArray();
  if(bookings.length > 0){
    res.json({ bookings });
  }else{
    res.status(404).json({ message: "No bookings found" });
  }
});
// get all booking by userId
app.get("/api/v1/user/bookings/:userId", async (req, res) => {
  const { userId } = req.params;
  const bookings = await bookingMockCollection.find({ userId }).toArray();
  res.json({ bookings });
});
// Update user booking status and attendance
app.put("/api/v1/user/bookings/:scheduleId", async (req, res) => {
  const { scheduleId } = req.params;
  const { userId, status, attendance } = req.body;
 console.log(scheduleId, userId, status, attendance)

  // Validate scheduleId
  if (!ObjectId.isValid(scheduleId)) {
    return res.status(400).json({ message: "Invalid schedule ID format" });
  }

  try {
    const updateResult = await bookingMockCollection.updateOne(
      { scheduleId:scheduleId, userId: userId },
      { $set: { status: status, attendance: attendance } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.json({ success: true, message: "Booking status and attendance updated successfully" });
  } catch (error) {
    console.error("Error updating booking status:", error); // Log the error
    res.status(500).json({ message: "Error updating booking status", error });
  }
});



//cancel booking if status is active
  app.delete("/api/v1/bookings/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  // Check if the booking exists in bookingCollection
  const existingBooking = await bookingMockCollection.findOne({
    _id: new ObjectId(bookingId)
  });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found." });
  }

  // Remove the booking from bookingCollection
  await bookingMockCollection.deleteOne({
    _id: new ObjectId(bookingId)
  });

  // Update the slot in schedulesCollection to make it available again
  await schedulesCollection.updateOne(
    { _id: new ObjectId(existingBooking.scheduleId), "timeSlots.slotId": existingBooking.slotId },
    {
      $inc: { "timeSlots.$.slot": 1 } // Increase slot count by 1
    }
  );

  // Increase mock count for the user
  await usersCollection.updateOne(
    { _id: new ObjectId(existingBooking.userId) },
    { $inc: { mock: 1 } }
  );

  res.json({ success: true, message: "Booking canceled successfully" });
});

//user status by user id
app.get("/api/v1/user/status/:userId", async (req, res) => {
  const { userId } = req.params;
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
  res.json({ user });
});


    // User Registration

    
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password,contactNo,mock,result,passportNumber, role } = req.body;
      //console.log(req.body);
    
      //Check if the user already exists by email
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
    
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(password, 10);
      //console.log(hashedPassword);
    
      // Define the role and default fields
      const newUser = {
        _id: new ObjectId(),
        name,
        email,
        contactNo,
        passportNumber,
        password: hashedPassword,
        mock:0,
        result,
        role: role || "user",  // Default role to "user" if not specified
        status: "active",  // Set default status
        isDeleted: false,  // Default to false for active users
        createdAt: new Date(),
        updatedAt: new Date()
      };
    
      // // Insert the new user into the database
      await usersCollection.insertOne(newUser);
    
     res.status(201).json({ message: "User registered successfully", userId: newUser.id });
    });

    //Get All Users by Admin
    app.get("/api/v1/admin/users", async (req, res) => {

      const users = await usersCollection.find({}).toArray();
      res.json({ users });
    });

    // update user mock count ${process.env.NEXT_PUBLIC_BACKEND_URL}/user/update/${selectedUser._id}
    // when mock is updated its add an new field in user collection called totalMock
    app.put("/api/v1/user/update/:userId/:mock", async (req, res) => {
      const { userId,mock } = req.params;
      const {transactionId,mockType} = req.body;
      //console.log(mockType)
      //convert mock to number  
      const mockNumber = Number(mock);
      //console.log(userId,mockNumber);
      const result = await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { mock: mockNumber,mockType : mockType,totalMock:mockNumber,transactionId : transactionId } });
      if (!result) {
        return res.status(500).json({ message: "Failed to update user mock count" });
      }
      res.json({ success: true, message: "User mock count updated successfully" });
    });
    

    // User Login
    app.post("/api/v1/login", async (req, res, next) => {
      try {
        const { email, password } = req.body;
        //console.log(req.body);
        const user = await usersCollection.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ email: user.email, userId: user._id, role: user.role }, process.env.JWT_SECRET, {
          expiresIn: process.env.EXPIRES_IN,
        });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
        res.json({ success: true, accessToken: token });
      } catch (error) {
        next(error); // Pass the error to the global error handler
      }
    });

    //get single user by id
    app.get("/api/v1/user/:userId", async (req, res) => {
      const { userId } = req.params;
      //console.log(userId)
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      
      res.json({ user });
    });
    

    //single user status change
    app.put("/api/v1/user/status/:userId", async (req, res) => {
      const { userId } = req.params;
      const { status } = req.body;

      // Validate userId
      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({ success: true, message: "User status updated successfully" });
      } catch (error) {
        console.error("Error updating user status:", error); // Log the error
        res.status(500).json({ message: "Error updating user status", error });
      }
    });

    // Test route
    app.get("/", (req, res) => {
      res.json({ message: "Server is running smoothly", timestamp: new Date() });
    });

    // Fetch all schedules
    app.get("/api/v1/admin/get-schedules", async (req, res) => {
      try {
        //console.log("Fetching all schedules");
        const schedules = await schedulesCollection.find({}).toArray();
        //console.log(schedules); if 0 then also return 0
        res.json(schedules);
      } catch (error) {
        res.status(500).json({ message: "Error fetching schedules", error });
      }
    });

    // Delete a schedule by ID
    app.delete("/api/v1/admin/delete-schedule/:id", async (req, res) => {
      const { id } = req.params;
      //console.log(id);
      try {
        const result = await schedulesCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Schedule not found" });
        }
        res.json({ success: true, message: "Schedule deleted successfully" });
      } catch (error) {
        res.status(500).json({ message: "Error deleting schedule", error });
      }
    });

    // Fetch all users
    app.get("/api/v1/user/all", async (req, res) => {
      try {
        //console.log("Fetching all users");
        const users = await usersCollection.find({}).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ message: "Error fetching users", error });
      }
    });

    // Update user status
    app.put("/api/v1/user/status/:userId", async (req, res) => {
      const { userId } = req.params;
      const { status } = req.body;

      // Validate userId
      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID format" });
      }

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({ success: true, message: "User status updated successfully" });
      } catch (error) {
        console.error("Error updating user status:", error); // Log the error
        res.status(500).json({ message: "Error updating user status", error });
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

    // change password route
 
// Change Password Function
app.put("/api/v1/user/change-password", async (req, res) => { 
  const { email, oldPassword, newPassword } = req.body;
  const user = await usersCollection.findOne({ email });
  const userData = await usersCollection.findOne({
      email: user.email,
      status: "active"
  });

  if (!userData) {
      throw new Error("User not found or inactive!");
  }

  const isCorrectPassword = await bcrypt.compare(payload.oldPassword, userData.password);

  if (!isCorrectPassword) {
      throw new Error("Password incorrect!");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 12);

  await usersCollection.updateOne(
      { email: user.email },
      { $set: { password: hashedPassword, needPasswordChange: false } }
  );

  return {
      message: "Password changed successfully!"
  };
});

// Forgot Password Function
app.post("/api/v1/auth/forget-password", async (req, res) => {
  const { email } = req.body;
  console.log(email);

  const userData = await usersCollection.findOne({
      email
  });
  console.log(userData)

  if (!userData) {
      return res.status(404).json({ success: false, message: "User not found or inactive!" });
  }

  const resetPassToken = jwt.sign(
      { email: userData.email, role: userData.role },
      process.env.JWT_RESET_PASS_SECRET,
      { expiresIn: process.env.JWT_RESET_PASS_TOKEN_EXPIRES_IN }
  );

  const resetPassLink = `${process.env.RESET_PASS_LINK}?userId=${userData._id}&token=${resetPassToken}`;
 console.log(resetPassLink);
  await emailSender(
      userData.email,
      `
      <div>
          <p>Dear User,</p>
          <p>We received a request to reset your password. Please click the button below to proceed with resetting your password. If you did not request a password reset, please ignore this email.</p>
          <p>Your password reset link:</p>
          <a href="${resetPassLink}" style="text-decoration: none;">
              <button style="background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                  Reset Password
              </button>
          </a>
          <p>If the button above does not work, you can copy and paste the following link into your browser:</p>
          <p>${resetPassLink}</p>
          <p>Thank you,</p>
          <p>Your Company Name</p>
      </div>
      `
  );
  res.json({ success: true, message: "Password reset link sent successfully" });
});

// Reset Password Function
app.put("/api/v1/auth/reset-password", async (req, res) => {
  const { userId, token, newPassword } = req.body;
  //console.log(userId,token,newPassword);
  const isValidToken = jwt.verify(token, process.env.JWT_RESET_PASS_SECRET);

  if (!isValidToken) {
      throw new Error("Invalid or expired token!");
  }

  const userData = await usersCollection.findOne({
      _id: new ObjectId(userId),
     
  });

  if (!userData) {
      throw new Error("User not found or inactive!");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword } }
  );
  res.json({ success: true, message: "Password reset successfully" });
});

// Block/Unblock User
app.put("/api/v1/user/block/:userId", async (req, res) => {
  const { userId } = req.params;
  const { isDeleted } = req.body; // Expecting the isDeleted status from the request body

  //console.log(isDeleted)
  // Validate userId
  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid user ID format" });
  }

  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { isDeleted: isDeleted } } // Update isDeleted status
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ success: true, message: `User ${isDeleted ? "blocked" : "unblocked"} successfully` });
  } catch (error) {
    console.error("Error updating user status:", error); // Log the error
    res.status(500).json({ message: "Error updating user status", error });
  }
});

    
  } finally {
  }
}

run().catch(console.dir);

// Add this middleware at the end of your route definitions
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(500).json({ message: "An unexpected error occurred. Please try again later." });
});
