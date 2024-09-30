import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {formatFileSize} from "../services/format-file-size";
import UIkit from "uikit";
import {api} from "../services/axios-setup";

const UploadedImagePage: React.FC = () => {
    const { sha256 } = useParams<{ sha256: string }>();
    const [fileData, setFileData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchFileStatus = async () => {
            try {
                const response = await api.get(`/images/file-status/${sha256}`);
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
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const fileUrl = `${baseUrl}/api/images/user-uploaded-images/${fileData.fileName}`;
    const handleCopyUrl = () => {
        navigator.clipboard.writeText(fileUrl)
            .then(() => {
                UIkit.notification({ message: 'URL copied to clipboard!', status: 'success' });
            })
            .catch(err => {
                UIkit.notification({ message: 'Failed to copy URL.', status: 'danger' });
                console.error('Failed to copy URL:', err);
            });
    };
    return (
        <div>
            <section className="uk-container">
                <h2>Uploaded File Information</h2>
                <div><button
                    className="uk-button uk-button-small uk-button-default uk-margin-left"
                    onClick={handleCopyUrl}
                    >Copy URL:</button> {fileUrl}</div>
                <br/>
                <div><strong>File Size:</strong> {formatFileSize(fileData.fileSize)}</div>
                <div><strong>Upload Date:</strong> {new Date(fileData.uploadDate).toLocaleString()}</div>
                <div><strong>Status:</strong> {fileData.status}</div>
                <div className={fileData.dangerous?"uk-alert-danger":""}><strong>Dangerous:</strong> {fileData.dangerous ? 'Yes' : 'No'}</div>
                <div className={fileData.banned?"uk-alert-danger":""}><strong>Banned:</strong> {fileData.banned ? 'Yes' : 'No'}</div>
                {fileData.dangerous ? (
                    <p style={{ color: 'red' }}>Warning: This file has been flagged as dangerous.</p>
                ) : null}

                {fileData.status === 'completed' && !fileData.dangerous ? (
                    <img src={`/api/images/user-uploaded-images/${fileData.fileName}`} alt="Uploaded file" />
                ) : (
                    <p>Analysis in progress or file not safe to display, please wait...</p>
                )}
            </section>

        </div>
    );
};

export default UploadedImagePage;
