// ethers is loaded from CDN in index.html
// Wait for ethers to be available before using it
// Keep address in lowercase, ethers will checksum it properly
let CONTRACT_ADDRESS = "0x8fb982d78e53c6423652a628dbc6c31923b811dd";

const ABI = [
    "function listHotel(string memory _name, string memory _location, uint256 _pricePerNight) public",
    "function bookHotel(uint256 _hotelId) public payable",
    "function confirmCheckIn(uint256 _bookingId) public",
    "function cancelBooking(uint256 _bookingId) public",
    "function submitReview(uint256 _hotelId, uint8 _rating, string memory _comment) public",
    "function raiseDispute(uint256 _bookingId) public",
    "function getHotel(uint256 _hotelId) public view returns (tuple(string name, string location, uint256 pricePerNight, bool isActive, uint256 trustScore, address owner))",
    "function hotelCount() public view returns (uint256)"
];

let provider, signer, contract;

// Ensure ethers is available
function ensureEthers() {
    if (typeof ethers === 'undefined') {
        throw new Error('ethers library not loaded. Please make sure ethers.js is loaded before wallet.js');
    }
}

async function connectWallet() {
    console.log("connectWallet function called");
    try {
        // Ensure ethers is available
        ensureEthers();
        
        if (!window.ethereum) {
            alert("MetaMask not found! Please install MetaMask extension.");
            return;
        }

        console.log("Attempting to connect wallet...");

        // Switch to Sepolia if not already
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
            });
            console.log("Switched to Sepolia network");
        } catch (switchError) {
            console.log("Switch error:", switchError);
            // If network doesn't exist, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0xaa36a7',
                            chainName: 'Sepolia',
                            nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['https://ethereum-sepolia.publicnode.com', 'https://rpc.sepolia.org', 'https://sepolia.infura.io/v3/'],
                            blockExplorerUrls: ['https://sepolia.etherscan.io']
                        }]
                    });
                    console.log("Added Sepolia network");
                } catch (addError) {
                    console.error("Failed to add Sepolia network:", addError);
                    alert('Failed to add Sepolia network: ' + addError.message);
                    return;
                }
            } else {
                console.error("Failed to switch to Sepolia:", switchError);
                alert('Failed to switch to Sepolia network: ' + switchError.message);
                return;
            }
        }

        console.log("Requesting accounts...");
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log("Accounts received:", accounts);
        if (!accounts || accounts.length === 0) {
            alert("No accounts found in MetaMask");
            return;
        }

        // In ethers v5, create provider from ethereum
        console.log("Creating provider with ethers...");
        try {
            // ethers v5 with MetaMask
            provider = new ethers.providers.Web3Provider(window.ethereum);
            console.log("Web3Provider created successfully");
        } catch (e1) {
            console.warn("Web3Provider failed, trying alternative method:", e1);
            try {
                // Alternative: use JsonRpcProvider
                provider = new ethers.providers.JsonRpcProvider("https://ethereum-sepolia.publicnode.com");
            } catch (e2) {
                console.error("All provider methods failed");
                alert("Failed to initialize provider. Error: " + e1.message);
                return;
            }
        }
        
        console.log("Provider created:", provider);
        console.log("Getting signer...");
        
        signer = provider.getSigner();
        console.log("Signer obtained:", signer);
        
        console.log("Creating contract instance...");
        // Ensure address is properly checksummed for ethers v5
        const checksummedAddress = ethers.utils.getAddress(CONTRACT_ADDRESS);
        console.log("Checksummed address:", checksummedAddress);
        contract = new ethers.Contract(checksummedAddress, ABI, signer);
        console.log("Contract created:", contract);

        console.log("Getting wallet address...");
        const addr = await signer.getAddress();
        console.log("Connected address:", addr);

        document.getElementById('walletStatus').innerHTML =
            `<span style="color:#2ed573">🟢 ${addr.slice(0,6)}...${addr.slice(-4)}</span>`;

        alert("Wallet connected successfully!");

    } catch (error) {
        console.error("Wallet connection error:", error);
        alert("Connection failed: " + error.message);
    }
}

function showResult(id, html, type) {
    const el = document.getElementById(id);
    el.className = 'result show';
    el.innerHTML = `<div class="${type}">${html}</div>`;
}

async function searchHotels() {
    console.log("searchHotels function called");
    const city = document.getElementById('searchCity').value;
    console.log("Searching for city:", city);
    if (!city) { alert("Enter a city or landmark!"); return; }
    const div = document.getElementById('hotelResults');
    div.innerHTML = '<br><div class="loading">🤖 AI finding hotels near ' + city + '...</div>';
    try {
        const res = await fetch('http://localhost:3001/search-hotels', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ city })
        });
        const { hotels } = await res.json();
        let html = '<br>';
        for (const h of hotels) {
            const badge = h.score>=70 ? 'badge-safe' : h.score>=40 ? 'badge-warn' : 'badge-danger';
            const label = h.score>=70 ? '✅ SAFE' : h.score>=40 ? '⚠️ CAUTION' : '🚨 SUSPICIOUS';
            const cls = h.score>=70 ? 'trust-high' : h.score>=40 ? '' : 'trust-low';
            html += `<div class="hotel-card ${cls}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong>${h.name}</strong>
                    <span class="badge ${badge}">${label} ${h.score}/100</span>
                </div>
                <div style="color:#888;font-size:0.9rem;margin-top:5px">
                    📍 ${h.location} &nbsp;|&nbsp; 💰 ${h.price} ETH/night
                </div>
                <div style="color:#aaa;font-size:0.85rem;margin-top:5px">AI: ${h.reason}</div>
                <div style="margin-top:10px">
                    <strong>ID: ${h.id}</strong>
                    ${h.score>=40
                        ? `<button onclick="selectHotel(${h.id})" style="margin-left:10px;padding:6px 12px;font-size:0.85rem">Book This</button>`
                        : '<span style="color:#ff4757;margin-left:10px">❌ Blocked by AI</span>'}
                </div>
            </div>`;
        }
        div.innerHTML = html;
    } catch(e) {
        div.innerHTML = '<br><div class="err">❌ AI server not running!</div>';
    }
}

