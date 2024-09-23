import Home from "../pages/Home";
import Register from "../pages/Register";
import ImageUploadPage from "../pages/ImageUploadPage";
import Login from "../pages/Login";
import BrainWallet from "../pages/BrainWallet";
import OldBrainWallet from "../pages/OldBrainWallet";
import MyImagesPage from "../pages/MyImagesPage";
import AccountPage from "../pages/Account";
import ImageUploadedPage from "../pages/ImageUploadedPage";
import VerifyEmail from "../pages/VerifyEmail";

export const pageRoutes = [
    {RouteElement:Home, title:`Welcome`, path:`/`, props:{}},
    {RouteElement:Register, title:`Register new account`, path:`/register`, props:{}},
    {RouteElement:ImageUploadPage, title:`Image upload`, path:`/image-upload`, props:{}},
    {RouteElement:Login, title:`Login account`, path:`/login`, props:{}},
    {RouteElement:BrainWallet, title:`Brain Wallet`, path:`/brain-wallet`, props:{}},
    {RouteElement:BrainWallet, title:`Brain Wallet`, path:`/eth-brain-wallet`, props:{}},
    {RouteElement:OldBrainWallet, title:`(Old) Brain Wallet`, path:`/old-brain-wallet`, props:{}},
    {RouteElement:MyImagesPage, title:`My Images`, path:`/my-images`, props:{}},
    {RouteElement:AccountPage, title:`Account`, path:`/account`, props:{}},
    {RouteElement:ImageUploadedPage, title:`Uploaded image`, path: `/uploaded-image-page/:sha256`, props: {}},
    {RouteElement:VerifyEmail, title:"Verify Email", path:"/verify", props:{}}
]