import AccountQuota from "../components/AccountQuota";
import BindWallet from "../components/BindWallet";
import {useState} from "react";
import {Link} from "react-router-dom";
import {OnchainKitProvider} from "@coinbase/onchainkit";
import {base} from "viem/chains";
import { Avatar, Identity, Name, Badge, Address } from '@coinbase/onchainkit/identity';
import {useAccount} from "wagmi";


const AccountPage: React.FC = () => {
    const [changes, setChanges] = useState(0);
    const { address, isConnected } = useAccount();

    return (

            <div className="uk-card uk-card-default uk-card-body">
                <div className="uk-section uk-container ">
                    <div className="uk-card uk-card-default uk-card-body">
                        <Link to={"/my-articles"} >My articles</Link>&nbsp;|&nbsp;<Link to="/my-images">My images</Link>
                    </div>

                </div>

                <AccountQuota changes={changes} />
                <br/>
                <BindWallet onAddWallet={()=>setChanges(changes+1)} onRemoveWallet={()=>setChanges(changes+1)} />

            </div>
    );
};

export default AccountPage;
