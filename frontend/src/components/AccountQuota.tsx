import React, { useState, useEffect } from 'react';
import UIkit from 'uikit';
import {formatFileSize} from "../services/format-file-size";
import {api} from "../services/axios-setup";
import {Link} from "react-router-dom";

const AccountQuota: React.FC<any> = ({add = 0}) => {
    const [usedQuota, setUsedQuota] = useState<number>(0);
    const [maxQuota, setMaxQuota] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchQuota = async () => {
            try {
                const response = await api.get('/user/quota');
                setUsedQuota(response.data.usedQuota);
                setMaxQuota(response.data.maxQuota + response.data.extraQuota);
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
        <div className="uk-container">
            <div className="uk-card uk-card-default uk-card-body">
                <h3 className="uk-card-title">Image upload quota Information</h3>
                <Link to={"/my-images"}>🌃 Navigate to my image gallery</Link><br/>
                <Link to={"/image-upload"}>🏞️ Public Image upload</Link>

                <div  className={(usedQuota+add) >maxQuota?"uk-alert-danger":""}>
                    <strong >Used Quota:</strong>  {Math.floor( 100 * (usedQuota+add)/maxQuota )}% ( {formatFileSize(usedQuota+add)} / {formatFileSize( maxQuota)} )
                </div>
                <progress style={{outline:"1px solid grey"}} className="uk-progress" value={usedQuota+add} max={maxQuota}></progress>
            </div>
        </div>
    );
};

export default AccountQuota;
