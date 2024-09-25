import {Link} from "react-router-dom";
import AccountQuota from "../components/AccountQuota";
import BindWallet from "../components/BindWallet";

const AccountPage: React.FC = () => {

    return (
        <div className="uk-card uk-card-default uk-card-body">
            <h3 className="uk-card-title">Image upload quota Information</h3>
            <Link to={"/my-images"}>🌃 Navigate to my image gallery</Link><br/>
            <Link to={"/image-upload"}>🏞️ Public Image upload</Link>
            <br/>
            <AccountQuota />
            <br/>
            <BindWallet />
        </div>
    );
};

export default AccountPage;
