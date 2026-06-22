import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const protectAndCheckCredits = async (req, res, next) => {
  let token;

  // 1. Check if the token is provided in the headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // 2. Decode the token to get the User ID
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Find the user in the database (excluding the password)
      req.user = await User.findById(decoded.id).select("-password");

      // 4. THE PAYWALL: Check if they have enough credits
      if (req.user.credits <= 0) {
        return res
          .status(403)
          .json({ message: "Insufficient credits. Please upgrade." });
      }

      // If they have a token AND credits, let them pass!
      next();
    } catch (error) {
      console.error("Auth Error:", error.message);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token provided" });
  }
};
