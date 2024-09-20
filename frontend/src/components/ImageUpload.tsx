import React, { useState } from 'react';
import axios from 'axios';
import UIkit from 'uikit'; // Ensure you have UIkit installed for notifications
import { useAuth } from '../context/AuthContext'; // Import your AuthContext to check user authentication

const ImageUpload: React.FC = () => {
    const { isAuthenticated } = useAuth(); // Check if the user is authenticated
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [scanStatus, setScanStatus] = useState<string | null>(null);

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type and size
            const allowedTypes = ['image/jpeg', 'image/png'];
            if (!allowedTypes.includes(selectedFile.type)) {
                UIkit.notification({ message: 'Invalid file type. Only JPEG and PNG are allowed.', status: 'danger' });
                setFile(null);
                return;
            }

            if (selectedFile.size > 5 * 1024 * 1024) { // 5MB size limit
                UIkit.notification({ message: 'File size exceeds 5MB limit.', status: 'danger' });
                setFile(null);
                return;
            }

            setFile(selectedFile); // Set the selected file
        }
    };

    // Handle file upload
    const handleUpload = async () => {
        if (!file) {
            UIkit.notification({ message: 'Please select an image to upload', status: 'warning' });
            return;
        }

        setIsUploading(true);
        setScanStatus(null); // Reset scan status
        setUploadedImageUrl(null); // Reset uploaded image URL

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Get the auth token from localStorage
            const token = localStorage.getItem('authToken');
            if (!token) {
                UIkit.notification({ message: 'You must be logged in to upload files.', status: 'danger' });
                setIsUploading(false);
                return;
            }

            // Send the file to the backend for VirusTotal scanning and uploading
            const response = await axios.post('/api/images/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`, // Include the token in headers
                },
            });
            debugger;
            if (response.data.attributes.last_analysis_stats.malicious > 0) {
                UIkit.notification({ message: 'File is malicious. Upload rejected.', status: 'danger' });
                setScanStatus('File is malicious. Upload rejected.');
            } else {
                UIkit.notification({ message: 'File uploaded and scanned successfully.', status: 'success' });
                setScanStatus('File uploaded and scanned successfully.');
                setUploadedImageUrl(response.data.fileUrl);
            }
        } catch (error: any) {
            // Handle errors from the server, e.g., file being malicious
            const errorMessage = error?.response?.data?.message || 'Error uploading image';
            UIkit.notification({ message: errorMessage, status: 'danger' });
            setScanStatus(errorMessage);
        } finally {
            setIsUploading(false);
            setFile(null); // Clear file input
        }
    };

    if (!isAuthenticated) {
        return <p>Please log in to upload images.</p>;
    }

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <h3>Upload an Image</h3>
                <div className="uk-margin">
                    <div uk-form-custom="true">
                        <input type="file" onChange={handleFileChange} accept="image/*" />
                        <button className="uk-button uk-button-default" type="button" tabIndex={-1}>
                            Select Image
                        </button>
                    </div>
                </div>
                <button
                    className={`uk-button uk-button-primary ${isUploading ? 'uk-disabled' : ''}`}
                    disabled={isUploading}
                    onClick={handleUpload}
                >
                    {isUploading ? 'Uploading and Scanning...' : 'Upload'}
                </button>
                {scanStatus && <p className="uk-text-warning uk-margin-top">{scanStatus}</p>}
                {uploadedImageUrl && (
                    <div className="uk-margin-top">
                        <p>Uploaded Image URL:</p>
                        <a href={uploadedImageUrl} target="_blank" rel="noopener noreferrer">{uploadedImageUrl}</a>
                        <img src={uploadedImageUrl} alt="Uploaded Image" className="uk-margin-top" width="300" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageUpload;
