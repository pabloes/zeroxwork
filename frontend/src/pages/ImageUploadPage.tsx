import React from 'react';
import ImageUpload from '../components/ImageUpload'; // Adjust the path based on your structure
import Header from '../components/Header'; // Import your Header component if you have one
import Footer from '../components/Footer'; // Import your Footer component if you have one

const ImageUploadPage: React.FC = () => {
    return (
        <div>
            <div className="uk-section uk-section-default">
                <div className="uk-container">
                    <p className="uk-text-center">Please make sure your images are in JPEG or PNG format and do not exceed 5MB in size.</p>
                    <ImageUpload />
                </div>
            </div>

            {/* Include your Footer component */}
        </div>
    );
};

export default ImageUploadPage;
