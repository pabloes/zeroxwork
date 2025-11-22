import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageTitle = ({ title }: { title: string }) => {
    const location = useLocation();

    useEffect(() => {
        document.title = `ZEROxWORK | ${title}`;
    }, [location, title]);

    return (
        <h1 className="uk-heading-medium uk-margin-bottom">{title}</h1>
    );
};

export default PageTitle;