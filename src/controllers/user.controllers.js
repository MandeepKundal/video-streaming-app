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

export {registerUser};