const {  newOrder } = require("./api");
const { exchangeInfo } = require("./converter");
const stream = require("./stream");
const { logMessage } = require("./api");
const {  convertAllAssetsToUSDT } = require('./converter');
const QUOTE = process.env.QUOTE;
const AMOUNT = parseInt(process.env.AMOUNT);
const INTERVAL = parseInt(process.env.CRAWLER_INTERVAL);
const PROFITABILITY = parseFloat(process.env.PROFITABILITY);

function getBuyBuySell(buySymbols, allSymbols, symbolsMap) {
    const buyBuySell = [];
    for (let i = 0; i < buySymbols.length; i++) {
        const buy1 = buySymbols[i];

        const right = allSymbols.filter(s => s.quote === buy1.base);

        for (let j = 0; j < right.length; j++) {
            const buy2 = right[j];

            const sell1 = symbolsMap[buy2.base + buy1.quote];
            if (!sell1) continue;

            buyBuySell.push({ buy1, buy2, sell1 });
        }
    }
    return buyBuySell;
}

function getBuySellSell(buySymbols, allSymbols, symbolsMap) {
    const buySellSell = [];
    for (let i = 0; i < buySymbols.length; i++) {
        const buy1 = buySymbols[i];

        const right = allSymbols.filter(s => s.base === buy1.base && s.quote !== buy1.quote);

        for (let j = 0; j < right.length; j++) {
            const sell1 = right[j];

            const sell2 = symbolsMap[sell1.quote + buy1.quote];
            if (!sell2) continue;

            buySellSell.push({ buy1, sell1, sell2 });
        }
    }
    return buySellSell;
}

async function processBuyBuySell(buyBuySell) {
    for (let i = 0; i < buyBuySell.length; i++) {
        const candidate = buyBuySell[i];

        //verifica se já temos todos os preços
        let priceBuy1 = stream.getBook(candidate.buy1.symbol);
        if (!priceBuy1) continue;
        priceBuy1 = parseFloat(priceBuy1.price);

        let priceBuy2 = stream.getBook(candidate.buy2.symbol);
        if (!priceBuy2) continue;
        priceBuy2 = parseFloat(priceBuy2.price);

        let priceSell1 = stream.getBook(candidate.sell1.symbol);
        if (!priceSell1) continue;

        priceSell1 = parseFloat(priceSell1.price);

        //se tem o preço dos 3, pode analisar a lucratividade
        const crossRate = (1 / priceBuy1) * (1 / priceBuy2) * priceSell1;
        if (crossRate > PROFITABILITY) {
            logMessage(`OP BBS EM ${candidate.buy1.symbol} > ${candidate.buy2.symbol} > ${candidate.sell1.symbol} = ${crossRate}`);
            logMessage(`Investing ${QUOTE} ${AMOUNT}, returns: ${QUOTE} ${((AMOUNT / priceBuy1) / priceBuy2) * priceSell1}`);
            logMessage("SENDING BUY ORDER 1");
            const dataBuy1 = await newOrder(candidate.buy1.symbol, AMOUNT, "BUY");
            logMessage("SENDING BUY ORDER 2");

            try{ 
                const dataBuy2 = await newOrder(candidate.buy2.symbol, 0, "BUY", dataBuy1.executedQty);
                logMessage("Second Order Placed");

                logMessage("SENDING SELL ORDER 3");
                newOrder(candidate.sell1.symbol, dataBuy2.executedQty, "SELL");

              } catch (error) {
                console.error("Error placing second order: ", error.message);
            }
        }
    }
}

async function processBuySellSell(buySellSell) {
    for (let i = 0; i < buySellSell.length; i++) {
        const candidate = buySellSell[i];

        //verifica se já temos todos os preços
        let priceBuy1 = stream.getBook(candidate.buy1.symbol);
        if (!priceBuy1) continue;
        priceBuy1 = parseFloat(priceBuy1.price);

        let priceSell1 = stream.getBook(candidate.sell1.symbol);
        if (!priceSell1) continue;
        priceSell1 = parseFloat(priceSell1.price);

        let priceSell2 = stream.getBook(candidate.sell2.symbol);
        if (!priceSell2) continue;
        priceSell2 = parseFloat(priceSell2.price);

        //se tem o preço dos 3, pode analisar a lucratividade
        const crossRate = (1 / priceBuy1) * priceSell1 * priceSell2;
        if (crossRate > PROFITABILITY) {
          logMessage(`OP BSS EM ${candidate.buy1.symbol} > ${candidate.sell1.symbol} > ${candidate.sell2.symbol} = ${crossRate}`);
            logMessage(`Investing ${QUOTE} ${AMOUNT}, returns ${QUOTE} ${((AMOUNT / priceBuy1) * priceSell1) * priceSell2}`);
            logMessage("SENDING BUY 1");
            const dataBuy1 = await newOrder(candidate.buy1.symbol, AMOUNT, "BUY");
            logMessage("SENDING SELL 2");
            const dataSell1 = await newOrder(candidate.sell1.symbol, dataBuy1.executedQty, "SELL");
            logMessage("SENDING SELL 3");
            newOrder(candidate.sell2.symbol, dataSell1.executedQty, "SELL");
          
        }
    }
}

function getSymbolMap(symbols) {
    const map = {};
    symbols.map(s => map[s.symbol] = s);
    return map;
}

async function start() {
    //pega todas moedas que estão sendo negociadas
    // logMessage('Loading Exchange Info...');
     const allSymbols = await exchangeInfo();

    // //moedas que você pode comprar
    const buySymbols = allSymbols.filter(s => s.quote === QUOTE);
    logMessage('There are ' + buySymbols.length + " pairs that you can buy with " + QUOTE);

    //organiza em map para performance
    const symbolsMap = getSymbolMap(allSymbols);

    //descobre todos os pares que podem triangular BUY-BUY-SELL
    const buyBuySell = getBuyBuySell(buySymbols, allSymbols, symbolsMap);
    logMessage('There are ' + buyBuySell.length + " pairs that we can do BBS");

    //descobre todos os pares que podem triangular BUY-SELL-SELL
    const buySellSell = getBuySellSell(buySymbols, allSymbols, symbolsMap);
    logMessage('There are ' + buySellSell.length + " pairs that we can do BSS");

    setInterval(async () => {
        logMessage(new Date());
        processBuyBuySell(buyBuySell);
        processBuySellSell(buySellSell);
        // convertAllAssetsToUSDT();
    }, INTERVAL || 3000)

    
}



start();