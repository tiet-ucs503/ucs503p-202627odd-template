import { NavLink } from "react-router-dom";
import { SIDEBAR_ITEMS } from "../constants/sidebarItems";

function Sidebar() {
    const user = JSON.parse(localStorage.getItem("user"));
    return (
        <aside className="w-72 shrink-0 bg-[#eef3e8] min-h-screen px-6 py-8 flex flex-col">

            {/* Brand */}
            <div className="px-3 mb-8">
                <h1 className="text-3xl font-bold text-[#24352b]">
                    Algo Recall
                </h1>
            </div>

            {/* Profile */}
            <div className="px-3 mb-8">
                <div className="flex items-center gap-4">
                    <img
                        src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
                        alt="Profile"
                        className="h-14 w-14 rounded-full bg-white p-1"
                    />

                    <div>
                        <p className="text-lg font-semibold text-[#24352b]">
                            {user?.name || "User"}
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
            <button className="mt-auto text-left rounded-2xl px-5 py-4 text-[#34483b] hover:bg-[#dce8d7] transition">
                Log out
            </button>
        </aside>
    );
}

export default Sidebar;