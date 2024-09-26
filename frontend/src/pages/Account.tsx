import {Link} from "react-router-dom";
import AccountQuota from "../components/AccountQuota";
import BindWallet from "../components/BindWallet";

const AccountPage: React.FC = () => {

    return (
        <div className="uk-card uk-card-default uk-card-body">
            <br/>
            <AccountQuota />
            <br/>
            <BindWallet />
        </div>
    );
};

export default AccountPage;
