require('dotenv').config({ path: './.env' });
const { ethers } = require('ethers');
const Groq = require('groq-sdk');

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CONTRACT_ABI = [
    "function updateTrustScore(uint256 _hotelId, uint256 _newScore) public",
    "function resolveDispute(uint256 _bookingId, bool _refundGuest) public",
    "function getHotel(uint256 _hotelId) public view returns (tuple(string name, string location, uint256 pricePerNight, bool isActive, uint256 trustScore, address owner))",
    "function getBooking(uint256 _bookingId) public view returns (tuple(address guest, uint256 hotelId, uint256 amount, bool isConfirmed, bool isDisputed, bool isPaid, uint256 timestamp))"
];

const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

async function checkHotelFraud(hotelName, location, priceInEth) {
    console.log(`\n🔍 AI checking: ${hotelName}...`);
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{
            role: "user",
            content: `You are a hotel fraud detection AI.
Hotel: ${hotelName}, Location: ${location}, Price: ${priceInEth} ETH
Rate legitimacy 0-100. Reply ONLY:
SCORE: [number]
REASON: [one sentence]`
        }]
    });
    const reply = response.choices[0].message.content;
    console.log(`🤖 ${reply}`);
    const score = parseInt(reply.match(/SCORE:\s*(\d+)/)?.[1] || 50);
    const reason = reply.match(/REASON:\s*(.+)/)?.[1] || "Analysis complete";
    return { score, reason };
}

async function resolveDisputeWithAI(bookingId, complaint, hotelName) {
    console.log(`\n⚖️ AI resolving dispute #${bookingId}...`);
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{
            role: "user",
            content: `You are a dispute resolution AI.
Hotel: ${hotelName}, Complaint: ${complaint}
Reply ONLY:
DECISION: REFUND or NO_REFUND
REASON: [one sentence]`
        }]
    });
    const reply = response.choices[0].message.content;
    console.log(`⚖️ ${reply}`);
    const refund = reply.includes('DECISION: REFUND');
    const reason = reply.match(/REASON:\s*(.+)/)?.[1] || "Decision made";
    return { refund, reason };
}

async function updateHotelTrustScore(hotelId) {
    const hotel = await contract.getHotel(hotelId);
    const price = ethers.formatEther(hotel.pricePerNight);
    const result = await checkHotelFraud(hotel.name, hotel.location, price);
    console.log(`\n📊 Writing score ${result.score}/100 to blockchain...`);
    const tx = await contract.updateTrustScore(hotelId, result.score);
    await tx.wait();
    console.log(`✅ Score saved! 🔗 https://sepolia.etherscan.io/tx/${tx.hash}`);
    return result;
}

async function handleDispute(bookingId, complaint) {
    const booking = await contract.getBooking(bookingId);
    const hotel = await contract.getHotel(booking.hotelId);
    const decision = await resolveDisputeWithAI(bookingId, complaint, hotel.name);
    console.log(`\n🔨 Executing on blockchain...`);
    const tx = await contract.resolveDispute(bookingId, decision.refund);
    await tx.wait();
    console.log(`✅ Resolved! 🔗 https://sepolia.etherscan.io/tx/${tx.hash}`);
    return decision;
}

module.exports = { checkHotelFraud, updateHotelTrustScore, handleDispute };
console.log("🤖 AI Agent ready!");