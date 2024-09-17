// ImageViewComponent.tsx
import React from 'react';
import { BasePropertyProps } from 'adminjs';

const ImageViewComponent: React.FC<BasePropertyProps> = ({ record, property }) => {
    const imageUrl = record?.params[property.name];

    return (
        <div>
            {imageUrl ? (
                <>
                <img src={imageUrl} alt="Image" style={{ maxWidth: '100%', maxHeight: '300px' }} />
                <pre>{imageUrl}</pre>
                </>
            ) : (
                <p>No image available</p>
            )}
        </div>
    );
};

export default ImageViewComponent;
