import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { db } from "../config/db.js";

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Check if user already exists
    const existing = await db.send(new GetCommand({
      TableName: process.env.DYNAMO_TABLE,
      Key: { email },
    }));

    if (existing.Item) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Store user
    await db.send(new PutCommand({
      TableName: process.env.DYNAMO_TABLE,
      Item: {
        email,
        name,
        password: hashed,
        role:  "user",
        createdAt: new Date().toISOString(),
      },
    }));

    return res.json({ message: "User registered successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch user
    const result = await db.send(new GetCommand({
      TableName: process.env.DYNAMO_TABLE,
      Key: { email },
    }));

    const user = result.Item;
    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    // Create JWT
    const token = jwt.sign(
      { email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
