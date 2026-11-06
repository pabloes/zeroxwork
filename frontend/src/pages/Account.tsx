import AccountQuota from "../components/AccountQuota";
import BindWallet from "../components/BindWallet";
import ProfileForm from "../components/ProfileForm";
import {useState} from "react";
import {Link} from "react-router-dom";


const AccountPage: React.FC = () => {
    const [changes, setChanges] = useState(0);

    return (

            <div className="uk-card uk-card-default uk-card-body">
                <div className="uk-section uk-container ">
                    <div className="uk-card uk-card-default uk-card-body">
                        <Link to={"/my-articles"} >My articles</Link>&nbsp;|&nbsp;<Link to="/my-images">My images</Link>
                    </div>

                </div>

                <div className="zx-wrap zx-account-section">
                    <ProfileForm onSaved={() => setChanges(changes + 1)} />
                </div>

                <AccountQuota changes={changes} />
                <br/>
                <BindWallet onAddWallet={()=>setChanges(changes+1)} onRemoveWallet={()=>setChanges(changes+1)} />

            </div>
    );
};

export default AccountPage;
