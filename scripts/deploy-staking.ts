import { ethers, upgrades } from "hardhat";

async function main() {
  const Factory = await ethers.getContractFactory("MRC404Staking");
  const contract = await upgrades.deployProxy(Factory, [
    "0x695FbD46c3d3Fef0F06790EbD7a705f2A5088669",
  ]);
  await contract.waitForDeployment();
  console.log("Contract deployed to:", await contract.getAddress());

  // const contract = await upgrades.upgradeProxy("0xAb4b932543EF6c5eB241c40f101E68B1E2475319", Factory);
  console.log("contract upgraded");
}

// async function main() {

//   const factory = await ethers.getContractFactory("SchnorrSECP256K1Verifier");

//   const contract = await factory.deploy();

//   await contract.deployed();

//   console.log("Contract deployed to:", contract.address);
// }


main().catch((error) => {
  console.error(error);
  process.exit(1);
});