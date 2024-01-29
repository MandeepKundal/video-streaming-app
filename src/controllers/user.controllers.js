import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    const loggedInUser = User.findById(user._id)
        .select("-password -refreshToken"); // To leave the fields we don't need
    // Set cookie options httpOnly and secure so that the cookie can only be modified in server and not front end
    const options = {
        httpOnly: true,
        secure: true
    };
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
    // Set cookie options httpOnly and secure so that the cookie can only be modified in server and not front end
    const options = {
        httpOnly: true,
        secure: true
    };
    // Clear user's cookie data
    return res.status(200)
        .clearCookie("accessToken", options) // Remove accessToken from the cookie
        .clearCookie("refreshToken", options) // Remove refreshToken from the cookie
        .json(new ApiResponse(200, {}, "User has been logged out")); // Send success message
});

export {
    registerUser,
    loginUser,
    logoutUser
};