
import { v4 as uuidv4 } from 'uuid';
import { query } from "../db.js"; 
import { io } from '../server.js'; 
import { userSocketMap } from '../server.js'; 

async function getFullGameState(gameId) {
 
    const gameResult = await query(
        'SELECT g.game_id, g.user1_id, g.user2_id, g.selected_category_id, g.status, g.current_round, ' +
        'u1.username AS user1_username, u2.username AS user2_username, ' +
        'c.category_name ' +
        'FROM games g ' +
        'JOIN users u1 ON g.user1_id = u1.id ' +
        'JOIN users u2 ON g.user2_id = u2.id ' +
        'JOIN categories c ON g.selected_category_id = c.category_id ' +
        'WHERE g.game_id = $1;',
        [gameId]
    );

    if (!gameResult.rows[0]) return null;

    const game = gameResult.rows[0];

    const roundResult = await query(
        'SELECT gr.round_id, gr.round_number, gr.question_id, gr.question_type, ' +
        'cq.question_text, t.options, t.correct_answer, ' + 
        'gr.user1_answer, gr.user2_answer, gr.user1_prediction, gr.user2_prediction, gr.round_result ' +
        'FROM game_rounds gr ' +
        'JOIN category_questions cq ON gr.question_id = cq.question_id ' +
        'LEFT JOIN trivia t ON cq.question_id = t.question_id AND cq.question_type = \'trivia\' ' + 
        'WHERE gr.game_id = $1 AND gr.round_number = $2;',
        [gameId, game.current_round]
    );

    const currentRound = roundResult.rows[0];

    const scoresResult = await query(
        'SELECT SUM(user1_score_increment) as total_user1_score, SUM(user2_score_increment) as total_user2_score ' +
        'FROM game_rounds WHERE game_id = $1;',
        [gameId]
    );

    const totalScores = scoresResult.rows[0];

    return {
        gameId: game.game_id,
        user1: { id: game.user1_id, username: game.user1_username, score: totalScores.total_user1_score || 0 },
        user2: { id: game.user2_id, username: game.user2_username, score: totalScores.total_user2_score || 0 },
        selectedCategory: { id: game.selected_category_id, name: game.category_name },
        status: game.status,
        currentRound: {
            roundId: currentRound?.round_id,
            number: currentRound?.round_number,
            question: currentRound ? {
                id: currentRound.question_id,
                text: currentRound.question_text,
                type: currentRound.question_type,
                options: currentRound.options 
            } : null,
            user1Answer: currentRound?.user1_answer,
            user2Answer: currentRound?.user2_answer,
            user1Prediction: currentRound?.user1_prediction,
            user2Prediction: currentRound?.user2_prediction,
            roundResult: currentRound?.round_result,
        },
    
    };
}

export const createGame = async (req, res) => {
    try {
        const user1Id = req.userId; 
        const { user2Id, selectedCategoryId } = req.body; 

        if (!user1Id || !user2Id || !selectedCategoryId) {
            return res.status(400).json({ success: false, message: "Missing required fields: user2Id, selectedCategoryId" });
        }

        const gameId = uuidv4();

        await query(
            'INSERT INTO games (game_id, user1_id, user2_id, selected_category_id, status, current_round) VALUES ($1, $2, $3, $4, $5, $6);',
            [gameId, user1Id, user2Id, selectedCategoryId, 'inProgress', 1] // Game starts immediately
        );


        const firstQuestionResult = await query(
            'SELECT question_id, question_text, question_type FROM category_questions WHERE category_id = $1 ORDER BY RANDOM() LIMIT 1;',
            [selectedCategoryId]
        );

        if (!firstQuestionResult.rows[0]) {
            await query('DELETE FROM games WHERE game_id = $1;', [gameId]); // Rollback game creation
            return res.status(404).json({ success: false, message: "No questions found for the selected category." });
        }

        const firstQuestion = firstQuestionResult.rows[0];
        const roundId = uuidv4();

        await query(
            'INSERT INTO game_rounds (round_id, game_id, round_number, question_id, question_type) VALUES ($1, $2, $3, $4, $5);',
            [roundId, gameId, 1, firstQuestion.question_id, firstQuestion.question_type]
        );

        const initialGameState = await getFullGameState(gameId);

        io.to(user1Id).emit('newGameCreated', initialGameState); 
        io.to(user2Id).emit('newGameInvitation', initialGameState); 

        
        io.to(gameId).emit('gameUpdated', initialGameState);

        res.status(201).json({ success: true, message: "Game created and first round started", game: initialGameState });

    } catch (error) {
        console.error("Error creating game:", error);
        res.status(500).json({ success: false, message: "Failed to create game." });
    }
};

export const getGame = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.userId; 

console.log("Requesting user ID:", userId); 
        console.log("Requested Game ID:", gameId); 

        const game = await getFullGameState(gameId);

        if (!game) {
            return res.status(404).json({ success: false, message: "Game not found." });
        }

 console.log("Full Game State fetched:", JSON.stringify(game, null, 2));  
        console.log("Game User 1 ID:", game.user1.id); 
        console.log("Game User 2 ID:", game.user2.id); 

        if (game.user1.id !== userId && game.user2.id !== userId) {
            console.log("Access denied: User ID does not match game players."); 
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        res.status(200).json({ success: true, game });

    } catch (error) {
        console.error("Error getting game:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve game." });
    }
};

