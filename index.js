require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { addHours, addMinutes, format } = require('date-fns');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
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
    console.log("Connected to MongoDB");

    const db = client.db("luminedge");
    const usersCollection = db.collection("users");
   // const coursesCollection = db.collection("courses");
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
    //   console.log("Courses initialized");
    // };
    // await initializeCourses();

    // Admin Route to Create Schedule for a Course
    app.post("/api/v1/admin/schedule", async (req, res) => {
      const { courseId, startDate, endDate,slot,timeSlots, startTime, endTime, interval = 30 } = req.body;
      console.log(req.body);
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      console.log(startDateObj,endDateObj);
     

          const existingSchedule = await schedulesCollection.findOne({
            courseId,
            startDate,
            endDate,
          });
          if(existingSchedule){``
            return res.status(400).json({ message: "Schedule already exists" });
          }

          else {
            await schedulesCollection.insertOne(req.body);
            
          }


       res.json({ success: true, message: "Schedules created successfully", timeSlots });
    });

    // User Route to Book a Slot
 // User Route to Book a Slot
 app.post("/api/v1/user/book-slot", async (req, res) => {
  const { scheduleId, userId, slotId } = req.body;

  // Fetch the user
  const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

  // Check if the user has enough mock tests
  if (!user || user.mock < 1) {
    return res.status(400).json({ message: "Insufficient mock tests available" });
  }

  // Fetch the schedule
  const schedule = await schedulesCollection.findOne({ _id: new ObjectId(scheduleId) });
  if (!schedule) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  // Retrieve the selected time slot details for the schedule being booked
  const selectedTimeSlot = schedule.timeSlots.find(slot => slot.slotId === slotId);
  if (!selectedTimeSlot || selectedTimeSlot.slot < 1) {
    return res.status(400).json({ message: "Invalid or unavailable time slot selected." });
  }
console.log(userId,scheduleId,schedule.startDate,slotId);
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
    bookingDate: schedule.startDate,
    startTime: selectedTimeSlot.startTime,
    endTime: selectedTimeSlot.endTime
  };
  await bookingMockCollection.insertOne(bookingRecord);

  res.json({ success: true, message: "Slot booked successfully", bookingRecord });
});
app.delete("/api/v1/user/cancel-booking", async (req, res) => {
  const { scheduleId, userId, slotId } = req.body;

  // Check if the booking exists in bookingCollection
  const existingBooking = await bookingCollection.findOne({
    userId: userId,
    scheduleId: scheduleId,
    slotId: slotId
  });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found." });
  }

  // Remove the booking from bookingCollection
  await bookingCollection.deleteOne({
    userId: userId,
    scheduleId: scheduleId,
    slotId: slotId
  });

  // Update the slot in schedulesCollection to make it available again
  await schedulesCollection.updateOne(
    { _id: new ObjectId(scheduleId), "timeSlots.slotId": slotId },
    {
      $inc: { "timeSlots.$.slot": 1 } // Increase slot count by 1
    }
  );

  // Increase mock count for the user
  await usersCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { mock: 1 } }
  );

  res.json({ success: true, message: "Booking canceled successfully" });
});


    // User Registration

    
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password,contactNo,mock,result,passportNumber, role } = req.body;
      console.log(req.body);
    
      //Check if the user already exists by email
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
    
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log(hashedPassword);
    
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

      const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });

      res.json({ success: true, accessToken: token });
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
