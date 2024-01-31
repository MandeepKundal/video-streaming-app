import { Router } from "express";
import { upload } from "../middlewares/multer.middlewares.js"
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar, 
    updateUserCoverImage, 
    getUserChannelProfile, 
    getWatchHistory 
} from "../controllers/user.controllers.js";

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

userRouter.route("/refresh-token").post(
    refreshAccessToken // http://localhost:8000/api/v1/users/refresh-token
);

userRouter.route("/change-password").post(verifyJWT, changeCurrentPassword); // Only verified user will be able to change password which is why we added verifyJWT
userRouter.route("/current-user").get(verifyJWT, getCurrentUser);
userRouter.route("/update-account").patch(verifyJWT, updateAccountDetails); // Used Patch because we only want to update just one field

userRouter.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar); // Used first the verification and then the multer upload middleware
userRouter.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

userRouter.route("/channel/:username").get(verifyJWT, getUserChannelProfile); // We added colon before username (:username) because we are getting that value from params
userRouter.route("/history").get(verifyJWT, getWatchHistory);

export default userRouter;