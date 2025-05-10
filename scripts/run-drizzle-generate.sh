#!/bin/bash

echo "--- Attempting to run npx drizzle-kit generate via script ---"

npx drizzle-kit generate

EXIT_CODE=$?
echo "--- Script finished with exit code: $EXIT_CODE ---"

exit $EXIT_CODE 