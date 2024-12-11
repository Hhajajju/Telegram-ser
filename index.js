// server.js (Node.js Backend)
const express = require('express');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
const port = 3000;

// Middleware to parse JSON
app.use(bodyParser.json());

// Cooldown period (2 hours in milliseconds)
const CLAIM_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours

// API route to register a new user (with a referral code)
app.post('/api/register', async (req, res) => {
    const { username, referralCode } = req.body;

    try {
        const referral = referralCode
            ? await prisma.referral.findUnique({ where: { referralCode: referralCode } })
            : null;

        const user = await prisma.user.create({
            data: {
                username: username,
                referralCode: generateReferralCode(),
                balance: 0,
                referralEarnings: 0,
            },
        });

        // If a referral code was provided, update the referrer’s referral earnings
        if (referral) {
            await prisma.user.update({
                where: { id: referral.referrerId },
                data: { referralEarnings: { increment: 0.001 } }, // Increment referral earnings
            });
        }

        res.status(201).json({ message: 'User registered successfully', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error registering user' });
    }
});

// API route to claim reward with cooldown logic
app.post('/api/claim-reward', async (req, res) => {
    const { userId, amount } = req.body;

    try {
        // Fetch the user to check the last claim time
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentTime = Date.now();
        const timeSinceLastClaim = currentTime - new Date(user.lastClaimed).getTime();

        if (timeSinceLastClaim < CLAIM_COOLDOWN) {
            const remainingTime = CLAIM_COOLDOWN - timeSinceLastClaim;
            const hours = Math.floor(remainingTime / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

            return res.status(400).json({
                message: `You must wait before claiming again. Try again in ${hours}h ${minutes}m ${seconds}s.`,
            });
        }

        // Proceed with the reward claim and update the user's balance
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                balance: { increment: amount },
                lastClaimed: new Date(), // Update the lastClaimed timestamp
            },
        });

        res.json({
            message: 'Reward claimed successfully',
            balance: updatedUser.balance,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error claiming reward' });
    }
});

// API route to handle withdrawal request
app.post('/api/withdraw', async (req, res) => {
    const { userId, withdrawalAmount } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (withdrawalAmount < 3) {
            return res.status(400).json({ message: 'Minimum withdrawal is $3' });
        }

        if (withdrawalAmount > user.balance) {
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Deduct the withdrawal amount
        await prisma.user.update({
            where: { id: userId },
            data: { balance: { decrement: withdrawalAmount } },
        });

        // Add logic to process the withdrawal (e.g., sending to an address)
        res.json({ message: `Withdrawal of $${withdrawalAmount} processed successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error processing withdrawal' });
    }
});

// API route to get the user balance
app.get('/api/balance/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (user) {
            res.json({ balance: user.balance });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching balance' });
    }
});

// Generate a random referral code
function generateReferralCode() {
    return Math.random().toString(36).substring(2, 10); // Random 8 character code
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
