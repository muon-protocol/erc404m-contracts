import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers } from "hardhat"

describe("ERC404", function () {
  async function fixture() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("Example")
    const contract = await factory.deploy(signers[0].address)
    await contract.waitForDeployment()

    return { contract, signers }
  }

  describe("Demonstrating initial mint setup", function () {
    it("Works if you set the whitelist addresses properly", async function () {
      const f = await loadFixture(fixture)
      const owner = await f.contract.owner()

      expect(owner).to.equal(f.signers[0].address)
      expect(await f.contract.minted()).to.equal(0n)
      expect(await f.contract.balanceOf(owner)).to.equal(10_000n * 10n ** 18n)

      await f.contract
        .connect(f.signers[0])
        .setWhitelist(f.signers[0].address, true)

      await f.contract
        .connect(f.signers[0])
        .setWhitelist(f.signers[1].address, true)

      await f.contract
        .connect(f.signers[0])
        .transfer(f.signers[1].address, 100_000)
    })
  })
})
