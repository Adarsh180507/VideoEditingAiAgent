import axios from "axios";
const API_BASE_URL = "http://localhost:5000/api";

export const uploadDirectlyToCloudinary = async (file, onProgress, token) => {
  try {
    const signatureRes = await axios.get(`${API_BASE_URL}/upload/signature`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { signature, timestamp, apiKey, cloudName, folder } =
      signatureRes.data;
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
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Job Creation Error:", error);
    throw new Error("Failed to initialize the AI background worker.");
  }
};

export const checkJobStatus = async (jobId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error("Job Status Error:", error);
    throw new Error("Lost connection to the processing queue.");
  }
};
