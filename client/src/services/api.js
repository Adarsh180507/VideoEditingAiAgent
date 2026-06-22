import axios from "axios";
const API_BASE_URL = "http://localhost:5000/api";

/**
 * 1. Uploads the video directly to Cloudinary using a secure signature from our backend.
 * NEW: Requires 'token' to pass the backend Auth Bouncer.
 */
export const uploadDirectlyToCloudinary = async (file, onProgress, token) => {
  try {
    // Step A: Ask our Express backend for a cryptographic signature (WITH TOKEN)
    const signatureRes = await axios.get(`${API_BASE_URL}/upload/signature`, {
      headers: {
        Authorization: `Bearer ${token}`, // <-- The VIP Pass
      },
    });

    const { signature, timestamp, apiKey, cloudName, folder } =
      signatureRes.data;

    // Step B: Construct the payload for Cloudinary's direct REST API
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("folder", folder);

    const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

    const uploadRes = await axios.post(cloudinaryUploadUrl, formData, {
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          if (onProgress) onProgress(percentCompleted);
        }
      },
    });

    return {
      videoUrl: uploadRes.data.secure_url,
      publicId: uploadRes.data.public_id,
    };
  } catch (error) {
    console.error("Cloudinary Direct Upload Error:", error);
    throw new Error("Failed to securely upload video to the cloud.");
  }
};

/**
 * 2. Tells our Express backend to drop a processing job into the Redis queue.
 * NEW: Requires 'token' to deduct a credit successfully.
 */
export const startVideoProcessingJob = async (
  videoUrl,
  publicId,
  originalName,
  prompt,
  token,
) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/jobs/create`,
      {
        videoUrl,
        publicId,
        originalName,
        prompt,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`, // <-- The VIP Pass
        },
      },
    );

    // Returning the entire data object so we get both jobId and creditsRemaining
    return response.data;
  } catch (error) {
    console.error("Job Creation Error:", error);
    throw new Error("Failed to initialize the AI background worker.");
  }
};

/**
 * 3. Polls the Express backend to check the exact progress of the BullMQ job.
 * (Left public so users with 0 credits can still check their job status).
 */
export const checkJobStatus = async (jobId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error("Job Status Error:", error);
    throw new Error("Lost connection to the processing queue.");
  }
};
