/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function readDeployment(network, name) {
  const filePath = path.join(__dirname, "..", "deployments", network, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing deployment file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.address || !parsed.abi) {
    throw new Error(`Invalid deployment JSON (missing address/abi): ${filePath}`);
  }
  return { address: parsed.address, abi: parsed.abi };
}

function main() {
  const network = process.argv[2] || "sepolia";
  const usdc = readDeployment(network, "ERC7984USDC");
  const zama = readDeployment(network, "ERC7984Zama");
  const swap = readDeployment(network, "FHESwap");

  const outPath = path.join(__dirname, "..", "app", "src", "config", "contracts.ts");
  const contents = `// Auto-generated from deployments/${network}. Do not edit manually.\n` +
    `export const FUSDC_ADDRESS = '${usdc.address}' as const;\n` +
    `export const FZAMA_ADDRESS = '${zama.address}' as const;\n` +
    `export const SWAP_ADDRESS = '${swap.address}' as const;\n\n` +
    `export const FUSDC_ABI = ${JSON.stringify(usdc.abi, null, 2)} as const;\n\n` +
    `export const FZAMA_ABI = ${JSON.stringify(zama.abi, null, 2)} as const;\n\n` +
    `export const SWAP_ABI = ${JSON.stringify(swap.abi, null, 2)} as const;\n`;

  fs.writeFileSync(outPath, contents, "utf8");
  console.log(`Wrote ${outPath}`);
}

main();

