import AccountQuota from "../components/AccountQuota";
import BindWallet from "../components/BindWallet";
import {useState} from "react";

const AccountPage: React.FC = () => {
    const [changes, setChanges] = useState(0);
    return (
        <div className="uk-card uk-card-default uk-card-body">
            <br/>
            {changes}
            <AccountQuota changes={changes} />
            <br/>
            <BindWallet onAddWallet={()=>setChanges(changes+1)} onRemoveWallet={()=>setChanges(changes+1)} />
        </div>
    );
};

export default AccountPage;
