import ImageUpload from '../components/ImageUpload';
import React from "react";
import {Link} from "react-router-dom"; // Adjust the path based on your structure


const ImageUploadPage: React.FC = () => {
    return (
        <div className="uk-section">
            <p className="uk-container uk-text-center">
                <Link to={"/my-images"}>🌃 Navigate to my image gallery</Link><br/>
                <br/>
            </p>
                <div className="uk-container">
                    <ImageUpload />
                </div>
        </div>
    );
};

export default ImageUploadPage;