export const submitAnswer = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.userId; 
        const { answer } = req.body; 

        if (!answer) {
            return res.status(400).json({ success: false, message: "Answer is required." });
        }

        const game = await getFullGameState(gameId);

        if (!game || game.status !== 'inProgress') {
            return res.status(404).json({ success: false, message: "Game not found or not in progress." });
        }
        if (game.user1.id !== userId && game.user2.id !== userId) {
            return res.status(403).json({ success: false, message: "Not a participant in this game." });
        }

        const currentRound = game.currentRound;
        if (!currentRound || currentRound.roundResult) { 
            return res.status(400).json({ success: false, message: "No active round or round already completed." });
        }

        let user1Answer = currentRound.user1Answer;
        let user2Answer = currentRound.user2Answer;

        if (game.user1.id === userId) {
            if (user1Answer) return res.status(400).json({ success: false, message: "You have already answered this round." });
            user1Answer = answer;
        } else { 
            if (user2Answer) return res.status(400).json({ success: false, message: "You have already answered this round." });
            user2Answer = answer;
        }

        await query(
            'UPDATE game_rounds SET user1_answer = $1, user2_answer = $2 WHERE round_id = $3;',
            [user1Answer, user2Answer, currentRound.roundId]
        );

        if (user1Answer && user2Answer) {
            const { user1Score, user2Score, roundResultData } = evaluateRound(game, currentRound, user1Answer, user2Answer);

            await query(
                'UPDATE game_rounds SET user1_score_increment = $1, user2_score_increment = $2, round_result = $3 WHERE round_id = $4;',
                [user1Score, user2Score, roundResultData, currentRound.roundId]
            );

            const updatedGameState = await getFullGameState(gameId);
            io.to(gameId).emit('roundCompleted', updatedGameState);
            return res.status(200).json({ success: true, message: "Both answers submitted. Round evaluated.", game: updatedGameState });

        } else {
            const updatedGameState = await getFullGameState(gameId); 
            io.to(gameId).emit('playerAnswered', { gameId, userId, currentRoundId: currentRound.roundId }); // Notify the other player that one has answered
            res.status(200).json({ success: true, message: "Answer submitted. Waiting for other player.", game: updatedGameState });
        }

    } catch (error) {
        console.error("Error submitting answer:", error);
        res.status(500).json({ success: false, message: "Failed to submit answer." });
    }
};

export const submitPrediction = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.userId;
        const { prediction } = req.body;

        if (!prediction) {
            return res.status(400).json({ success: false, message: "Prediction is required." });
        }

        const game = await getFullGameState(gameId);

        if (!game || game.status !== 'inProgress') {
            return res.status(404).json({ success: false, message: "Game not found or not in progress." });
        }
        if (game.user1.id !== userId && game.user2.id !== userId) {
            return res.status(403).json({ success: false, message: "Not a participant in this game." });
        }

        const currentRound = game.currentRound;
        if (currentRound.question.type !== 'multiple_choice') {
            return res.status(400).json({ success: false, message: "This round is not a prediction type game." });
        }
        

        let user1Prediction = currentRound.user1Prediction;
        let user2Prediction = currentRound.user2Prediction;

        if (game.user1.id === userId) {
            if (user1Prediction) return res.status(400).json({ success: false, message: "You have already made a prediction." });
            user1Prediction = prediction;
        } else { 
            if (user2Prediction) return res.status(400).json({ success: false, message: "You have already made a prediction." });
            user2Prediction = prediction;
        }

        await query(
            'UPDATE game_rounds SET user1_prediction = $1, user2_prediction = $2 WHERE round_id = $3;',
            [user1Prediction, user2Prediction, currentRound.roundId]
        );

        if (user1Prediction && user2Prediction && currentRound.user1Answer && currentRound.user2Answer) {
            const { user1Score, user2Score, roundResultData } = evaluatePredictionRound(game, currentRound, user1Prediction, user2Prediction, currentRound.user1Answer, currentRound.user2Answer);

            await query(
                'UPDATE game_rounds SET user1_score_increment = $1, user2_score_increment = $2, round_result = $3 WHERE round_id = $4;',
                [user1Score, user2Score, roundResultData, currentRound.roundId]
            );

            const updatedGameState = await getFullGameState(gameId);
            io.to(gameId).emit('roundCompleted', updatedGameState);
            return res.status(200).json({ success: true, message: "Both predictions and answers submitted. Round evaluated.", game: updatedGameState });

        } else {
            const updatedGameState = await getFullGameState(gameId);
            io.to(gameId).emit('playerMadePrediction', { gameId, userId, currentRoundId: currentRound.roundId });
            res.status(200).json({ success: true, message: "Prediction submitted. Waiting for other actions.", game: updatedGameState });
        }

    } catch (error) {
        console.error("Error submitting prediction:", error);
        res.status(500).json({ success: false, message: "Failed to submit prediction." });
    }
};

