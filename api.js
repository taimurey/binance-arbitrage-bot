const axios = require('axios');
const crypto = require('crypto');
const io = require('./logger');

async function exchangeInfo() {
    const response = await axios.get(`${process.env.API_URL}/v3/exchangeInfo`);
    const data = response.data.symbols.filter(s => s.status === 'TRADING').map(s => {
        const lotSizeFilter = s.filters.find(f => f.filterType === 'LOT_SIZE') || {};
        return {
            symbol: s.symbol,
            base: s.baseAsset,
            quote: s.quoteAsset,
            baseAssetPrecision: s.baseAssetPrecision,
            quoteAssetPrecision: s.quoteAssetPrecision,
            minQty: lotSizeFilter.minQty ? parseFloat(lotSizeFilter.minQty) : null,
            maxQty: lotSizeFilter.maxQty ? parseFloat(lotSizeFilter.maxQty) : null,
            stepSize: lotSizeFilter.stepSize ? parseFloat(lotSizeFilter.stepSize) : null
        };
    });

     // Store fetched data in the global variable
     exchangeData = data.reduce((acc, curr) => {
        acc[curr.symbol] = curr;
        return acc;
    }, {});

    return data;
}


async function getCurrentBalance(asset) {
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = crypto.createHmac('sha256', process.env.SECRET_KEY).update(queryString).digest('hex');
        const url = `${process.env.API_URL}/v3/account?${queryString}&signature=${signature}`;

        const response = await axios({
            method: 'GET',
            url: url,
            headers: { 'X-MBX-APIKEY': process.env.API_KEY }
        });

        const data = response.data.balances.find(b => b.asset === asset);
        return data ? data.free : 0; // Return 0 if asset not found
    } catch (err) {
        console.error('Error in getCurrentBalance: ', err.message);
        return 0; // Return 0 in case of error for safe fallback
    }
}

// Function to adjust quantity according to LOT_SIZE filter
function adjustQuantityForLotSize(quantity, minQty, maxQty, stepSize) {
    if (!minQty || !maxQty || !stepSize) return quantity; // If filter details are not available, return original quantity

    quantity = Math.max(minQty, Math.min(quantity, maxQty)); // Ensure within min/max limits
    const stepFactor = 1 / stepSize;
    return Math.floor(quantity * stepFactor) / stepFactor; // Align with step size
}


async function newOrder(symbol, quantity, side, quoteOrderQty) {
    const data = {
        symbol,
        side,
        type: 'MARKET',
        timestamp: Date.now(),
        recvWindow: 5000//máximo permitido 60000, default 5000
    };

    // Access lotSizeInfo for the symbol
     const lotSizeInfo = exchangeData[symbol] || {};

    //  // Fetch current balance
    //  const asset = side === "BUY" ? symbol.split(/(BTC|ETH|USDT)$/)[1] : symbol.split(/(BTC|ETH|USDT)$/)[0];
    //  const currentBalance = await getCurrentBalance(asset);
    //  logMessage(`Current ${asset} balance: ${currentBalance}`);
 
    //  // Adjust quantity for LOT_SIZE if selling
     if (side !== "BUY") {
         quantity = adjustQuantityForLotSize(quantity, lotSizeInfo.minQty, lotSizeInfo.maxQty, lotSizeInfo.stepSize);
     }
        

    if (side === "BUY" && quantity)
        data.quoteOrderQty = quantity;
    else
        data.quantity = quantity || quoteOrderQty;

    const signature = crypto
        .createHmac('sha256', process.env.SECRET_KEY)
        .update(`${new URLSearchParams(data)}`)
        .digest('hex');


    const newData = { ...data, signature };
    const qs = `?${new URLSearchParams(newData)}`;

    try {
        const result = await axios({
            method: 'POST',
            url: `${process.env.API_URL}/v3/order${qs}`,
            headers: { 'X-MBX-APIKEY': process.env.API_KEY }
        });
        logMessage(`API Response: ${result.data}`);
        return result.data;
    } catch (err) {
        logMessage2(err.response.data);
        return false;
    }
}

function logMessage(message) {
    const formattedMessage = JSON.stringify(message, null, 2); 
    io.emit('log1', formattedMessage);
}
function logMessage2(message) {
    const formattedMessage = JSON.stringify(message, null, 2); 
    io.emit('log2', formattedMessage); 
}

module.exports = { exchangeInfo, newOrder }
