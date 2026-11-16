function Navbar() {
    const user = JSON.parse(localStorage.getItem("user"));

    return (
        <header className="h-20 bg-[#f7f8f4] flex items-center px-10">
            <h1 className="text-3xl font-semibold text-[#24352b]">
                Hello, {user?.name || "User"}!
            </h1>
        </header>
    );
}

export default Navbar;