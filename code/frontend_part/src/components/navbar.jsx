function Navbar() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const firstName = user.name ? user.name.split(" ")[0] : "User";

    return (
        <header className="h-20 bg-[#f7f8f4] flex items-center px-10">
            <h1 className="text-3xl font-semibold text-[#24352b]">
                Hello, {firstName}!
            </h1>
        </header>
    );
}

export default Navbar;