import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
    answersRouter,
    gamesRouter,
    predictionsRouter,
    questionsRouter,
    scoresRouter,
    usersRouter
} from "./routes";
import { verifyToken } from "./middleware/jwtVerify.js";
dotenv.config();

const app= express();
const port=process.env.PORT;

app.use(cors());
app.use(express.json());

app.use('/answers', answersRouter);
app.use('/games', gamesRouter);
app.use('/predictions', predictionsRouter);
app.use('/questions', questionsRouter);
app.use('/scores', scoresRouter);
app.use('/users/protected', verifyToken, usersRouter); // Apply to specific user routes

// Public routes (no token required):
app.use('/users', usersRouter); // Assuming some user routes (like login/register) are public

app.get("/", (res,req)=>{
    res.json({
        message:"welcome to the couples app",
        appVersion: "1.0.0"
    })
})

app.listen(port,()=>{
    console.log(`server listeninig on port ${port}`)
})