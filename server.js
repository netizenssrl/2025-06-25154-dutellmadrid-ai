const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const http = require("http");
const nodemailer = require("nodemailer");
const Jimp = require("jimp");
const { Server } = require("socket.io");
const { promiseDB } = require("./config/db");
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

// Middleware
app.use(express.json());
app.use(cors(
    {
        origin: "*",
        methods: ["GET", "POST", "DELETE"]
    }
));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
}));
// Socket.io
io.on("connection", (socket) => {
    let idSocket = socket.id;
    const room = socket.handshake.query.room;
    socket.join(room);
    console.log("Client connected `" + idSocket + "` to room `" + room + "`");
    socket.on("turn_page", async (data) => {
        io.to("screen").emit("turn_page", data);
        await insertEvent(`ipad_navigation_${data.direction}`);
    });
    socket.on("page_turned", async (data) => {
        io.to("ipad").emit("page_turned", data);
    });


    socket.on("screen_loopingvideo", async () => {
        await insertEvent("screen_loopingvideo");
        io.to("ipad").emit("screen_loopingvideo");
    });
    socket.on("disconnect", () => {
        console.log(`Client disconnected ${idSocket}`);
    });
});

// get all submission
app.get("/submission/all", async (req, res) => {
    try {
        const result = await getSubmissions();
        res.json(result);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

// get all submissions BY UID
app.get("/submission/:sFromUID", async (req, res) => {
    const sFromUID = req.params.sFromUID;
    const [result] = await promiseDB.query("SELECT * FROM tbllikes WHERE sFromUID = ?", [sFromUID]);
    res.json(result);
});

// add new submission
app.post("/submission/add", async (req, res) => {
    const data = req.body;
    const [result] = await promiseDB.query("INSERT INTO tblsubmissions (sUID, sFullName, sUpdatedFullName, sGender, iAge, sEthnicity, sStory, sUpdatedStory, dtmCreated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())", [
        data.sUID,
        data.fullname,
        data.fullname,
        data.genderhidden,
        data.age,
        data.ethnicity,
        data.story,
        data.story
    ]);
    //send socket
    io.to("admin").emit("update_all_submissions");
    res.sendStatus(200);
});


app.post("/submission/like", async (req, res) => {
    const { submissionId, sUID } = req.body;

    // check if the user has already liked the submission
    const [result] = await promiseDB.query("SELECT * FROM tbllikes WHERE sFromUID = ? AND fkIdSubmission = ?", [sUID, submissionId]);
    if (result.length > 0 && sUID !== "remote_ipad") {
        // delete the like
        await promiseDB.query("DELETE FROM tbllikes WHERE sFromUID = ? AND fkIdSubmission = ?", [sUID, submissionId]);
    }
    else {
        // insert the like
        await promiseDB.query("INSERT INTO tbllikes (sFromUID, fkIdSubmission, dtmCreated) VALUES (?, ?, NOW())", [sUID, submissionId]);
    }
    const [submission] = await getSubmissionByID(submissionId);
    io.emit("update_single_submission", submission);
    res.sendStatus(200);
});

// make submission visible
app.post("/submission/:id", async (req, res) => {
    const submissionID = req.params.id;
    const bVisible = req.body.bVisible;
    let sUpdatedStory = req.body.sUpdatedStory;
    const sUpdatedFullName = req.body.sUpdatedFullName;
    if (req.files) {
        try {
            const source_postcard_img = await Jimp.read(path.join(__dirname, "public/assets/img", "postcard-source.png"));
            const source_postcard_img_width = source_postcard_img.bitmap.width;
            const source_postcard_img_height = source_postcard_img.bitmap.height;

            const { storyimg } = req.files;
            const current_postcard_img = await Jimp.read(storyimg.data);
            await current_postcard_img.writeAsync(path.join(__dirname, "public/postcards", `${submissionID}`, "source.jpg"));
            current_postcard_img.resize(source_postcard_img_width / 2, Jimp.AUTO);

            const final_postcard_img = new Jimp(source_postcard_img_width, source_postcard_img_height);
            final_postcard_img.composite(current_postcard_img, source_postcard_img_width / 2, 0, 0);
            final_postcard_img.composite(source_postcard_img, 0, 0, 0);

            // load font
            const fontSignPainter = await Jimp.loadFont(path.join(__dirname, 'public/assets/fonts/Jimp/SignPainter-HouseScript.fnt'));
            const fontGotham = await Jimp.loadFont(path.join(__dirname, 'public/assets/fonts/Jimp/Gotham-BookItalic.fnt'));
            sUpdatedStory = sUpdatedStory.replace(/&nbsp;/g, ' ');
            sUpdatedStory = sUpdatedStory.replace(/<br ?\/?>/g, "\n");
            
            final_postcard_img.print(fontSignPainter, 130, source_postcard_img_height/2 - 430, {
                text: sUpdatedFullName
            }, (source_postcard_img_width / 2 - 260), 260);

            final_postcard_img.print(fontGotham, 130, source_postcard_img_height/2 - 100, {
                text: sUpdatedStory
            }, (source_postcard_img_width / 2 - 260), source_postcard_img_height/2);

            // create final postcard image
            await final_postcard_img.writeAsync(path.join(__dirname, "public/postcards", `${submissionID}`, `postcard.jpg`));

            // generate left image
            const leftImage = final_postcard_img.clone().crop(0, 0, source_postcard_img_width / 2, source_postcard_img_height);
            await leftImage.writeAsync(path.join(__dirname, "public/postcards", `${submissionID}`, `postcard-left.jpg`));
            await leftImage.resize(1000, Jimp.AUTO).writeAsync(path.join(__dirname, "public/postcards", `${submissionID}`, `postcard-left-mobile.jpg`));

            // generate right image
            const rightImage = final_postcard_img.clone().crop(source_postcard_img_width / 2, 0, source_postcard_img_width / 2, source_postcard_img_height);
            await rightImage.writeAsync(path.join(__dirname, "public/postcards", `${submissionID}`, `postcard-right.jpg`));
            await rightImage.resize(1000, Jimp.AUTO).writeAsync(path.join(__dirname, "public/postcards", `${submissionID}`, `postcard-right-mobile.jpg`));

            await promiseDB.query("UPDATE tblsubmissions SET bUploadedImg = 1 WHERE id = ?", [submissionID]);
            io.to("admin").emit("update_single_submission");
            res.sendStatus(200);
        }
        catch (err) {
            console.log(err);
            res.sendStatus(500);
        }
    }
    else if (bVisible !== undefined) {
        await promiseDB.query("UPDATE tblsubmissions SET bVisible = ? WHERE id = ?", [bVisible, submissionID]);
        const [submission] = await getSubmissionByID(submissionID);
        io.emit("update_single_submission", submission);
        res.sendStatus(200);
    }
    else if (sUpdatedStory !== undefined && sUpdatedFullName !== undefined) {
        await promiseDB.query("UPDATE tblsubmissions SET sUpdatedStory = ?, sUpdatedFullName = ? WHERE id = ?", [sUpdatedStory, sUpdatedFullName, submissionID]);
        const [submission] = await getSubmissionByID(submissionID);
        io.emit("update_single_submission", submission);
        res.sendStatus(200);
    }
    else {
        res.sendStatus(400);
    }
});

app.post("/tracking", async (req, res) => {
    const { sActionType } = req.body;
    await insertEvent(sActionType);
});
app.post("/screen/refresh", async (req, res) => {
    io.emit("refresh_screen");
    res.sendStatus(200);
});


app.delete("/submission/delete/all", async (req, res) => {
    await promiseDB.query("DELETE FROM tblsubmissions");
    await promiseDB.query("DELETE FROM tbllikes");
    await promiseDB.query("ALTER TABLE tblsubmissions AUTO_INCREMENT = 1");
    await promiseDB.query("ALTER TABLE tbllikes AUTO_INCREMENT = 1");
    io.emit("update_all_submissions");
    //remove images inside public/postcards
    removeSubdirectories(path.join(__dirname, "public", "postcards"));
    res.sendStatus(200);
});

async function getSubmissions() {
    const [result] = await promiseDB.query(
        "SELECT s.*, COALESCE(tbllikesgrouped.iLikesCount, 0) as iLikesCount FROM tblsubmissions s  LEFT JOIN (SELECT fkIdSubmission, COUNT(*) as iLikesCount FROM tbllikes GROUP BY fkIdSubmission) as tbllikesgrouped ON s.id=tbllikesgrouped.fkIdSubmission ORDER BY s.dtmCreated DESC");
    return result;
}
async function getSubmissionByID(submissionID) {
    // write the query to get the submission by id with the likes count
    const [result] = await promiseDB.query(
        "SELECT s.*, COALESCE(tbllikesgrouped.iLikesCount, 0) as iLikesCount FROM tblsubmissions s  LEFT JOIN (SELECT fkIdSubmission, COUNT(*) as iLikesCount FROM tbllikes GROUP BY fkIdSubmission) as tbllikesgrouped ON s.id=tbllikesgrouped.fkIdSubmission WHERE s.id = ?", [submissionID]);
    return result;
}

async function insertEvent(sActionType) {
    await promiseDB.query("INSERT INTO tblActions (sActionType) VALUES (?)", [sActionType]);
}
function removeSubdirectories(dir) {
    // Leggi i contenuti della cartella
    fs.readdir(dir, (err, files) => {
        if (err) {
            return console.error(`Errore nella lettura della cartella: ${err}`);
        }

        // Itera su tutti gli elementi trovati
        files.forEach(file => {
            const filePath = path.join(dir, file);

            // Controlla se l'elemento è una directory
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    return console.error(`Errore nel leggere lo stato del file: ${err}`);
                }

                // Se è una directory, rimuovila ricorsivamente
                if (stats.isDirectory()) {
                    fs.rm(filePath, { recursive: true, force: true }, (err) => {
                        if (err) {
                            console.error(`Errore nella rimozione della directory: ${err}`);
                        } else {
                            console.log(`Sottocartella ${filePath} rimossa con successo!`);
                        }
                    });
                }
            });
        });
    });
}
httpServer.listen(8080, () => {
    console.log("listening on *:8080");
});