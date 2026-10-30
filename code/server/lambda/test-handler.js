// test the handler locally
const { handler } = require("./handler");

handler({})
    .then((res) => {
        console.log("Handler result:", res);
        process.exit(0);
    })
    .catch((err) => {
        console.error("Handler failed:", err);
        process.exit(1);
    });