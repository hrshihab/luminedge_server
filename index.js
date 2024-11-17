require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { addHours, addMinutes, format } = require('date-fns');
const cookieParser = require("cookie-parser");


const app = express();
const port = process.env.PORT || 5000;
app.use(cookieParser());


app.use(cors({ origin: 'http://localhost:3000', credentials: true })); // 
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

    // get all schedule by user id
    app.get("/api/v1/schedule/:userId", async (req, res) => {
      const { userId } = req.params;
      console.log(userId);
      const schedules = await schedulesCollection.find({ userId: userId }).toArray();
      res.json({ schedules });
    });

 // User Route to Book a Slot
 app.post("/api/v1/user/book-slot", async (req, res) => {
  const { scheduleId, userId, slotId,status,testType,testSystem } = req.body;
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
  if (!selectedTimeSlot || selectedTimeSlot.slot < 1) {
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
// get all booking by userId
app.get("/api/v1/user/bookings/:userId", async (req, res) => {
  const { userId } = req.params;
  const bookings = await bookingMockCollection.find({ userId }).toArray();
  res.json({ bookings });
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
        mock,
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
    

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;
      console.log(req.body);
      const user = await usersCollection.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign({ email: user.email,userId:user._id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });
      res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
      res.json({ success: true, accessToken: token });
    });

    //get single user by id
    app.get("/api/v1/user/:userId", async (req, res) => {
      const { userId } = req.params;
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      res.json({ user });
    });

    //single user status change
    app.put("/api/v1/user/status/:userId", async (req, res) => {
      const { userId } = req.params;
      const { status } = req.body;
      await usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { status } });
      res.json({ success: true, message: "User status updated successfully" });
    });

    // Test route
    app.get("/", (req, res) => {
      res.json({ message: "Server is running smoothly", timestamp: new Date() });
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);
