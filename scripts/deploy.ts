import { ethers, run } from "hardhat"


function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  var params = [
    "https://erc404-metadata.muon.net/"
  ];
  const contract = await ethers.deployContract("ERC404m", params);

  await contract.deployed();

  console.log(`contract deployed to ${contract.address}`);
  
  await sleep(20000);

  await run("verify:verify", {
    address: contract.address,
    constructorArguments: params,
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
