require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const { paymentMiddleware } = require('x402-express');
const { checkHotelFraud, updateHotelTrustScore, handleDispute } = require('./agent');

const app = express();
app.use(cors());
app.use(express.json());

const PAY_TO = process.env.PAY_TO_ADDRESS;

// x402 payment middleware — charges 0.001 USDC per AI fraud check
app.use(
  paymentMiddleware(
    PAY_TO,
    {
      "POST /check-fraud": {
        price: "$0.001",
        network: "base-sepolia",
        config: { description: "AI Hotel Fraud Detection" }
      },
      "POST /resolve-dispute": {
        price: "$0.002",
        network: "base-sepolia",
        config: { description: "AI Dispute Resolution" }
      }
    },
    { url: "https://x402.org/facilitator" }
  )
);

// These endpoints now require x402 payment!
app.post('/check-fraud', async (req, res) => {
  const { hotelName, location, priceInEth } = req.body;
  const result = await checkHotelFraud(hotelName, location, priceInEth);
  res.json(result);
});

app.post('/update-trust', async (req, res) => {
  const result = await updateHotelTrustScore(req.body.hotelId);
  res.json(result);
});

app.post('/resolve-dispute', async (req, res) => {
  const { bookingId, complaint } = req.body;
  const result = await handleDispute(bookingId, complaint);
  res.json(result);
});
app.post('/search-hotels', async (req, res) => {
    const { city } = req.body;
    const response = await groq.chat.completions.create({
        model: "llama3-8b-8192",
        messages: [{
            role: "user",
            content: `You are a hotel search AI. 
The user is looking for hotels near: "${city}"
Find or generate 4 realistic hotels near this location in India.
Consider the landmark/area/city mentioned and suggest nearby hotels.
Reply ONLY in this exact JSON format, nothing else, no extra text:
{"hotels":[
  {"id":1,"name":"Real Hotel Name","location":"exact area near ${city}","price":"0.02","score":88,"reason":"Well known hotel near the location"},
  {"id":2,"name":"Real Hotel Name","location":"exact area near ${city}","price":"0.015","score":65,"reason":"Average reviews"},
  {"id":3,"name":"Real Hotel Name","location":"exact area near ${city}","price":"0.001","score":22,"reason":"Suspicious low price"},
  {"id":4,"name":"Real Hotel Name","location":"exact area near ${city}","price":"0.03","score":92,"reason":"Premium verified hotel"}
]}`
        }]
    });
    try {
        const text = response.choices[0].message.content;
        const clean = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(clean);
        res.json(data);
    } catch(e) {
        res.json({ hotels: [] });
    }
});
app.listen(3001, () => {
  console.log('🚀 AI Server with x402 payments: http://localhost:3001');
  console.log('💰 Fraud check costs: $0.001 per request');
  console.log('⚖️  Dispute resolution costs: $0.002 per request');
});