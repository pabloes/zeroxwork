import React, { useState } from 'react';
import UIkit from 'uikit';
import {Link} from "react-router-dom";
import "../styles/ImageGallery.scss";

type Image = {
    id: number;
    fileName: string;
    fileUrl: string; // Complete URL to the image
    uploadDate: string;
    dangerous: boolean;
    sha256Hash: string;
};

type ImageGalleryProps = {
    images: Image[];
    onDelete: Function;
};

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onDelete }) => {
    const [viewType, setViewType] = useState<'list' | 'grid'>('list');

    // Function to handle copying URL to clipboard
    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url)
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
            {/* Toggle View Type Buttons */}
            <div className="uk-button-group uk-margin">
                <button
                    className={`uk-button ${viewType === 'list' ? 'uk-button-primary' : 'uk-button-default'}`}
                    onClick={() => setViewType('list')}
                >
                    List View
                </button>
                <button
                    className={`uk-button ${viewType === 'grid' ? 'uk-button-primary' : 'uk-button-default'}`}
                    onClick={() => setViewType('grid')}
                >
                    Grid View
                </button>
            </div>

            {/* Render Images Based on View Type */}
            <div className={`image-gallery ${viewType}`}>
                {images.map(image => (
                    <Link key={image.id} to={`/uploaded-image-page/${image.sha256Hash}`}>
                        <div className="image-item uk-box-shadow-hover-small">
                            <img src={image.fileUrl} alt={image.fileName} className="thumbnail" />
                            <div className="image-info">
                                <button
                                    className="uk-button uk-button-small uk-button-default"
                                    onClick={(e) => (e.preventDefault(),handleCopyUrl(image.fileUrl))}
                                >
                                    Copy URL
                                </button>

                                <span>{new Date(image.uploadDate).toLocaleString()}</span>
                                {image.dangerous && <p style={{ color: 'red' }}>⚠️ Dangerous</p>}
                            </div>
                            <button
                                className="uk-button uk-button-danger uk-margin-top"
                                onClick={(e) => (e.preventDefault(),onDelete(image))}
                            >
                                Delete
                            </button>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default ImageGallery;
