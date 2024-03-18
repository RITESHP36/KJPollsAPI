const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors"); // Add this line for CORS

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
	cors: {
		origin: "http://localhost:5173",
		methods: ["GET", "POST","PUT"], // Specify the methods you want to allow
		allowedHeaders: ["Content-Type", "Authorization" , " Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers", "Origin", "Accept", "X-Requested-With", "X-HTTP-Method-Override", "Content-Type", "Access-Control-Request-Method", "Access-Control-Request-Headers", "Accept-Language", "Content-Language", "Content-Length", "Content-Range", "Content-Disposition", "Content-Description", "Content-Transfer-Encoding", "Content-Encoding", "Content-MD5", "Content-Duration", "Content-Language", "Content-Location"], // Specify the headers you want to allow
		credentials: true, // Set to true if you want to allow cookies to be sent with requests
	},
});

// Connect to MongoDB
const connectDB = async () => {
	try {
		await mongoose.connect(process.env.MONGODB_URL);
		console.log("MongoDB connected");
	} catch (error) {
		console.error("Connection error", error);
		process.exit(1);
	}
};

// Middleware to enable CORS
app.use(
	cors({
		origin: "http://localhost:5173",
	})
);

// Middleware to parse JSON bodies
app.use(express.json());

// Example route to test if the server is running
app.get("/", (req, res) => {
	res.send("Server is running");
});

// Define a schema for artists
const artistSchema = new mongoose.Schema({
	name: String,
	image: String,
	votes: { type: Number, default: 0 },
});
const Artist = mongoose.model("Artist", artistSchema);

// Route to get all artists
app.get("/artists", async (req, res) => {
	const artists = await Artist.find();
	res.json(artists);
});

// Route to add a new artist
// app.post("/artists", async (req, res) => {
//     const { name, image } = req.body;
//     const artist = new Artist({ name, image, votes: 0 });
//     try {
//         await artist.save();
//         res.status(201).json(artist);
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// Route to handle votes
app.post("/vote/:artistName", async (req, res) => {
	const artistName = req.params.artistName;
	const artist = await Artist.findOneAndUpdate(
		{ name: artistName },
		{ $inc: { votes: 1 } },
		{ new: true }
	);
	io.emit("voteUpdate", artist);
	res.sendStatus(200);
});

// Route to get all votes
app.get("/admin/votes", async (req, res) => {
	const votes = await Artist.find({}, { name: 1, votes: 1, _id: 0 });
	res.json(votes);
});

// Route to add a new artist
app.post("/admin/artists", async (req, res) => {
	const { name, image } = req.body;
	const artist = new Artist({ name, image, votes: 0 });
	try {
		await artist.save();
		io.emit("artistChange", { type: "add", artist });
		res.status(201).json(artist);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// Route to update an existing artist
app.put("/admin/artists/:id", async (req, res) => {
	const { name, image } = req.body;
	try {
		const updatedArtist = await Artist.findByIdAndUpdate(
			req.params.id,
			{ name, image },
			{ new: true }
		);
		io.emit("artistChange", { type: "update", artist: updatedArtist });
		res.json(updatedArtist);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// Route to delete an artist
app.delete("/admin/artists/:id", async (req, res) => {
	try {
		const deletedArtist = await Artist.findByIdAndDelete(req.params.id);
		io.emit("artistChange", { type: "delete", artist: deletedArtist });
		res.sendStatus(204);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// Route to increase an artist's votes
app.post("/admin/artists/:name/increase-votes", async (req, res) => {
	// console.log("Increase votes route hit");
	const artistName = decodeURIComponent(req.params.name);
	try {
		const updatedArtist = await Artist.findOneAndUpdate(
			{ name: artistName },
			{ $inc: { votes: 1 } },
			{ new: true }
		);
		// console.log("Updated artist:", updatedArtist);
		io.emit("artistChange", { type: "update", artist: updatedArtist });
		res.json(updatedArtist);
	} catch (error) {
		// console.error("Error in increase votes route:", error);
		res.status(500).json({ message: error.message });
	}
});

// Route to decrease an artist's votes
app.post("/admin/artists/:name/decrease-votes", async (req, res) => {
	// console.log("Decrease votes route hit");
	const artistName = decodeURIComponent(req.params.name);
	try {
		const updatedArtist = await Artist.findOneAndUpdate(
			{ name: artistName },
			{ $inc: { votes: -1 } },
			{ new: true }
		);
		// console.log("Updated artist:", updatedArtist);
		io.emit("artistChange", { type: "update", artist: updatedArtist });
		res.json(updatedArtist);
	} catch (error) {
		// console.error("Error in decrease votes route:", error);
		res.status(500).json({ message: error.message });
	}
});

// VotingCountdown logic
// Countdown Schema
const countdownSchema = new mongoose.Schema({
	votingActive: { type: Boolean, default: false },
	bufferTimestamp: Date,
	votingTimestamp: Date,
	artistName: String, // New field
});
const Countdown = mongoose.model("Countdown", countdownSchema);

// Route to start the countdown
app.get("/countdown", async (req, res) => {
	const countdown = await Countdown.findOne();
	if (!countdown) {
		res.json({
			votingActive: false,
			bufferTimestamp: null,
			votingTimestamp: null,
			artistName: null, // New field
		});
	} else {
		res.json(countdown);
	}
});

// Route to create a single countdown
// app.post("/countdown", async (req, res) => {
// 	const { artistName } = req.body; // New field
// 	const countdown = new Countdown({
// 		votingActive: false,
// 		bufferTimestamp: null,
// 		votingTimestamp: null,
// 		artistName, // New field
// 	});
// 	try {
// 		await countdown.save();
// 		res.status(201).json(countdown);
// 	} catch (error) {
// 		res.status(500).json({ message: error.message });
// 	}
// });

// Route to update the countdown
app.put("/countdown", async (req, res) => {
	const { votingActive, bufferTimestamp, votingTimestamp, artistName } = req.body; // New field
	const id = "65f7d43c16a61d401e9526d1";
	let countdown = await Countdown.findById(id);
	if (!countdown) {
		return res.status(404).json({ message: "Countdown not found" });
	} else {
		countdown.votingActive = votingActive !== undefined ? votingActive : countdown.votingActive;
		countdown.bufferTimestamp = bufferTimestamp || countdown.bufferTimestamp;
		countdown.votingTimestamp = votingTimestamp || countdown.votingTimestamp;
		countdown.artistName = artistName || countdown.artistName; // New field
	}
	try {
		await countdown.save();
		io.emit("countdownUpdate", countdown);
		res.json(countdown);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// Start the server
server.listen(process.env.PORT, () => {
	connectDB();
	console.log("app is running on port " + process.env.PORT);
});
