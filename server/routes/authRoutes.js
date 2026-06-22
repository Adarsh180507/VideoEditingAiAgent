import express from "express";
import { authController } from "../controllers/authController.js";

const router = express.Router();

// The doors to register and login
router.post("/register", authController.register);
router.post("/login", authController.login);

export default router;
