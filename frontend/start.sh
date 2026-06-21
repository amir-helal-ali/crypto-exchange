#!/bin/bash
# Start the NEXUS Exchange frontend in production mode
cd /home/z/my-project/crypto-exchange/frontend
PORT=3001 exec node build/index.js
