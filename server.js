let express = require("express");
let path = require("path");
let multer = require("multer");
let fs = require("fs");

let app = express();
let port = process.env.port || 4000;

let server = app.listen(port, () => console.log(`Listening on port ${port}`));

let io = require("socket.io")(server);
const cors = require("cors");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files to the 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Add timestamp to file name
  },
});

// Allowed file types: images, videos, audio, PDFs
const fileTypes = /jpeg|jpg|png|gif|mp4|avi|mov|mp3|wav|ogg|pdf/;
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    const mimeType = fileTypes.test(file.mimetype);
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (mimeType && extname) {
      return cb(null, true);
    } else {
      return cb(new Error("Invalid file type"));
    }
  },
});

// Make sure the uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

// Serve static files (uploaded files)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

let socketsConnected = new Set();
let users = {}; // Object to store usernames by socket ID

io.on("connection", onConnected);

function onConnected(socket) {
  // Add socket to the connected set
  socketsConnected.add(socket.id);
  io.emit("clients-total", socketsConnected.size);

  // Default username
  let username = "anonymous";

  // Store user's username based on socket ID
  users[socket.id] = username;

  // When the user updates their username
  socket.on("set-username", (name) => {
    username = name || "anonymous"; // Default to 'Anonymous' if name is empty
    users[socket.id] = username; // Update username in the users object
  });

  // When user disconnects
  socket.on("disconnect", () => {
    socketsConnected.delete(socket.id);
    io.emit("clients-total", socketsConnected.size);
    // Emit disconnection event with the correct username
    io.emit("user-disconnected", users[socket.id]);
    delete users[socket.id]; // Remove from the users object
  });

  // Receive messages from clients
  socket.on("message", (data) => {
    // Send received message to other clients
    socket.broadcast.emit("chat-message", data);
  });

  // Receive current user typing
  socket.on("feedback", (data) => {
    // Show other users about current user typing
    socket.broadcast.emit("feedback", data);
  });

  // Handle file upload from client
  socket.on("file-upload", (fileData) => {
    // Broadcast file URL to all other clients
    io.emit("file-upload", {
      name: fileData.name,
      fileUrl: fileData.fileUrl, // File URL
      fileName: fileData.fileName, // Original file name
      fileType: fileData.fileType, // The file's type (image, video, audio, pdf, etc.)
      date: fileData.date,
    });
  });
}

app.get("/", (req, resp) => {
  resp.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle file upload endpoint
app.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (!error) return next();

      console.error("File upload failed:", error);

      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return res.status(413).json({
          success: false,
          error: "That file is too large. The maximum size is 10 MB.",
        });
      }

      if (error.message === "Invalid file type") {
        return res.status(400).json({
          success: false,
          error:
            "That file type is not supported. Choose a supported image, video, audio file, or PDF.",
        });
      }

      const status = error instanceof multer.MulterError ? 400 : 500;
      return res.status(status).json({
        success: false,
        error: "We couldn't upload that file. Please try again.",
      });
    });
  },
  (req, res) => {
    if (req.file) {
      // Send back the file URL
      res.json({
        success: true,
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        date: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Choose a file before uploading.",
      });
    }
  },
);
