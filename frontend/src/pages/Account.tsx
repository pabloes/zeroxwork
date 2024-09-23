import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UIkit from 'uikit';
import {formatFileSize} from "../services/format-file-size";
import {Link} from "react-router-dom";

const AccountPage: React.FC = () => {
    const [usedQuota, setUsedQuota] = useState<number>(0);
    const [maxQuota, setMaxQuota] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const token = localStorage.getItem('authToken');

    useEffect(() => {
        const fetchQuota = async () => {
            try {
                const response = await axios.get('/api/user/quota', {headers:{
                        'Authorization': `Bearer ${token}`, // Include the token in headers
                }});
                setUsedQuota(response.data.usedQuota);
                setMaxQuota(response.data.maxQuota);
            } catch (error) {
                UIkit.notification({ message: 'Failed to load quota information.', status: 'danger' });
            } finally {
                setLoading(false);
            }
        };

        fetchQuota();
    }, []);

    if (loading) {
        return <div>Loading quota...</div>;
    }

    return (
        <div className="uk-card uk-card-default uk-card-body">
            <h3 className="uk-card-title">Image upload quota Information</h3>
            <Link to={"/my-images"}>🌃 Navigate to my image gallery</Link><br/>
            <Link to={"/image-upload"}>🏞️ Public Image upload</Link>
            <p>
                <strong>Used Quota:</strong>  {Math.floor( 100 * usedQuota/maxQuota )}% ( {formatFileSize(usedQuota)} / {formatFileSize( maxQuota)} )
            </p>

            <progress style={{outline:"1px solid grey"}} className="uk-progress" value={usedQuota} max={maxQuota}></progress>
        </div>
    );
};

export default AccountPage;
