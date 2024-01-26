/** Once file has been uploaded to the server using multer:
    - Get path to the local file
    - Upload the file to the Cloudinary service
    - Delete/Unlink file once it has been uploaded */

import {v2 as cloudinary} from 'cloudinary';
import fs from "fs";
       
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath) => {
    try {
        if(!localFilePath) return null;
        // Upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        // Return response once file is uploaded successfully
        console.log("File uploaded successfully on Cloudinary", response.url);
        fs.unlinkSync(localFilePath); // Remove file from local storage once it gets uploaded on the cloud
        return response;
    } catch (error) {
        // Remove locally saved temporary file once the upload operation fails
        fs.unlinkSync(localFilePath);
        return null;
    }
}

export {uploadOnCloudinary};