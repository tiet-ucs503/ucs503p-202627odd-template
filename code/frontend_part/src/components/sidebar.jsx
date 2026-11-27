import { useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import { SIDEBAR_ITEMS } from "../constants/sidebarItems";

function Sidebar() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [profilePhoto, setProfilePhoto] = useState(
        localStorage.getItem("profilePhoto") ||
        "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    );

    const [selectedImage, setSelectedImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            setSelectedImage(reader.result);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        };

        reader.readAsDataURL(file);

        // Allows selecting the same file again later.
        e.target.value = "";
    };

    const onCropComplete = (_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    };

    const createCroppedImage = async () => {
        if (!selectedImage || !croppedAreaPixels) return;

        const image = new Image();

        image.src = selectedImage;

        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        ctx.drawImage(
            image,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            croppedAreaPixels.width,
            croppedAreaPixels.height
        );

        const croppedImage = canvas.toDataURL("image/jpeg", 0.9);

        localStorage.setItem("profilePhoto", croppedImage);
        setProfilePhoto(croppedImage);

        setSelectedImage(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");
    };

    return (
        <aside className="w-72 shrink-0 bg-[#eef3e8] h-screen sticky top-0 overflow-y-auto px-6 py-8 flex flex-col">

            {/* Brand */}
            <div className="px-3 mb-8">
                <h1 className="text-3xl font-bold text-[#24352b]">
                    Algo Recall
                </h1>
            </div>

            {/* Profile */}
            <div className="px-3 mb-8">
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        <img
                            src={profilePhoto}
                            alt="Profile"
                            className="h-14 w-14 rounded-full bg-white p-1 object-cover"
                        />

                        <button
                            type="button"
                            onClick={() => fileInputRef.current.click()}
                            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[#5f7f58] text-white flex items-center justify-center text-xs border-2 border-[#eef3e8] hover:bg-[#4d6a47]"
                            title="Change photo"
                        >
                            ✎
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            className="hidden"
                        />
                    </div>

                    <div className="min-w-0">
                        <p className="text-lg font-semibold text-[#24352b] truncate">
                            {user.name || "User"}
                        </p>

                        <p className="text-sm text-[#657568]">
                            Student
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <ul className="flex flex-col gap-2">
                {SIDEBAR_ITEMS.map((item) => (
                    <li key={item.id}>
                        <NavLink
                            to={item.path}
                            end
                            className={({ isActive }) =>
                                `flex items-center rounded-2xl px-5 py-4 text-base transition ${
                                    isActive
                                        ? "bg-[#aec5a7] text-[#24352b] font-semibold"
                                        : "text-[#34483b] hover:bg-[#dce8d7]"
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    </li>
                ))}
            </ul>

            {/* Logout */}
            <button
                type="button"
                onClick={handleLogout}
                className="mt-auto text-left rounded-2xl px-5 py-4 text-[#34483b] hover:bg-[#dce8d7] transition"
            >
                Log out
            </button>

            {/* Crop photo pop-up */}
            {selectedImage && (
                <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6">
                        <h2 className="text-lg font-semibold text-[#24352b] mb-4">
                            Adjust profile photo
                        </h2>

                        <div className="relative w-full h-80 bg-[#24352b] rounded-2xl overflow-hidden">
                            <Cropper
                                image={selectedImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-[#34483b] mb-1">
                                Zoom
                            </label>

                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full accent-[#5f7f58]"
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setSelectedImage(null)}
                                className="px-4 py-2 rounded-2xl border border-[#dce8d7] text-[#34483b] hover:bg-[#eef3e8]"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={createCroppedImage}
                                className="px-4 py-2 rounded-2xl bg-[#5f7f58] text-white hover:bg-[#4d6a47]"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

export default Sidebar;