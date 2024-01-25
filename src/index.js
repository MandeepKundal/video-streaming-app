import connectDb from "./db/index.js";
import "dotenv/config";
import { app } from "./app.js";

const port = process.env.PORT || 8000;

connectDb()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running at port: ${port}`);
        })
    })
    .catch((err) => {
        console.log("Connection to mongodb failed:", err);
    });