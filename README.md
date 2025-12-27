To install dependencies:
```sh
bun install
```

## Configuration

### OpenAI API Key (Optional)

To enable AI analysis features for treatments, set the `OPENAI_API_KEY` environment variable:

```sh
export OPENAI_API_KEY="your-api-key-here"
```

Or create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your-api-key-here
```

**Note:** If the API key is not set or is invalid, the AI analysis feature will be disabled and will return appropriate error messages. The rest of the application will continue to function normally.

To run:
```sh
bun run dev
```

open http://localhost:3000
# senob-backend
