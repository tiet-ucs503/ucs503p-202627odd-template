import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import { PROJECT_NAME } from "../constants/appConstants";

function Navbar() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
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
        <nav className="bg-[#315B8C] h-14 sticky top-0 z-50 flex items-center justify-between px-8 shadow-md">
            <div>
                <h1 className="text-white text-2xl font-bold">
                    {PROJECT_NAME}
                </h1>
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative"
                >
                    <img
                        src={profilePhoto}
                        alt="Profile"
                        className="h-10 w-10 rounded-full bg-white p-1 cursor-pointer object-cover"
                    />
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-3 w-64 rounded-xl bg-white shadow-lg border border-gray-100 p-4">
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <img
                                    src={profilePhoto}
                                    alt="Profile"
                                    className="h-20 w-20 rounded-full object-cover border"
                                />

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-[#315B8C] text-white flex items-center justify-center text-sm border-2 border-white"
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

                            <p className="mt-3 font-semibold text-gray-800">
                                {user.name || "User"}
                            </p>

                            <p className="text-sm text-gray-500 break-all text-center">
                                {user.email || "No email available"}
                            </p>
                        </div>

                        <div className="mt-4 border-t pt-3">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current.click()}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-700"
                            >
                                Change photo
                            </button>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600"
                            >
                                Log out
                            </button>
                        </div>
                    </div>
                )}

                {selectedImage && (
                    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
                        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">
                                Adjust profile photo
                            </h2>

                            <div className="relative w-full h-80 bg-black rounded-lg overflow-hidden">
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Zoom
                                </label>

                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedImage(null)}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={createCroppedImage}
                                    className="px-4 py-2 rounded-lg bg-[#315B8C] text-white hover:bg-[#26476D]"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navbar;