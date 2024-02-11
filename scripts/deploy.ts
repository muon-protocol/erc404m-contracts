import { ethers } from "hardhat"

async function main() {
  var params = [
    "https://erc404-metadata.muon.net/"
  ];
  const contract = await ethers.deployContract("ERC404m", params)

  await contract.deployed()

  console.log(`contract deployed to ${contract.address}`)

  const booster = await ethers.deployContract("ERC404m", params);
  await booster.deployed();
  console.log("muonNodeManager deployed to:", booster.address);
  await hre.run("verify:verify", {
    address: booster.address,
    contract: "contracts/examples/ERC404m.sol:ERC404m",
    constructorArguments: params,
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
