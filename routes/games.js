
import express from "express";
import * as gamesController from "../controllers/gamesController.js";
import { verifyToken } from "../middleware/jwtVerify.js";

const gamesRouter = express.Router();

gamesRouter.post("/create", verifyToken, gamesController.createGame); 
gamesRouter.get("/:gameId", verifyToken, gamesController.getGame);
gamesRouter.post("/:gameId/submit-answer", verifyToken, gamesController.submitAnswer);
gamesRouter.post("/:gameId/submit-prediction", verifyToken, gamesController.submitPrediction);
gamesRouter.post("/:gameId/next-round", verifyToken, gamesController.nextRound);
gamesRouter.post("/:gameId/end", verifyToken, gamesController.endGame);

export default gamesRouter;