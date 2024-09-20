import React from 'react';
import ImageUpload from '../components/ImageUpload'; // Adjust the path based on your structure
import Header from '../components/Header'; // Import your Header component if you have one
import Footer from '../components/Footer'; // Import your Footer component if you have one

const ImageUploadPage: React.FC = () => {
    return (
        <div>
            {/* Include your Header component */}

            {/* Main content of the page */}
            <div className="uk-section uk-section-default">
                <div className="uk-container">
                    <h2 className="uk-heading-line uk-text-center"><span>Upload Your Images</span></h2>
                    <p className="uk-text-center">Only registered users can upload images. Please make sure your images are in JPEG or PNG format and do not exceed 5MB in size.</p>

                    {/* ImageUpload component where the upload functionality is implemented */}
                    <ImageUpload />
                </div>
            </div>

            {/* Include your Footer component */}
        </div>
    );
};

export default ImageUploadPage;
