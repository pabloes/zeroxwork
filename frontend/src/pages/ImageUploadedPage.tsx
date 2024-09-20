import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const UploadedImagePage: React.FC = () => {
    const { sha256 } = useParams<{ sha256: string }>();
    const [fileData, setFileData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchFileStatus = async () => {
            try {
                const response = await axios.get(`/api/images/file-status/${sha256}`);
                setFileData(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching file status:', error);
                setLoading(false);
            }
        };

        fetchFileStatus();
    }, [sha256]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!fileData) {
        return <div>File not found or an error occurred.</div>;
    }

    return (
        <div>
            <h2>Uploaded File Information</h2>
            <p><strong>File Name:</strong> {fileData.fileName}</p>
            <p><strong>File Size:</strong> {fileData.fileSize} bytes</p>
            <p><strong>Upload Date:</strong> {new Date(fileData.uploadDate).toLocaleString()}</p>
            <p><strong>Status:</strong> {fileData.status}</p>
            <p><strong>Dangerous:</strong> {fileData.dangerous ? 'Yes' : 'No'}</p>

            {fileData.dangerous ? (
                <p style={{ color: 'red' }}>Warning: This file has been flagged as dangerous.</p>
            ) : null}

            {fileData.status === 'completed' && !fileData.dangerous ? (
                <img src={`/user-uploaded/${sha256}`} alt="Uploaded file" />
            ) : (
                <p>Analysis in progress or file not safe to display, please wait...</p>
            )}
        </div>
    );
};

export default UploadedImagePage;
