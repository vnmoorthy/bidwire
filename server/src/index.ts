import "./env.js";
import { config } from "./env.js";
import { ensureSeeded } from "./catalog.js";
import { resumeOpenAuctions } from "./exchange.js";
import { startBots } from "./bots.js";
import { initMessaging, messagingProvider } from "./messaging.js";
import { server } from "./mcp.js";
import { mountHttp } from "./http.js";

ensureSeeded();
startBots();
resumeOpenAuctions();
mountHttp(server);
await initMessaging();

const { url } = await server.listen(config.port, { host: "0.0.0.0" } as any);
console.log(`\n  Bidwire is live`);
console.log(`  Exchange UI : ${config.publicUrl}/`);
console.log(`  MCP endpoint: ${url}  (public: ${config.publicUrl}/mcp)`);
console.log(`  Messaging   : ${messagingProvider()}   Payments: built-in ledger\n`);
