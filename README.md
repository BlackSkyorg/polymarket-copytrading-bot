# Polymarket Copy Trading Bot

Polling-based monitoring of a target account on Polymarket, with optional automated copy trading via the Polymarket CLOB.

## Features

- Account monitoring (polling): fetches active positions for a target address and emits formatted status updates.
- Copy trading (optional): detects target position additions/removals and mirrors them with BUY/SELL orders.
- Dry-run mode: simulates execution without creating real orders.
- Risk controls: scales target quantities and enforces min/max trade value and max total position value (USD-based).

## Architecture

- `PolymarketClient` (`src/api/polymarket-client.ts`): fetches user positions and normalizes them into internal types.
- `AccountMonitor` (`src/monitor/account-monitor.ts`): polling loop that produces `TradingStatus` snapshots and detects meaningful changes.
- `CopyTradingMonitor` (`src/trading/copy-trading-monitor.ts`): diffs target positions across updates and triggers copy-trading execution.
- `TradeExecutor` (`src/trading/trade-executor.ts`): creates/derives a CLOB API key and submits orders via `@polymarket/clob-client`.

## Prerequisites

- Node.js 18+
- `TARGET_ADDRESS`: the Polymarket user address to monitor (required)
- `PRIVATE_KEY`: a funded wallet private key (required only when `COPY_TRADING_ENABLED=true`)

## Setup

1. Install dependencies
   - `npm install`

2. Create a `.env` file
   - Copy from the template below (this repo does not include a `.env.example` file).

3. Configure values
   - Minimum: `TARGET_ADDRESS` and, when enabled, `PRIVATE_KEY`.

## Configuration (`.env`)

### Required (CLI entrypoint: `npm run dev`)

- `TARGET_ADDRESS`: Polymarket user address to monitor (and copy)
- `COPY_TRADING_ENABLED`: set to `true` to enable automatic copy trading
- `PRIVATE_KEY`: wallet private key used to sign and submit CLOB orders (required only when copy trading is enabled)

### Optional controls

- `DRY_RUN`: set to `true` to simulate trades without posting orders (default: `false`)
- `POLL_INTERVAL`: polling interval in milliseconds (default: `2000`)
- `POSITION_SIZE_MULTIPLIER`: multiplier applied to target position quantity (default: `1.0`)
- `MIN_TRADE_SIZE`: minimum trade notional in USD (default: `1`)
- `MAX_TRADE_SIZE`: maximum trade notional in USD (default: `5000`)
- `MAX_POSITION_SIZE`: maximum scaled position notional in USD (default: `10000`)
- `SLIPPAGE_TOLERANCE`: reserved config; currently **not applied** to the CLOB order pricing (default: `1.0`)

### Notes on optional API settings

This CLI entrypoint (`src/index.ts`) currently constructs `PolymarketClient` with default config, so `POLYMARKET_API_KEY`, `CHAIN_ID`, and `CLOB_HOST` are **not** read from the environment in the CLI.

If you use the library directly (see `examples/`), `PolymarketClient` and `TradeExecutor` support programmatic configuration.

## Quick Start

1. Development mode (loads `.env`)
   - `npm run dev`

2. Examples
   - Basic monitoring: `npm run example:basic`
   - Copy trading: `npm run example:copy-trading`
   - Custom status handler: `npm run example:custom`

### Example `.env`

```bash
TARGET_ADDRESS=0xYourTargetPolymarketAddress
COPY_TRADING_ENABLED=true
PRIVATE_KEY=0xYourWalletPrivateKey

# Safe testing
DRY_RUN=true

# Copy-trading controls
POLL_INTERVAL=2000
POSITION_SIZE_MULTIPLIER=1.0
MIN_TRADE_SIZE=1
MAX_TRADE_SIZE=5000
MAX_POSITION_SIZE=10000
SLIPPAGE_TOLERANCE=1.0
```

## How Copy Trading Works

The bot keeps an in-memory snapshot of the target account’s **open** positions, keyed by `Position.id`.

On each monitor update, `CopyTradingMonitor` compares the current snapshot to the previous one:

- BUY (new position)
  - If a `Position.id` exists in the latest snapshot but not in the previous snapshot, the bot places a BUY order.
  - Duplicate BUYs are prevented using an in-memory `executedPositions` set.

- SELL (position closed)
  - If a previously executed `Position.id` is missing from the latest snapshot, the bot places a SELL order.
  - After a successful SELL, that `Position.id` is removed from `executedPositions`.

Important behavior: quantity changes for existing positions do **not** trigger additional orders. Only position `id` additions/removals drive BUY/SELL.

## Order Execution Details

When `DRY_RUN=false`, orders are submitted as GTC:

- Order type: `OrderType.GTC`
- Order submission: `createAndPostOrder(...)`
- Token: `tokenID = position.id`
- Price: `price = parseFloat(position.price)`
- Size: `size = parseFloat(position.quantity) * POSITION_SIZE_MULTIPLIER`

Before submitting an order, `TradeExecutor` enforces USD constraints:

- Compute trade notional: `tradeValue = tradeQuantity * tradePrice`
  - Must satisfy: `MIN_TRADE_SIZE <= tradeValue <= MAX_TRADE_SIZE`
- Compute scaled position notional: `positionValue = parseFloat(position.value || 0) * POSITION_SIZE_MULTIPLIER`
  - Must satisfy: `positionValue <= MAX_POSITION_SIZE`

Note: while `slippageTolerance` is parsed and passed through config, the submitted order `price` is currently taken directly from the target snapshot.

## Limitations / Operational Notes

- Polling-only: `enableWebSocket` exists in the API, but WebSocket monitoring is not implemented; the current runtime uses polling.
- No persistence: snapshots and execution state (`executedPositions`) are in-memory only; restarts reset history.
- Slippage tolerance: `SLIPPAGE_TOLERANCE` is currently not applied to order pricing.

## Safety

- Do not commit `.env` to version control.
- Start with `DRY_RUN=true` before enabling live execution.
- Ensure your trading wallet has sufficient funds and you understand the risk of mirroring another account’s positions.

## License

MIT
