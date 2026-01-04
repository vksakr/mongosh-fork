# BrowserSH Demo

Minimal React + TypeScript demo that runs the mongosh Browser REPL UI entirely in the browser.
Input is provided through the Shell component, while evaluation results are rendered as plain text.

## Development

```bash
npm install
npm run dev --workspace @mongosh/browsersh-demo
```

## Build

```bash
npm run build --workspace @mongosh/browsersh-demo
```

The build output in `dist/` is static and can be served by any static web server.
