import React from 'react';
import { BasePropertyProps } from 'adminjs';

const TruncatedText: React.FC<BasePropertyProps> = ({ record, property }) => {
    const text = record?.params[property.name] || '';
    const maxLength = 100;

    const truncated = text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;

    return (
        <span title={text.length > maxLength ? text : undefined}>
            {truncated}
        </span>
    );
};

export default TruncatedText;
