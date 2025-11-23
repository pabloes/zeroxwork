import React from 'react';
import { BasePropertyProps } from 'adminjs';

const ThumbnailList: React.FC<BasePropertyProps> = ({ record, property }) => {
    const imageUrl = record?.params[property.name];

    return (
        <div>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt="Thumbnail"
                    style={{
                        width: '64px',
                        height: '64px',
                        objectFit: 'cover',
                        borderRadius: '4px'
                    }}
                />
            ) : (
                <span style={{ color: '#999' }}>-</span>
            )}
        </div>
    );
};

export default ThumbnailList;
