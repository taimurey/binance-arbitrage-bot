const axios = require('axios');
const crypto = require('crypto');
const io = require('./logging/logger');


function logMessage2(message) {
    const currentTime = new Date().toLocaleTimeString(); 
    const formattedMessage = `${currentTime}: ${JSON.stringify(message, null, 2)}`;
    io.emit('log2', formattedMessage); 
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

// Function to correctly round the quantity to the nearest valid step size
function roundToStepSize(quantity, stepSize) {
    const precision = stepSize.toString().split('.')[1]?.length || 0;
    const scaler = Math.pow(10, precision);
    return Math.floor(quantity * scaler) / scaler;
}

async function swapBTCtoUSDT() {
    const symbol = 'BTCUSDT';
    let quantity;
    const side = 'SELL'; // Change to SELL to sell BTC for USDT

    logMessage(`Placing new ${side} order for symbol: ${symbol}`);

    const data = {
        symbol,
        side,
        type: 'MARKET',
        timestamp: Date.now(),
        recvWindow: 5000
    };

    const { minQty, maxQty, stepSize } = exchangeData[symbol] || {};

    let currentBalance = await getCurrentBalance('BTC');
    if (!currentBalance) {
        console.error('Failed to fetch current BTC balance');
        return false;
    }

    currentBalance = parseFloat(currentBalance);
    if (isNaN(currentBalance)) {
        console.error('Invalid current BTC balance:', currentBalance);
        return false;
    }
    console.log(`Current BTC balance is: ${currentBalance}`);

    quantity = currentBalance;
    if (minQty && maxQty && stepSize) {
        quantity = Math.max(minQty, Math.min(quantity, maxQty));
        quantity = roundToStepSize(quantity, stepSize);
    }

    logMessage(`Quantity after adjustments for ${symbol}:`, quantity);

    data.quantity = quantity; // Use the adjusted quantity

    const signature = crypto.createHmac('sha256', process.env.SECRET_KEY)
                            .update(`${new URLSearchParams(data)}`)
                            .digest('hex');
    const newData = { ...data, signature };
    const qs = `?${new URLSearchParams(newData)}`;

    try {
        const result = await axios.post(`${process.env.API_URL}/v3/order${qs}`, null, {
            headers: { 'X-MBX-APIKEY': process.env.API_KEY }
        });
        logMessage(`API Response for SELL order ${symbol}:`, result.data);
        return result.data;
    } catch (err) {
            if (err.response) {
              
                // Log the whole response if it exists
                console.error(`Error in placing SELL order for ${symbol}:`, err.response.data);
                logMessage2(`Error in placing SELL order for ${symbol}: ${JSON.stringify(err.response.data)}`);
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
    async function swapAssetToUSDT(assetSymbol, quantity) {
        const symbol = `${assetSymbol}USDT`;
        const side = 'SELL';
    
        logMessage(`Placing new ${side} order for symbol: ${symbol}`);
    
        const data = {
            symbol,
            side,
            type: 'MARKET',
            quantity,
            timestamp: Date.now(),
            recvWindow: 5000
        };
    
        const { minQty, maxQty, stepSize } = exchangeData[symbol] || {};
    
        let currentBalance = await getCurrentBalance(assetSymbol); // Fetch current BNB balance
        if (!currentBalance) {
            console.error('Failed to fetch current ${assetSymbol} balance');
            return false;
        }
    
        currentBalance = parseFloat(currentBalance);
        if (isNaN(currentBalance)) {
            console.error('Invalid current ${assetSymbol} balance:', currentBalance);
            return false;
        }
        console.log(`Current ${assetSymbol} balance is: ${currentBalance}`);
    
        quantity = currentBalance;
        if (minQty && maxQty && stepSize) {
            quantity = Math.max(minQty, Math.min(quantity, maxQty));
            quantity = roundToStepSize(quantity, stepSize);
        }
    
        logMessage(`Quantity after adjustments for ${symbol}:`, quantity);
    
        data.quantity = quantity; // Use the adjusted quantity
    
        const signature = crypto.createHmac('sha256', process.env.SECRET_KEY)
                                .update(`${new URLSearchParams(data)}`)
                                .digest('hex');
        const newData = { ...data, signature };
        const qs = `?${new URLSearchParams(newData)}`;
    
        try {
            const result = await axios.post(`${process.env.API_URL}/v3/order${qs}`, null, {
                headers: { 'X-MBX-APIKEY': process.env.API_KEY }
            });
            logMessage(`API Response for ${side} order ${symbol}:`, result.data);
            return result.data;
        } catch (err) {
            if (err.response) {
              
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

    async function convertAllAssetsToUSDT() {
        try {
            const assets = await getAllAssets();
    
            // Sort assets based on total balance (free + locked) in descending order
            const sortedAssets = assets.sort((a, b) => {
                const totalBalanceA = parseFloat(a.free) + parseFloat(a.locked);
                const totalBalanceB = parseFloat(b.free) + parseFloat(b.locked);
                return totalBalanceB - totalBalanceA;
            });
    
            for (const asset of sortedAssets) {
                if (asset.symbol === 'USDT') continue;
    
                const directPair = `${asset.symbol}USDT`;
    
                if (await isTradable(directPair)) {
                    await convertAssetToUSDT(asset.symbol, directPair);
                } else {
                    logMessage2(`No direct trading pair available for ${asset.symbol} to USDT`);
                    await convertThroughIntermediate(asset.symbol); // Function to convert through an intermediate
                }
            }
        } catch (error) {
            console.error('Error converting assets to USDT:', error);
        }
    }
    

    async function convertThroughIntermediate(assetSymbol) {
        // Define your intermediate currency, e.g., BTC or BNB
        const intermediate = 'BTC'; // or 'BNB'
    
        // First convert asset to intermediate currency
        const intermediatePair = `${assetSymbol}${intermediate}`;
        if (await isTradable(intermediatePair)) {
            await swapAssetToOther(assetSymbol, intermediate, intermediatePair); // This is a new function you need to implement
        } else {
            console.error(`No trading pair available for ${assetSymbol} to ${intermediate}`);
            return;
        }
    
        // Then convert intermediate currency to USDT
        const usdtPair = `${intermediate}USDT`;
        if (await isTradable(usdtPair)) {
            let intermediateQuantity = await getCurrentBalance(intermediate);
            await swapAssetToUSDT(intermediate, intermediateQuantity);
        } else {
            console.error(`No trading pair available for ${intermediate} to USDT`);
        }
    }
    

    async function convertAssetToUSDT(assetSymbol, tradingPair) {
        try {
            let quantity = await getCurrentBalance(assetSymbol);
            if (!quantity) {
                console.error(`Failed to fetch balance or no balance for ${assetSymbol}`);
                return;
            }
    
            quantity = parseFloat(quantity);
            if (isNaN(quantity)) {
                console.error(`Invalid balance for ${assetSymbol}:`, quantity);
                return;
            }
    
            if (tradingPair.endsWith('USDT')) {
                await swapAssetToUSDT(assetSymbol, quantity);
            } else {
                console.error(`Trading pair ${tradingPair} not supported for direct conversion to USDT.`);
            }
        } catch (error) {
            console.error(`Error converting ${assetSymbol} to USDT:`, error);
        }
    }
    
    async function isTradable(pair) {
        try {
            const response = await axios.get(`${process.env.API_URL}/v1/exchangeInfo`);
            const pairInfo = response.data.symbols.find(symbol => symbol.symbol === pair);
            return pairInfo ? pairInfo.status === 'TRADING' : false;
        } catch (error) {
            console.error(`Error checking if pair ${pair} is tradable:`, error);
            return false;
        }
    }
    

    async function getAllAssets() {
        try {
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = crypto.createHmac('sha256', process.env.SECRET_KEY).update(queryString).digest('hex');
    
            const response = await axios({
                method: 'GET',
                url: `${process.env.API_URL}/v3/account?${queryString}&signature=${signature}`,
                headers: { 'X-MBX-APIKEY': process.env.API_KEY }
            });
            return response.data.balances
                .filter(asset => parseFloat(asset.free) > 0 || parseFloat(asset.locked) > 0)
                .map(asset => ({
                    symbol: asset.asset,
                    free: asset.free,
                    locked: asset.locked
                }));

        } catch (error) {
            console.error('Error fetching assets:', error);
            return [];
        }
    }

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


    module.exports = { swapBTCtoUSDT, convertAllAssetsToUSDT,exchangeInfo };