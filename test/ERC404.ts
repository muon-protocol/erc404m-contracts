import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers } from "hardhat"

describe("ERC404", function () {
  async function deploy() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("ExampleERC404")

    const name = "Example"
    const symbol = "EXM"
    const decimals = 18n
    const units = 10n ** decimals
    const maxTotalSupplyERC721 = 100n
    const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
    const initialOwner = signers[0].address
    const initialMintRecipient = signers[0].address

    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      maxTotalSupplyERC721,
      initialOwner,
      initialMintRecipient,
    )
    await contract.waitForDeployment()

    // Generate 10 random addresses for experiments.
    const randomAddresses = Array.from(
      { length: 10 },
      () => ethers.Wallet.createRandom().address,
    )

    return {
      contract,
      signers,
      deployConfig: {
        name,
        symbol,
        decimals,
        units,
        maxTotalSupplyERC721,
        maxTotalSupplyERC20,
        initialOwner,
        initialMintRecipient,
      },
      randomAddresses,
    }
  }

  async function deployWithTokensInSecondSigner() {
    const f = await loadFixture(deploy)
    const from = f.signers[1]
    const to = f.signers[2]

    // Start off with 100 full tokens.
    const initialExperimentBalanceERC721 = 100n
    const initialExperimentBalanceERC20 =
      initialExperimentBalanceERC721 * f.deployConfig.units

    const balancesBeforeSigner0 = await getBalances(
      f.contract,
      f.signers[0].address,
    )
    const balancesBeforeSigner1 = await getBalances(
      f.contract,
      f.signers[1].address,
    )

    // console.log("balancesBeforeSigner0", balancesBeforeSigner0)
    // console.log("balancesBeforeSigner1", balancesBeforeSigner1)

    // Add the owner to the whitelist
    await f.contract
      .connect(f.signers[0])
      .setWhitelist(f.signers[0].address, true)

    // Transfer all tokens from the owner to 'from', who is the initial sender for the tests.
    await f.contract
      .connect(f.signers[0])
      .transfer(from.address, initialExperimentBalanceERC20)

    return {
      ...f,
      initialExperimentBalanceERC20,
      initialExperimentBalanceERC721,
      from,
      to,
    }
  }

  async function getBalances(contract: any, address: string) {
    return {
      erc20: await contract.erc20BalanceOf(address),
      erc721: await contract.erc721BalanceOf(address),
    }
  }

  describe("#constructor", function () {
    it("Initializes the contract with the expected values", async function () {
      const f = await loadFixture(deploy)

      expect(await f.contract.name()).to.equal(f.deployConfig.name)
      expect(await f.contract.symbol()).to.equal(f.deployConfig.symbol)
      expect(await f.contract.decimals()).to.equal(f.deployConfig.decimals)
      expect(await f.contract.maxTotalSupplyERC721()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )
      expect(await f.contract.owner()).to.equal(f.deployConfig.initialOwner)
      expect(await f.contract.maxTotalSupplyERC20()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
    })

    it("Mints the initial supply of tokens to the initial mint recipient", async function () {
      const f = await loadFixture(deploy)

      // Expect full supply of ERC20 tokens to be minted to the initial recipient.
      expect(
        await f.contract.erc20BalanceOf(f.deployConfig.initialMintRecipient),
      ).to.equal(f.deployConfig.maxTotalSupplyERC20)
      // Expect 0 ERC721 tokens to be minted to the initial recipient, since 1) the user is on the whitelist and 2) the supply is minted using _mintERC20 with mintCorrespondingERC721s_ set to false.
      expect(
        await f.contract.erc721BalanceOf(f.deployConfig.initialMintRecipient),
      ).to.equal(0n)

      // NFT minted count should be 0.
      expect(await f.contract.minted()).to.equal(0n)

      // Total supply of ERC20s tokens should be equal to the initial mint recipient's balance.
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
    })

    it("Initializes the whitelist with the initial mint recipient", async function () {
      const f = await loadFixture(deploy)

      expect(
        await f.contract.whitelist(f.deployConfig.initialMintRecipient),
      ).to.equal(true)
    })
  })

  describe("ERC20 token transfer logic for triggering ERC721 transfers", function () {
    context(
      "Fractional transfers (moving less than 1 full token) that trigger ERC721 transfers",
      async function () {
        it("Handles the case of the receiver gaining a whole new token", async function () {
          const f = await loadFixture(deployWithTokensInSecondSigner)

          // Receiver starts out with 0.9 tokens
          const startingBalanceOfReceiver = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, startingBalanceOfReceiver)

          // Initial balances
          const fromBalancesBefore = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesBefore = await getBalances(f.contract, f.to.address)

          // console.log("fromBalancesBefore", fromBalancesBefore)
          // console.log("toBalancesBefore", toBalancesBefore)

          // Ensure that the receiver has 0.9 tokens and 0 NFTs.
          expect(toBalancesBefore.erc20).to.equal(startingBalanceOfReceiver)
          expect(toBalancesBefore.erc721).to.equal(0n)

          // Transfer an amount that results in the receiver gaining a whole new token (0.9 + 0.1)
          const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, fractionalValueToTransferERC20)

          // Post-transfer balances
          const fromBalancesAfter = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesAfter = await getBalances(f.contract, f.to.address)

          // console.log("fromBalancesAfter", fromBalancesAfter)
          // console.log("toBalancesAfter", toBalancesAfter)

          // Verify ERC20 balances after transfer
          expect(fromBalancesAfter.erc20).to.equal(
            fromBalancesBefore.erc20 - fractionalValueToTransferERC20,
          )
          expect(toBalancesAfter.erc20).to.equal(
            toBalancesBefore.erc20 + fractionalValueToTransferERC20,
          )

          // Verify ERC721 balances after transfer
          // Assuming the receiver should have gained 1 NFT due to the transfer completing a whole token
          expect(fromBalancesAfter.erc721).to.equal(fromBalancesBefore.erc721) // No change for the sender
          expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721 + 1n)
        })

        it("Handles the case of the sender losing a partial token, dropping it below a full token", async function () {
          const f = await loadFixture(deployWithTokensInSecondSigner)

          // Initial balances
          const fromBalancesBefore = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesBefore = await getBalances(f.contract, f.to.address)

          expect(fromBalancesBefore.erc20 / f.deployConfig.units).to.equal(100n)

          // Sender starts with 100 tokens and sends 0.1, resulting in the loss of 1 NFT but no NFT transfer to the receiver.
          const initialFractionalAmount = f.deployConfig.units / 10n // 0.1 token in sub-units
          const transferAmount = initialFractionalAmount * 1n // 0.1 tokens, ensuring a loss of a whole token after transfer

          // Perform the transfer
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, transferAmount)

          // Post-transfer balances
          const fromBalancesAfter = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesAfter = await getBalances(f.contract, f.to.address)

          // Verify ERC20 balances after transfer
          expect(fromBalancesAfter.erc20).to.equal(
            fromBalancesBefore.erc20 - transferAmount,
          )
          expect(toBalancesAfter.erc20).to.equal(
            toBalancesBefore.erc20 + transferAmount,
          )

          // Verify ERC721 balances after transfer
          // Assuming the sender should lose 1 NFT due to the transfer causing a loss of a whole token.
          // Sender loses an NFT
          expect(fromBalancesAfter.erc721).to.equal(
            fromBalancesBefore.erc721 - 1n,
          )
          // No NFT gain for the receiver
          expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721)
          // Contract gains an NFT (it's stored in the contract in this scenario).
          // TODO - Verify this with the contract's balance.
        })
      },
    )

    context("Moving one or more full tokens", async function () {
      it("Transfers whole tokens without fractional impact correctly", async function () {
        const f = await loadFixture(deployWithTokensInSecondSigner)

        // Initial balances
        const fromBalancesBefore = await getBalances(f.contract, f.from.address)
        const toBalancesBefore = await getBalances(f.contract, f.to.address)

        // Expect initial balances to match setup
        expect(fromBalancesBefore.erc20).to.equal(
          f.initialExperimentBalanceERC20,
        )
        expect(fromBalancesBefore.erc721).to.equal(
          f.initialExperimentBalanceERC721,
        )
        expect(toBalancesBefore.erc20).to.equal(0n)
        expect(toBalancesBefore.erc721).to.equal(0n)

        // Transfer 2 whole tokens
        const erc721TokensToTransfer = 2n
        const valueToTransferERC20 =
          erc721TokensToTransfer * f.deployConfig.units
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, valueToTransferERC20)

        // Post-transfer balances
        const fromBalancesAfter = await getBalances(f.contract, f.from.address)
        const toBalancesAfter = await getBalances(f.contract, f.to.address)

        // Verify ERC20 balances after transfer
        expect(fromBalancesAfter.erc20).to.equal(
          fromBalancesBefore.erc20 - valueToTransferERC20,
        )
        expect(toBalancesAfter.erc20).to.equal(
          toBalancesBefore.erc20 + valueToTransferERC20,
        )

        // Verify ERC721 balances after transfer - Assuming 2 NFTs should have been transferred
        expect(fromBalancesAfter.erc721).to.equal(
          fromBalancesBefore.erc721 - erc721TokensToTransfer,
        )
        expect(toBalancesAfter.erc721).to.equal(
          toBalancesBefore.erc721 + erc721TokensToTransfer,
        )
      })

      it("Handles the case of sending 3.2 tokens where the sender started out with 99.1 tokens and the receiver started with 0.9 tokens", async function () {
        // This test demonstrates all 3 cases in one scenario:
        // - The sender loses a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        // - The receiver gains a whole new token (0.9 + 3.2 (3 whole, 0.2 fractional) = 4.1)
        // - The sender transfers 3 whole tokens to the receiver (99.1 - 3.2 (3 whole, 0.2 fractional) = 95.9)

        const f = await loadFixture(deployWithTokensInSecondSigner)

        // Receiver starts out with 0.9 tokens
        const startingBalanceOfReceiver = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, startingBalanceOfReceiver)

        // Initial balances
        const fromBalancesBefore = await getBalances(f.contract, f.from.address)
        const toBalancesBefore = await getBalances(f.contract, f.to.address)

        // console.log("fromBalancesBefore", fromBalancesBefore)
        // console.log("toBalancesBefore", toBalancesBefore)

        // Ensure that the receiver has 0.9 tokens and 0 NFTs.
        expect(toBalancesBefore.erc20).to.equal(startingBalanceOfReceiver)
        expect(toBalancesBefore.erc721).to.equal(0n)

        // Transfer an amount that results in:
        // - the receiver gaining a whole new token (0.9 + 0.2 + 3)
        // - the sender losing a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        const fractionalValueToTransferERC20 =
          (f.deployConfig.units / 10n) * 32n // 3.2 tokens
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, fractionalValueToTransferERC20)

        // Post-transfer balances
        const fromBalancesAfter = await getBalances(f.contract, f.from.address)
        const toBalancesAfter = await getBalances(f.contract, f.to.address)

        // console.log("fromBalancesAfter", fromBalancesAfter)
        // console.log("toBalancesAfter", toBalancesAfter)

        // Verify ERC20 balances after transfer
        expect(fromBalancesAfter.erc20).to.equal(
          fromBalancesBefore.erc20 - fractionalValueToTransferERC20,
        )
        expect(toBalancesAfter.erc20).to.equal(
          toBalancesBefore.erc20 + fractionalValueToTransferERC20,
        )

        // Verify ERC721 balances after transfer
        // The receiver should have gained 3 NFTs from the transfer and 1 NFT due to the transfer completing a whole token for a total of +4 NFTs.
        expect(fromBalancesAfter.erc721).to.equal(
          fromBalancesBefore.erc721 - 4n,
        )
        expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721 + 4n)
      })
    })
  })
})
