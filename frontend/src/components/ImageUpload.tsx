import React, {useRef, useState} from 'react';
import UIkit from 'uikit'; // Ensure you have UIkit installed for notifications
import { useAuth } from '../context/AuthContext'; // Import your AuthContext to check user authentication
import {Link, useNavigate} from 'react-router-dom';
import {sleep} from "../services/sleep"; // Import useHistory for navigation
import {FileUpload, FileUploadUploadEvent} from 'primereact/fileupload';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import AccountQuota from "./AccountQuota";
import {api} from "../services/axios-setup";

const ImageUpload: React.FC = () => {
    const { isAuthenticated } = useAuth(); // Check if the user is authenticated
    const [,setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const navigate = useNavigate(); // Initialize useHistory for navigation
    const toast:any = useRef(null);
    const [totalSize, setTotalSize] = useState(0);
    const fileUploadRef:any = useRef(null);

    // Handle file upload
    const handleUpload = async (event:FileUploadUploadEvent) => {
        const file = event.files[0];
        if (!file) {
            UIkit.notification({ message: 'Please select an image to upload', status: 'warning' });
            return;
        }

        setIsUploading(true);

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Get the auth token from localStorage
            const token = localStorage.getItem('authToken');
            if (!token) {
                UIkit.notification({ message: 'You must be logged in to upload files.', status: 'danger' });
                setIsUploading(false);
                return;
            }

            // Send the file to the backend for VirusTotal scanning and uploading
            const response = await api.post('/images/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
            });

            UIkit.notification({ message: 'File uploaded and being processed.', status: 'success' , timeout:1000});
            // Redirection to the analysis page after 10 seconds
            await sleep(1000);
            UIkit.notification({ message: 'Redirecting...', status: 'success' , timeout:1000});

            navigate(`/uploaded-image-page/${response.data.sha256}`);
        } catch (error: any) {
            // Handle errors from the server, e.g., file being malicious
            const errorMessage = error?.response?.data?.message || 'Error uploading image';
            UIkit.notification({ message: errorMessage, status: 'danger' });
        } finally {
            setIsUploading(false);
            setFile(null); // Clear file input
        }
    };


    const onTemplateSelect = (e:any) => {
        let _totalSize = totalSize;
        let files:any = e.files;

        Object.keys(files).forEach((key:string) => {
            _totalSize += files[key].size || 0;
        });

        setTotalSize(_totalSize);
    };

    const onTemplateUpload = (e:any) => {
        try {

        }catch(error){

        }
        let _totalSize = 0;

        e.files.forEach((file:any) => {
            _totalSize += file.size || 0;
        });

        setTotalSize(_totalSize);
        toast.current.show({ severity: 'info', summary: 'Success', detail: 'File Uploaded' });
    };

    const onTemplateRemove = (file:any, callback:Function) => {
        setTotalSize(totalSize - file.size);
        callback();
    };

    const onTemplateClear = () => {
        setTotalSize(0);
    };

    const headerTemplate = (options:any) => {
        const { className, chooseButton, uploadButton, cancelButton } = options;

        return (
            <div className={className} style={{ backgroundColor: 'transparent', display: 'flex', alignItems: 'center' }}>
                {chooseButton}
                {uploadButton}
                {cancelButton}
            </div>
        );
    };

    const itemTemplate = (file:any, props:any) => {
        return (
            <div className="flex align-items-center flex-wrap">
                <div className="flex align-items-center" style={{ width: '40%' }}>
                    <img alt={file.name} role="presentation" src={file.objectURL} width={100} />
                    <span className="flex flex-column text-left ml-3">
                        {file.name}
                        <small>{new Date().toLocaleDateString()}</small>
                    </span>
                </div>
                <Tag value={props.formatSize} severity="warning" className="px-3 py-2" />
                <Button type="button" icon="pi pi-times" className="p-button-outlined p-button-rounded p-button-danger ml-auto" onClick={() => onTemplateRemove(file, props.onRemove)} />
            </div>
        );
    };

    const emptyTemplate = () => {
        return (
            <div className="flex align-items-center flex-column">
                <i className="pi pi-image mt-3 p-5" style={{ fontSize: '5em', borderRadius: '50%', backgroundColor: 'var(--surface-b)', color: 'var(--surface-d)' }}></i>
                <span style={{ fontSize: '1.2em', color: 'var(--text-color-secondary)' }} className="my-5">
                    Drag and Drop Image Here
                </span>
            </div>
        );
    };
    const chooseOptions = { icon: 'pi pi-fw pi-images', iconOnly: false, className: 'custom-choose-btn p-button-rounded p-button-outlined' };
    const uploadOptions = { icon: 'pi pi-fw pi-cloud-upload', iconOnly: false, className: 'custom-upload-btn p-button-success p-button-rounded p-button-outlined' };
    const cancelOptions = { icon: 'pi pi-fw pi-times', iconOnly: false, className: 'custom-cancel-btn p-button-danger p-button-rounded p-button-outlined' };

    if (!isAuthenticated) {
        return <p>Please <Link to="/register">Register</Link> or <Link to="/login">Login</Link> to upload images.</p>;
    }

    return (
        <>
            {isUploading ? <p>Uploading and Scanning, please wait...</p> :
                <div className="uk-section uk-section-small">
                    <AccountQuota add={totalSize} />
                    <div className="uk-container">
                        <p className="uk-text-center">Please make sure your images are in JPEG or PNG or WEBP format and do not exceed 5MB in size. Images will be publicly visible.</p>
                        <div>
                            <FileUpload ref={fileUploadRef} name="demo[]" url="/api/images/upload" accept="image/*" maxFileSize={5000000} customUpload
                                        uploadHandler={handleUpload as any}
                                        onUpload={onTemplateUpload} onSelect={onTemplateSelect} onError={onTemplateClear} onClear={onTemplateClear}
                                        headerTemplate={headerTemplate} itemTemplate={itemTemplate} emptyTemplate={emptyTemplate}
                                        chooseOptions={chooseOptions} uploadOptions={uploadOptions} cancelOptions={cancelOptions} />
                        </div>
                    </div>
                </div>
            }
        </>

    );
};

export default ImageUpload;
