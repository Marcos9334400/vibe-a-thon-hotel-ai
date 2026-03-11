require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');
const { checkHotelFraud, updateHotelTrustScore, handleDispute } = require('./agent');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/check-fraud', async (req, res) => {
    try {
        const { hotelName, location, priceInEth } = req.body;
        const result = await checkHotelFraud(hotelName, location, priceInEth);
        res.json(result);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/update-trust', async (req, res) => {
    try {
        const result = await updateHotelTrustScore(req.body.hotelId);
        res.json(result);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/resolve-dispute', async (req, res) => {
    try {
        const { bookingId, complaint } = req.body;
        const result = await handleDispute(bookingId, complaint);
        res.json(result);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(3001, () => console.log('🚀 AI Server running: http://localhost:3001'));