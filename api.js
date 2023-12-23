const axios = require('axios');
const crypto = require('crypto');
const io = require('./logging/logger');
const { swapBTCtoUSDT, convertAllAssetsToUSDT } = require('./converter');

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

function logMessage(message) {
    const currentTime = new Date().toLocaleTimeString();

    let formattedMessage;

    try {
        // If the message is not a valid JSON object, handle it as a string
        formattedMessage = `${currentTime}: ${message.toString()}`;
    } catch (error) {
        // Attempt to stringify if the message is a valid JSON object
        formattedMessage = `${currentTime}: ${JSON.stringify(message, null, 2)}`;
    }

    io.emit('log1', formattedMessage);
}


function logMessage2(message) {
    const currentTime = new Date().toLocaleTimeString(); 
    const formattedMessage = `${currentTime}: ${JSON.stringify(message, null, 2)}`;
    io.emit('log2', formattedMessage); 
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
        console.error('Error in getCurrentBalance: ', err);
        return 0; // Return 0 in case of error for safe fallback
    }
}




// Function to adjust quantity according to LOT_SIZE filter
function adjustQuantityForLotSize(quantity, minQty, maxQty, stepSize) {
    if (!minQty || !maxQty || !stepSize) return quantity;

    // Ensure all values are numeric
    [quantity, minQty, maxQty, stepSize].forEach(value => {
        if (isNaN(value)) {
            console.error(`Invalid parameter: ${value}`);
            return NaN;
        }
    });

    // Adjusting quantity to be within min and max limits
    quantity = Math.max(minQty, Math.min(quantity, maxQty));

    // Adjusting quantity to align with step size - using a less aggressive rounding strategy
    const stepFactor = 1 / stepSize;
    quantity = Math.floor(quantity * stepFactor) / stepFactor;

    // Ensuring the adjusted quantity is still within the range and not less than the minimum
    quantity = Math.max(minQty, quantity);
    return quantity <= maxQty ? quantity : NaN;
}

// Function to correctly round the quantity to the nearest valid step size
function roundToStepSize(quantity, stepSize) {
    const precision = stepSize.toString().split('.')[1]?.length || 0;
    const scaler = Math.pow(10, precision);
    return Math.floor(quantity * scaler) / scaler;
}

function getCurrentPrice(symbol) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios.get(`${process.env.API_URL}/v3/ticker/price?symbol=${symbol}`);
            resolve(response.data.price);
        } catch (err) {
            reject(err);
        }
    });
}


async function newOrder(symbol, quantity, side, quoteOrderQty) {
    console.log(`Placing new ${side} order for symbol: ${symbol}`);

    const data = {
        symbol,
        side,
        type: 'MARKET',
        timestamp: Date.now(),
        recvWindow: 5000
    };

    const { minQty, maxQty, stepSize, minNotional } = exchangeData[symbol] || {};

    // Fetch current balance
    const asset = side === "BUY" ? symbol.split(/(BTC|ETH|USDT)$/)[1] : symbol.split(/(BTC|ETH|USDT)$/)[0];
    let currentBalance = await getCurrentBalance(asset);
    if (!currentBalance) {
        console.error(`Failed to fetch current balance for ${asset}`);
        return false;
    }

    currentBalance = parseFloat(currentBalance);
    if (isNaN(currentBalance)) {
        console.error(`Invalid current balance for ${asset}:`, currentBalance);
        return false;
    }
    logMessage(`Current ${asset} balance: ${currentBalance}`);

    if (minQty && maxQty && stepSize) {
        quantity = Math.max(minQty, Math.min(quantity, maxQty));
        quantity = roundToStepSize(quantity, stepSize);
    }

    console.log(`Quantity after LOT_SIZE adjustment for ${symbol}:`, quantity);

    if (side !== "BUY") {
        quantity = currentBalance;
    }

    console.log(`Quantity after balance adjustment for ${symbol}:`, quantity);

    if (side === "BUY" && quantity) {
        data.quoteOrderQty = quantity;
    } else {
        data.quantity = quantity || quoteOrderQty;
    }
    
    console.log(`Final Quantity for ${symbol}:`, quantity);
 
    
    const signature = crypto.createHmac('sha256', process.env.SECRET_KEY).update(`${new URLSearchParams(data)}`).digest('hex');
    const newData = { ...data, signature };
    const qs = `?${new URLSearchParams(newData)}`;

    try {
        const result = await axios({
            method: 'POST',
            url: `${process.env.API_URL}/v3/order${qs}`,
            headers: { 'X-MBX-APIKEY': process.env.API_KEY }
        });
        logMessage(`API Response for ${side} order ${symbol}: ${JSON.stringify(result.data)}`);
        return result.data;
    } catch (err) {
        if (err.response) {
            if (side == "SELL") {
                swapBTCtoUSDT();
                swapBNBtoUSDT();
            }
            // Log the whole response if it exists
            console.error(`Error in placing ${side} order for ${symbol}:`, err.response.data);
            logMessage2(`Error in placing ${side} order for ${symbol}: ${JSON.stringify(err.response.data)}`);
        } else if (err.request) {
            // The request was made but no response was received
            console.error(`No response received for ${symbol}:`, err.request);
        } else {
            // Something happened in setting up the request
            console.error(`Error setting up request for ${symbol}:`, err.message);
        }
        return false;
    }
}


module.exports = { exchangeInfo, newOrder, logMessage, logMessage2 }
