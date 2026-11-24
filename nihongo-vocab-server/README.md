# Nihongo Vocab Server

## Overview
The Nihongo Vocab Server is a Node.js application that provides an API for retrieving Japanese vocabulary data. The server processes raw vocabulary data and serves it in a normalized format.

## Project Structure
```
nihongo-vocab-server
├── src
│   ├── app.js                # Initializes the Express application and sets up middleware
│   ├── server.js             # Entry point for starting the server
│   ├── config
│   │   └── index.js          # Configuration settings for the application
│   ├── data
│   │   ├── raw
│   │   │   └── data.js       # Raw vocabulary data in JavaScript format
│   │   └── normalized
│   │       └── vocabulary.json # Normalized vocabulary data in JSON format
│   ├── scripts
│   │   └── convert-vocab.js   # Script to convert raw vocabulary data
│   ├── controllers
│   │   └── vocab.controller.js # Handles API requests related to vocabulary
│   ├── routes
│   │   └── vocab.routes.js     # Sets up routes for vocabulary-related API endpoints
│   ├── services
│   │   └── vocab.service.js     # Business logic for managing vocabulary data
│   └── utils
│       └── id-generator.js      # Utility function for generating unique IDs
├── package.json                # npm configuration file
├── .env.example                # Example of environment variables
└── README.md                   # Project documentation
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd nihongo-vocab-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` and update the values as needed.
   - Set `OPENAI_API_KEY` to enable natural AI conversation. The key stays on the server and must never be added to frontend code.
   - Optionally set `OPENAI_MODEL` (defaults to `gpt-4o-mini`).

4. Convert raw vocabulary data:
   ```
   node src/scripts/convert-vocab.js
   ```

5. Start the server:
   ```
   node src/server.js
   ```
6. Open `http://localhost:3000` to use the app and its same-origin conversation API. Use Node.js 18 or newer.

## API Endpoints
- **GET /api/vocab**: Retrieve the list of vocabulary entries.
- **POST /api/conversation/reply**: Generate a Japanese conversation response. Requires `OPENAI_API_KEY`.

## Usage
Once the server is running, you can access the API at `http://localhost:<port>/api/vocab` to retrieve the vocabulary data.

The microphone feature uses the browser Web Speech API and requires a supported browser (such as Chrome or Edge) on HTTPS or localhost. If the AI endpoint is not configured or unavailable, the frontend continues with a small built-in set of basic replies.

## License
This project is licensed under the MIT License.