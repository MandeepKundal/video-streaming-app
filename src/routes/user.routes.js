import { Router } from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js"
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const userRouter = Router();
userRouter.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser // http://localhost:8000/api/v1/users/register
);

userRouter.route("/login").post(
    loginUser // http://localhost:8000/api/v1/users/login
);

// Secured routes
userRouter.route("/logout").post(
    verifyJWT, // Use verifyJWT middleware
    logoutUser // http://localhost:8000/api/v1/users/logout
);

export default userRouter;