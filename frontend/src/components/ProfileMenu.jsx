import { CiCirclePlus, CiLogout, CiUser } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

const ProfileMenu = ({ setIsProfileOpen }) => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { t } = useTranslation();

    const handleProfileClick = () => {
        navigate("/profile")
        setIsProfileOpen(false)
    }

    const handleLogout = () => {
        logout();
        setIsProfileOpen(false);
    };

    return (
        <div className="bg-bg-secondary rounded-md shadow-xl p-2">
            <div className="flex flex-col">
                <button onClick={handleProfileClick} className="flex justify-between rounded items-center gap-2 cursor-pointer hover:bg-neutral-200 py-2 px-4">
                    <CiUser />
                    {t('common.profile')}
                </button>
                <button className="flex justify-between items-center gap-2 cursor-pointer rounded hover:bg-neutral-200  py-2 px-4">
                    <CiCirclePlus />
                    {t('common.createPost')}
                </button>
                <button onClick={handleLogout} className="flex justify-between items-center gap-2 cursor-pointer rounded  hover:bg-neutral-200 py-2 px-4">
                    <CiLogout />
                    {t('common.logout')}
                </button>
            </div>
        </div>
    )
}

export default ProfileMenu
