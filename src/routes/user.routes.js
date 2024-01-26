import { Router } from "express";
import { registerUser } from "../controllers/user.controllers.js";

const userRouter = Router();
userRouter.route("/register").post(registerUser); // https://localhost:8000/api/v1/users/register

export default userRouter;