async function listHotel() {
    console.log("listHotel function called");
    if (!contract) { 
        console.log("No contract available");
        alert("Connect wallet!"); 
        return; 
    }
    showResult('listResult', '⏳ Listing on blockchain...', 'loading');
    try {
        const tx = await contract.listHotel(
            document.getElementById('hotelName').value,
            document.getElementById('hotelLocation').value,
            ethers.utils.parseEther(document.getElementById('hotelPrice').value)
        );
        await tx.wait();
        showResult('listResult', `✅ Hotel listed!<br>🔗 <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">View on Explorer</a>`, 'ok');
    } catch(e) { showResult('listResult', `❌ ${e.message}`, 'err'); }
}

async function bookHotel() {
    if (!contract) { alert("Connect wallet!"); return; }
    showResult('bookResult', '⏳ Locking payment in escrow...', 'loading');
    try {
        const tx = await contract.bookHotel(
            document.getElementById('bookHotelId').value,
            { value: ethers.utils.parseEther(document.getElementById('bookAmount').value) }
        );
        await tx.wait();
        showResult('bookResult', `✅ Booked! Payment locked in escrow.<br>Hotel gets paid only after check-in.<br>🔗 <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">View on Explorer</a>`, 'ok');
    } catch(e) { showResult('bookResult', `❌ ${e.message}`, 'err'); }
}

async function confirmCheckIn() {
    if (!contract) { alert("Connect wallet!"); return; }
    showResult('confirmResult', '⏳ Confirming check-in...', 'loading');
    try {
        const tx = await contract.confirmCheckIn(document.getElementById('confirmId').value);
        await tx.wait();
        showResult('confirmResult', `✅ Check-in confirmed! Payment released to hotel.<br>🔗 <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">View on Explorer</a>`, 'ok');
    } catch(e) { showResult('confirmResult', `❌ ${e.message}`, 'err'); }
}

async function cancelBooking() {
    if (!contract) { alert("Connect wallet!"); return; }
    showResult('cancelResult', '⏳ Cancelling...', 'loading');
    try {
        const tx = await contract.cancelBooking(document.getElementById('cancelId').value);
        await tx.wait();
        showResult('cancelResult', `✅ Cancelled! ETH refunded.<br>🔗 <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">View on Explorer</a>`, 'ok');
    } catch(e) { showResult('cancelResult', `❌ ${e.message}`, 'err'); }
}

async function raiseDispute() {
    if (!contract) { alert("Connect wallet!"); return; }
    showResult('disputeResult', '⏳ Raising dispute on blockchain...', 'loading');
    try {
        const tx = await contract.raiseDispute(document.getElementById('disputeId').value);
        await tx.wait();
        showResult('disputeResult', '🤖 Dispute raised! AI is analyzing complaint...', 'loading');
        const res = await fetch('http://localhost:3001/resolve-dispute', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
                bookingId: document.getElementById('disputeId').value,
                complaint: document.getElementById('disputeText').value
            })
        });
        const { refund, reason } = await res.json();
        showResult('disputeResult',
            `⚖️ AI Decision: <strong>${refund ? '✅ REFUND APPROVED' : '❌ NO REFUND'}</strong><br>
            Reason: ${reason}`, 'ok');
    } catch(e) { showResult('disputeResult', `❌ ${e.message}`, 'err'); }
}

async function submitReview() {
    if (!contract) { alert("Connect wallet!"); return; }
    showResult('reviewResult', '⏳ Storing on blockchain forever...', 'loading');
    try {
        const tx = await contract.submitReview(
            document.getElementById('reviewHotelId').value,
            parseInt(document.getElementById('reviewRating').value),
            document.getElementById('reviewText').value
        );
        await tx.wait();
        showResult('reviewResult', `✅ Review permanent on blockchain!<br>Hotel can NEVER delete this.<br>🔗 <a href="https://sepolia.etherscan.io/tx/${tx.hash}" target="_blank">View on Explorer</a>`, 'ok');
    } catch(e) { showResult('reviewResult', `❌ ${e.message}`, 'err'); }
}

function selectHotel(hotelId) {
    document.getElementById('bookHotelId').value = hotelId;
    // Scroll to the booking section
    document.getElementById('bookHotelId').scrollIntoView({ behavior: 'smooth' });
    alert(`Hotel ${hotelId} selected for booking!`);
}

// Make functions globally available
console.log("Wallet.js loaded successfully!");
console.log("Available functions:", { connectWallet, searchHotels, selectHotel, listHotel, bookHotel });

window.connectWallet = connectWallet;
window.searchHotels = searchHotels;
window.selectHotel = selectHotel;
window.listHotel = listHotel;
window.bookHotel = bookHotel;
window.confirmCheckIn = confirmCheckIn;
window.cancelBooking = cancelBooking;
window.raiseDispute = raiseDispute;
window.submitReview = submitReview;