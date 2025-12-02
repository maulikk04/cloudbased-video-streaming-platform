import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import cors from "cors";


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);

// Protected Test Route
import { auth } from "./middleware/auth.js";
app.get("/api/protected", auth, (req, res) => {
  res.json({ message: "Protected data", user: req.user });
});

const PORT = 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
