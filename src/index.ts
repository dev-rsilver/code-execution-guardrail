import "../containerCheck.js"

async function main() {
  console.log("\u2705 Application started.");

}

(await main().catch((err) => {
  console.error(err);
  process.exit(1);
}));
