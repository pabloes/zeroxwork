import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {useAuth} from "../context/AuthContext";

const PageTitle = ({ title }) => {
    const location = useLocation();
    const {setContextTitle} = useAuth();

    useEffect(() => {
        document.title = `ZEROxWORK | ` + title;
        setContextTitle(title)
    }, [location, title]);

    return null;
};

export default PageTitle;