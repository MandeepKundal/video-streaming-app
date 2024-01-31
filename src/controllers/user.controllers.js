import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const registerUser = asyncHandler(async(req, res) => {
    // Get user details from front end
    const {
        fullName,
        email,
        username,
        password
    } = req.body;
    console.log(req.body);
    // Add validation to check user input
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }
    // Check user's email and username to avoid duplicate registration
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });
    if (existingUser) throw new ApiError(409, "User name or email already exists");
    // Check for images: avatar and coverImage
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) coverImageLocalPath = req.files.coverImage[0].path;
    if (!avatarLocalPath) throw new ApiError(400, "Avatar is required");
    // Upload avatar to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!avatar) throw new ApiError(400, "Avatar is required");
    // Create user object & create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" // Remove password & refresh token fields from response
    );
    // Confirm user creation
    if (!createdUser) throw new ApiError(400, "Issue while registering the user");
    // Return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
});

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        // Saving user in order to save refreshToken in db
        await user.save({
            validateBeforeSave: false // Here we are setting validateBeforeSave to false because we don't need to validate anything when saving the updated user
        });

        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Error when generating refresh and access tokens");
    }
}

// Set cookie options httpOnly and secure so that the cookie can only be modified in server and not front end
const options = {
    httpOnly: true,
    secure: true
};

const loginUser = asyncHandler(async(req, res) => {
    // Get data from request body
    const {
        email, username, password
    } = req.body;
    // Check username/email
    if (!username && !email) throw new ApiError(400, "Username and Email fields are required");
    // if (!(username || email)) throw new ApiError(400, "Username or Email is required");
    // Find user in db
    const user = await User.findOne({
        $or: [{username}, {email}]
    });
    if (!user) throw new ApiError(404, "User with the given Username or Email does not exist");
    // Check password
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) throw new ApiError(401, "Invalid user credentials");
    // Generate Access Token and Refresh Token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
    // Fetch the updated User from db
    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken"); // To leave the fields we don't need

    // Send secure cookie to user
    return res.status(200)
        .cookie("accessToken", accessToken, options) // Set accessToken in the cookie
        .cookie("refreshToken", refreshToken, options) // Set refreshToken in the cookie
        .json(new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully" // Send login success message
        ));
});

const logoutUser = asyncHandler(async(req, res) => {
    // Fetch user and reset refreshToken for that user
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { // Use set to update a field in db
                refreshToken: undefined
            }
        }
    );
    // Clear user's cookie data
    return res.status(200)
        .clearCookie("accessToken", options) // Remove accessToken from the cookie
        .clearCookie("refreshToken", options) // Remove refreshToken from the cookie
        .json(new ApiResponse(200, {}, "User has been logged out")); // Send success message
});

const refreshAccessToken = asyncHandler(async(req, res) => {
    // Fetch refreshToken from req cookies or body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");
    try {
        // Verify token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        // Fetch user
        const user = await User.findById(decodedToken?._id);
        if (!user) throw new ApiError(401, "Invalid refresh token");
        // Compare refresh tokens to make sure we have the correct user
        if (incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "Refresh token is expired or used");
        // Generate Access Token and Refresh Token
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
        // Send secure cookie to user
        return res.status(200)
            .cookie("accessToken", accessToken, options) // Set accessToken in the cookie
            .cookie("refreshToken", refreshToken, options) // Set refreshToken in the cookie
            .json(new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken
                },
                "Access Token refreshed" // Send login success message
            ));
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const { oldPassword, newPassword } = req.body;
    // Fetch user
    const user = await User.findById(req.user?._id);
    // Check password
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new ApiError(400, "Invalid current password");
    // Set new password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully")); // Send success message
});

const getCurrentUser = asyncHandler(async(req, res) => {
    return res.status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body;
    if (!fullName || !email) throw new ApiError(400, "All fields are required");
    // Fetch user and update it
    const user = await User.findByIdAndUpdate(
        req.user?._id, // Use this ID to find user
        {
            $set: { // Set the fields
                fullName,
                email
            }
        },
        { new: true } // Updated information will be returned
    ).select("-password"); // Exclude password from response

    return res.status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path; // Get avatar file
    if (!avatarLocalPath) throw new ApiError(400, "Avatar file is missing");
    // Upload avatar to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) throw new ApiError(400, "Error while uploading avatar on Cloudinary"); // File wasn't uploaded to Cloudinary
    // Fetch user and update it's avatar
    const user = await User.findByIdAndUpdate(
        req.user?._id, // id to find the user
        {
            $set: { // Set avatar
                avatar: avatar.url
            }
        },
        { new: true } // Updated information will be returned
    ).select("-password"); // Exclude password from response

    return res.status(200)
        .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path; // Get cover image file
    if (!coverImageLocalPath) throw new ApiError(400, "Cover image file is missing");
    // Upload cover image to Cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.url) throw new ApiError(400, "Error while uploading cover image on Cloudinary"); // File wasn't uploaded to Cloudinary
    // Update user's cover image
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: { // Set cover image
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password");

    return res.status(200)
        .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params;
    if (!username?.trim()) throw new ApiError(400, "Username is missing");
    // Subscriptions left join to Users
    const channel = await User.aggregate([
        {
            $match: { // Filter documents based on username
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: { // Perform LEFT OUTER JOIN from subscriptions to users => users(channel) -> subscriptions(_id)
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: { // users(subscriber) -> subscriptions(_id)
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: { // Add new fields to documents
                subscribersCount: {
                    $size: "$subscribers" // Count the number of subscribers
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo" // Count the number of channels users are subscribed to
                },
                isSubscribed: {
                    $cond: { // Condition to check if user is subscribed
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]}, // Checking if logged-in user exists as a subscriber
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: { // Reshape document by only including the fields we want by adding 1 to the fields
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);
    if (!channel?.length) throw new ApiError(404, "Channel does not exist");

    return res.status(200)
        .json(new ApiResponse(200, channel[0], "User channel fetched successfully"));
});

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) // mongoose created object id out of the id we currently have
            }
        },
        {
            $lookup: { // users(watchHistory) -> videos(_id)
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [ // To add more pipelines under lookup
                    {
                        $lookup: { // Nested lookup to get owner from users ==> videos(owner) -> users(_id)
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [ // Nested pipeline
                                {
                                    $project: { // Only get the following fields from users for the owner
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{ // Add new field owner to the users
                            owner:{
                                $first: "$owner" // Get first value of the array result
                            }
                        }
                    }
                ]
            }
        }
    ]);

    return res.status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully"));
});

export {
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
};