export const nextRound = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.userId;

        const game = await getFullGameState(gameId);

        if (!game || game.status !== 'inProgress') {
            return res.status(404).json({ success: false, message: "Game not found or not in progress." });
        }
        if (game.user1.id !== userId && game.user2.id !== userId) {
            return res.status(403).json({ success: false, message: "Not a participant in this game." });
        }

        if (!game.currentRound || !game.currentRound.roundResult) {
            return res.status(400).json({ success: false, message: "Current round is not yet completed. Cannot advance." });
        }

        const nextRoundNumber = game.currentRound.number + 1;

        const nextQuestionResult = await query(
            'SELECT question_id, question_text, question_type FROM category_questions WHERE category_id = $1 ORDER BY RANDOM() LIMIT 1;',
            [game.selectedCategory.id]
        );

        if (!nextQuestionResult.rows[0]) {
            return res.status(200).json({ success: true, message: "No more questions in this category. Game might end here.", gameId });
        }

        const nextQuestion = nextQuestionResult.rows[0];
        const nextRoundId = uuidv4();

        await query(
            'INSERT INTO game_rounds (round_id, game_id, round_number, question_id, question_type) VALUES ($1, $2, $3, $4, $5);',
            [nextRoundId, gameId, nextRoundNumber, nextQuestion.question_id, nextQuestion.question_type]
        );

        await query(
            'UPDATE games SET current_round = $1 WHERE game_id = $2;',
            [nextRoundNumber, gameId]
        );

        const updatedGameState = await getFullGameState(gameId);

        io.to(gameId).emit('newRoundStarted', updatedGameState);

        res.status(200).json({ success: true, message: "Moved to next round", game: updatedGameState });

    } catch (error) {
        console.error("Error advancing to next round:", error);
        res.status(500).json({ success: false, message: "Failed to advance to next round." });
    }
};

export const endGame = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.userId;

        const game = await getFullGameState(gameId);

        if (!game || game.status === 'completed') {
            return res.status(404).json({ success: false, message: "Game not found or already completed." });
        }
        if (game.user1.id !== userId && game.user2.id !== userId) {
            return res.status(403).json({ success: false, message: "Not a participant in this game." });
        }

        await query(
            'UPDATE games SET status = $1, updated_at = NOW() WHERE game_id = $2;',
            ['completed', gameId]
        );

        const finalGameState = await getFullGameState(gameId);
        io.to(gameId).emit('gameEnded', finalGameState);
        res.status(200).json({ success: true, message: "Game ended successfully", game: finalGameState });

    } catch (error) {
        console.error("Error ending game:", error);
        res.status(500).json({ success: false, message: "Failed to end game." });
    }
};

function evaluateRound(game, currentRound, user1Answer, user2Answer) {
    let user1Score = 0;
    let user2Score = 0;
    const roundResultData = {};

    switch (currentRound.question.type) {
        case 'whoIsMore':
            roundResultData.user1Guess = user1Answer;
            roundResultData.user2Guess = user2Answer;
            roundResultData.agreement = (user1Answer === user2Answer);

            if (roundResultData.agreement) {
                user1Score += 10; 
                user2Score += 10;
            }
            break;

        case 'trivia':
            
            const correctAnswer = currentRound.question.correct_answer; 
            roundResultData.correctAnswer = correctAnswer;
            roundResultData.user1Correct = (user1Answer === correctAnswer);
            roundResultData.user2Correct = (user2Answer === correctAnswer);

            if (roundResultData.user1Correct) {
                user1Score += 10; 
            }
            if (roundResultData.user2Correct) {
                user2Score += 10;
            }
            break;

        default:
            console.warn(`Unknown question type for evaluation: ${currentRound.question.type}`);
            break;
    }

    return { user1Score, user2Score, roundResultData };
}

function evaluatePredictionRound(game, currentRound, user1Prediction, user2Prediction, user1ActualAnswer, user2ActualAnswer) {
    let user1Score = 0;
    let user2Score = 0;
    const roundResultData = {};
    
    roundResultData.user1PredictedUser2 = user1Prediction;
    roundResultData.user2ActualAnswer = user2ActualAnswer;
    roundResultData.user1PredictionCorrect = (user1Prediction === user2ActualAnswer);

    roundResultData.user2PredictedUser1 = user2Prediction;
    roundResultData.user1ActualAnswer = user1ActualAnswer;
    roundResultData.user2PredictionCorrect = (user2Prediction === user1ActualAnswer);

    if (roundResultData.user1PredictionCorrect) {
        user1Score += 15; 
    }
    if (roundResultData.user2PredictionCorrect) {
        user2Score += 15;
    }
    roundResultData.actualAnswersMatch = (user1ActualAnswer === user2ActualAnswer);
    if (roundResultData.actualAnswersMatch) {
      user1Score += 5;
      user2Score += 5;
    }

    return { user1Score, user2Score, roundResultData };
}