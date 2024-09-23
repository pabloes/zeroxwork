import React, { useState } from 'react';
import UIkit from 'uikit';

type Image = {
    id: number;
    fileName: string;
    fileUrl: string; // Complete URL to the image
    uploadDate: string;
    dangerous: boolean;
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
                    <div key={image.id} className="image-item uk-box-shadow-hover-small">
                        <img src={image.fileUrl} alt={image.fileName} className="thumbnail" />
                        <div className="image-info">
                            <button
                                className="uk-button uk-button-small uk-button-default"
                                onClick={() => handleCopyUrl(image.fileUrl)}
                            >
                                Copy URL
                            </button>

                            <span>{new Date(image.uploadDate).toLocaleString()}</span>
                            {image.dangerous && <p style={{ color: 'red' }}>⚠️ Dangerous</p>}
                        </div>
                        <button
                            className="uk-button uk-button-danger uk-margin-top"
                            onClick={() => onDelete(image.id)}
                        >
                            Delete
                        </button>
                    </div>
                ))}
            </div>

            {/* Styles for List and Grid View */}
            <style jsx>{`
                .image-gallery.list .image-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    border-bottom: 1px solid #ddd;
                }

                .image-gallery.list .thumbnail {
                    width: 48px;
                    height: 48px;
                    object-fit: contain;
                    margin-right: 15px;
                }

                .image-gallery.list .image-item .uk-button-danger {
                  position:absolute;
                  right:30px;
                }
                .image-gallery.grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 15px;
                }

                .image-gallery.grid .image-item {
                    text-align: center;
                    
                    border: 1px solid whitesmoke;
                }

                .image-gallery.grid .thumbnail {
                    width: 100%;
                    height: 150px;
                    object-fit: contain;
                }

                .image-info {
                    margin-top: 5px;
                    display: flex;
                    
                    align-items: center;
                }

                .image-info button {
                    margin-bottom: 5px;
                    margin-right: 5px;
                }
            `}</style>
        </div>
    );
};

export default ImageGallery;
