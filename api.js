const axios = require('axios');
const crypto = require('crypto');

async function exchangeInfo() {
    const response = await axios.get(`${process.env.API_URL}/v3/exchangeInfo`);
    const data = response.data.symbols.filter(s => s.status === 'TRADING').map(s => {
        return {
            symbol: s.symbol,
            base: s.baseAsset,
            quote: s.quoteAsset,
            baseAssetPrecision: s.baseAssetPrecision,
            quoteAssetPrecision: s.quoteAssetPrecision,
        }
    });

    console.log(data);
    return data;
}

async function currentbalance(asset) {
    const response = await axios({
        method: 'GET',
        url: `${process.env.API_URL}/v3/account`,
        headers: { 'X-MBX-APIKEY': process.env.API_KEY }
    });

    const data = response.data.balances.filter(b => b.asset === asset);
    return data[0].free;

}

function adjustQuantity(quantity, precision) {
    const factor = Math.pow(10, precision);
    return Math.floor(quantity * factor) / factor;
}

async function newOrder(symbol, quantity, side, quoteOrderQty) {
    const data = {
        symbol,
        side,
        type: 'MARKET',
        timestamp: Date.now(),
        recvWindow: 5000//máximo permitido 60000, default 5000
    };

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
        console.log(`API Response: ${result.data}`);
        return result.data;
    } catch (err) {
        console.log(err.response.data);
        return false;
    }
}


module.exports = { exchangeInfo, newOrder }
