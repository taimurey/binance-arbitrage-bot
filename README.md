# Binance Arbitrage Bot

## Introduction

Welcome to the Binance Arbitrage Bot, a sophisticated tool designed to exploit price discrepancies in cryptocurrency pairs on the Binance exchange. Authored by Taimoor, this bot is an innovative solution for traders looking to leverage arbitrage opportunities in the dynamic crypto market.

## Features

- **Real-Time Data Processing**: Utilizes Binance's API to fetch real-time trading data.
- **Automated Trading**: Executes buy and sell orders when arbitrage opportunities are detected.
- **Customizable Parameters**: Offers flexibility in setting trading parameters according to user preference.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/taimurey/binance-arbitrage-bot.git
   ```
2. Navigate to the bot directory:
   ```bash
   cd binance-arbitrage-bot
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

To configure the bot, you need to set up the `.env` file with the following parameters:

```
API_URL=https://api.binance.com/api
STREAM_URL=wss://stream.binance.com:9443/ws
API_KEY=your_binance_api_key
SECRET_KEY=your_binance_secret_key
CRAWLER_INTERVAL=3000
PROFITABILITY=1.005
QUOTE=USDT
AMOUNT=10
```

### Guide on .env File

- **API_URL**: The URL to Binance's REST API.
- **STREAM_URL**: Websocket stream URL for real-time data.
- **API_KEY**: Your Binance API key (replace `your_binance_api_key` with your actual API key).
- **SECRET_KEY**: Your Binance Secret Key (replace `your_binance_secret_key` with your actual secret key).
- **CRAWLER_INTERVAL**: Time interval (in milliseconds) for the bot to scan for arbitrage opportunities.
- **PROFITABILITY**: The minimum profitability ratio to initiate a trade.
- **QUOTE**: The quote asset for trading pairs (e.g., USDT).
- **AMOUNT**: The amount of quote asset to use in each trade.

**Security Note**: Never share your API key and secret key publicly. Ensure they are kept confidential.

## Usage

To run the bot, use the following command:

```bash
npm start
```

## Contribution

Pull Requests to improve the bot are highly welcome. Currently, the bot faces issues with the third sell order, and contributions to rectify this problem would be greatly appreciated. To contribute:

1. Fork the repository.
2. Create a new branch for your feature.
3. Commit your changes.
4. Push to the branch.
5. Open a Pull Request.

## Issues and Feedback

For any issues, feedback, or suggestions, please visit [Taimoor's GitHub](https://github.com/taimurey) and open an issue or pull request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Authored by **Taimoor**

Happy Trading! 🚀📈
