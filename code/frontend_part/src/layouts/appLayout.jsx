import Navbar from "../components/navbar";
import Sidebar from "../components/sidebar";

import { Outlet } from "react-router-dom";

function AppLayout() {
    return (
        <div className="flex min-h-screen bg-[#f7f8f4]">

            <Sidebar />

            <div className="flex-1">
                <Navbar />

                <main className="p-8">
                    <Outlet />
                </main>
            </div>

        </div>
    );
}

export default AppLayout;