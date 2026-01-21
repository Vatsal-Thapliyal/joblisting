const express = require("express");
const cors = require("cors");
const jobRoutes = require("./Routes/importRoutes");
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000"
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Job Listing Backend is running"
  });
});

app.use("/api", jobRoutes);

module.exports = app;