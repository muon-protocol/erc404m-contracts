import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect, } from "chai";
import { ethers } from "hardhat";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";
import { ERC404m } from "../typechain-types";
import { Signer, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


describe.only("ERC404m", function() {
  const rarityBytes = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";
  const tokenName: String = "Muon ERC404";
  const tokenSymbol: String = "ERC404m";
  const decimals = 18;

  const deployMRC404 = async () => {
    let token = await ethers.deployContract("ERC404m", [""]);
    token = await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    const [admin, wallet1, wallet2, wallet3, spender] = await ethers.getSigners();
    return {
      token,
      tokenAddress,
      admin,
      wallet1,
      wallet2,
      wallet3,
      spender,
    }
  }

  beforeEach( async function() {
    Object.assign(this, await loadFixture(deployMRC404));
  })

  describe("General Info", function() {
    it("Check the name", async function() {
      expect(await this.token.name()).to.equal(tokenName);
    })

    it("Check the symbol", async function() {
      expect(await this.token.symbol()).to.equal(tokenSymbol);
    })

    it("Check the decimals", async function() {
      expect(await this.token.decimals()).to.equal(decimals);
    })
  })

  describe("Mint", function() {
    it("Revert if the sender doesn't have role", async function () {
      await expect(this.token.connect(this.wallet1).
      mint(this.wallet1.getAddress(), ethers.parseEther("20"), rarityBytes))
      .to.revertedWithCustomError(this.token, "AccessControlUnauthorizedAccount");
    })

    it("If receiver is zero address", async function() {
      //TODO: is minting for zero address valid?
      await this.token.mint(ethers.ZeroAddress, ethers.parseEther("20"), rarityBytes);
    })

    it("Reverts if amount overflow", async function() {
      //TODO: MintLimitReached
      await expect(this.token.mint(
        this.wallet1.getAddress(),
        ethers.MaxUint256 - 1n, rarityBytes
      )).to.reverted;
    })

    describe("For non zero address", function() {
      describe("Some complete units", function() {
        const amount = 10;
        const weiAmount = ethers.parseEther(amount.toString())

        beforeEach("Mint some tokens", async function() {
          this.mintTx = await this.token.mint(this.wallet1.getAddress(), weiAmount, rarityBytes);
        })

        it("Erc20Balance should increase", async function() {
          expect(await this.token.erc20BalanceOf(this.wallet1)).to.equal(weiAmount);
        })

        it("ERC721Balance should increase", async function() {
          expect(await this.token.erc721BalanceOf(this.wallet1)).to.equal(amount);
        })

        it("BalanceOf should increase", async function() {
          expect(await this.token.balanceOf(this.wallet1)).to.equal(weiAmount);
        })

        it("Emits ERC20Transfer event", async function() {
          await expect(this.mintTx).to.emit(this.token, "ERC20Transfer")
          .withArgs(ethers.ZeroAddress, this.wallet1, weiAmount);
        })

        it("Emits Transfer event", async function() {
          for (let i = 1; i < amount; i++) {
            await expect(this.mintTx)
            .to.emit(this.token, "Transfer")
            .withArgs(ethers.ZeroAddress, this.wallet1, i)
          }
        })

        it("Emits ERC721Transfer event", async function() {
          for (let i = 1; i < amount; i++) {
            await expect(this.mintTx)
            .to.emit(this.token, "Transfer")
            .withArgs(ethers.ZeroAddress, this.wallet1, i)
          }
        })

        it("Increments totalSupply", async function() {
          expect(await this.token.totalSupply()).to.equal(weiAmount);
        })
      })

      describe("Some incomplete units", function() {
        const amount = 2.9;
        const weiAmount = ethers.parseEther(amount.toString())

        beforeEach("Mint some tokens", async function() {
          this.fractionalMintTx = await this.token.mint(this.wallet1.getAddress(), weiAmount, rarityBytes);
        })

        it("Erc20Balance should increase", async function() {
          expect(await this.token.erc20BalanceOf(this.wallet1)).to.equal(weiAmount);
        })

        it("ERC721Balance should increase", async function() {
          expect(await this.token.erc721BalanceOf(this.wallet1)).to.equal(Math.floor(amount));
        })

        it("BalanceOf should increase", async function() {
          expect(await this.token.balanceOf(this.wallet1)).to.equal(weiAmount);
        })

        it("Emits ERC20Transfer event", async function() {
          await expect(this.fractionalMintTx).to.emit(this.token, "ERC20Transfer")
          .withArgs(ethers.ZeroAddress, this.wallet1, weiAmount);
        })

        it("Emits Transfer event", async function() {
          for (let i = 1; i < Math.floor(amount); i++) {
            await expect(this.fractionalMintTx)
            .to.emit(this.token, "Transfer")
            .withArgs(ethers.ZeroAddress, this.wallet1, i)
          }
        })

        it("Emits ERC721Transfer event", async function() {
          for (let i = 1; i < Math.floor(amount); i++) {
            await expect(this.fractionalMintTx)
            .to.emit(this.token, "Transfer")
            .withArgs(ethers.ZeroAddress, this.wallet1, i)
          }
        })

        it("Increments totalSupply", async function() {
          expect(await this.token.totalSupply()).to.equal(weiAmount);
        })
      })
    })

  })

  describe("Transfer", function() {
    const amount = 30;
    const weiAmount = ethers.parseEther(amount.toString())

    beforeEach("Mint some tokens", async function() {
      await this.token.mint(this.wallet1, weiAmount, rarityBytes);
    })

    it("Sender transfer all balance", async function() {
      const balance = await this.token.balanceOf(this.wallet1);
      await this.token.connect(this.wallet1).transfer(this.wallet2, balance);
    })

    it("Reverts since the sender does not have enough balance", async function() {
      // TODO: Should revert with custom error
      const balance = await this.token.balanceOf(this.wallet1);
      await expect(this.token.connect(this.wallet1).transfer(this.wallet2, balance + 1n))
      .to.revertedWithPanic(PANIC_CODES.ARITHMETIC_OVERFLOW)
    })

    it("Reverts since the receiver is zero-address", async function() {
      await expect(this.token.connect(this.wallet1).transfer(ethers.ZeroAddress, 100))
      .to.revertedWithCustomError(this.token, "InvalidRecipient");
    })


    describe("Non-Fractional", function() {
      // wallet1 is sender and wallet2 is receiver
      const value = 5;
      const valueInWei = ethers.parseEther(value.toString());
      beforeEach("Transfer complete units", async function() {
        this.nonFractionalTx = await this.token.connect(this.wallet1).transfer(this.wallet2, valueInWei);
      })

      it("Check ERC20BalanceOf sender and receiver", async function() {
        expect(await this.token.erc20BalanceOf(this.wallet2)).to.equal(valueInWei);
        expect(await this.token.erc20BalanceOf(this.wallet1)).to.equal(
          weiAmount - valueInWei
        );
      })

      it("Check erc721BalanceOf sender and receiver", async function() {
        expect(await this.token.erc721BalanceOf(this.wallet2)).to.equal(value);
        expect(await this.token.erc721BalanceOf(this.wallet1)).to.equal(amount - value);
      })

      it("Check balanceOf sender and receiver", async function() {
        expect(await this.token.erc20BalanceOf(this.wallet2)).to.equal(valueInWei);
        expect(await this.token.erc20BalanceOf(this.wallet1)).to.equal(
          weiAmount - valueInWei
        );
      })

      it("Emit ERC721Transfer event", async function() {
        for(let i = amount; i > amount - value; i--) {
          await expect(this.nonFractionalTx)
          .to.emit(this.token, "ERC721Transfer")
          .withArgs(this.wallet1, this.wallet2, i);
        }
      })

      it("Emit Transfer event for erc721 tokens", async function() {
        for(let i = amount; i > amount - value; i--) {
          await expect(this.nonFractionalTx)
          .to.emit(this.token, "Transfer")
          .withArgs(this.wallet1, this.wallet2, i);
        }
      })

      it("Emit ERC20Transfer event", async function() {
        await expect(this.nonFractionalTx)
        .to.emit(this.token, "ERC20Transfer")
        .withArgs(this.wallet1, this.wallet2, valueInWei);
      })
    })

    describe("Fractional", function() {
      const value = 4.9;
      const valueInWei = ethers.parseEther(value.toString());
      const nftTransferToReceiver = Math.floor(value);
      const nftTransferToZeroAddress = Math.ceil(value - nftTransferToReceiver);

      beforeEach("Transfer complete units", async function() {
        this.fractionalTx = await this.token.connect(this.wallet1).transfer(this.wallet2, valueInWei);
      })

      it("Check ERC20BalanceOf sender and receiver", async function() {
        expect(await this.token.erc20BalanceOf(this.wallet2)).to.equal(valueInWei);
        expect(await this.token.erc20BalanceOf(this.wallet1)).to.equal(
          weiAmount - valueInWei
        );
      })

      it("Check erc721BalanceOf sender and receiver", async function() {
        expect(await this.token.erc721BalanceOf(this.wallet2)).to.equal(nftTransferToReceiver);
        expect(await this.token.erc721BalanceOf(this.wallet1)).to.equal(amount - Math.ceil(value));
      })

      it("Check balanceOf sender and receiver", async function() {
        expect(await this.token.erc20BalanceOf(this.wallet2)).to.equal(valueInWei);
        expect(await this.token.erc20BalanceOf(this.wallet1)).to.equal(
          weiAmount - valueInWei
        );
      })

      it("Emit ERC721Transfer event", async function() {
        for(let i = amount; i > amount - nftTransferToReceiver; i--) {
          await expect(this.fractionalTx)
          .to.emit(this.token, "ERC721Transfer")
          .withArgs(this.wallet1, this.wallet2, i);
        }
        if (nftTransferToZeroAddress > 0) {
          await expect(this.fractionalTx)
          .to.emit(this.token, "ERC721Transfer")
          .withArgs(this.wallet1, ethers.ZeroAddress, amount - nftTransferToReceiver);
        }
      })

      it("Emit Transfer event for erc721 tokens", async function() {
        for(let i = amount; i > amount - nftTransferToReceiver; i--) {
          await expect(this.fractionalTx)
          .to.emit(this.token, "Transfer")
          .withArgs(this.wallet1, this.wallet2, i);
        }
        if (nftTransferToZeroAddress > 0) {
          await expect(this.fractionalTx)
          .to.emit(this.token, "Transfer")
          .withArgs(this.wallet1, ethers.ZeroAddress, amount - nftTransferToReceiver);
        }
      })

      it("Emit ERC20Transfer event", async function() {
        await expect(this.fractionalTx)
        .to.emit(this.token, "ERC20Transfer")
        .withArgs(this.wallet1, this.wallet2, valueInWei);
      })

    })

    describe("Small amounts", function() {

    })

  })

  describe("Approve", function() {
    const amount = 50;
    const amountInWei = ethers.parseEther(amount.toString());
    const valueOrId = 5;
    const valueOrIdInWei = ethers.parseEther(valueOrId.toString());

    beforeEach("Mint some tokens", async function() {
      await this.token.mint(this.wallet1, amountInWei, rarityBytes);
    })

    // approve ERC721
    describe("When value is a valid token ID", async function() {
      beforeEach("Approve some tokens to satisfy ERC721 approve function", async function() {
        this.erc721ApproveTx = await this.token.connect(this.wallet1)
        .approve(this.spender, valueOrId);
      })

      it("Reverts when the sender is not the owner", async function() {
        await expect(this.token.connect(this.wallet2)
        .approve(this.spender, valueOrId))
        .to.revertedWithCustomError(this.token, "Unauthorized");
      })

      it("Check getApproved", async function() {
        expect(await this.token.getApproved(valueOrId)).to.equal(this.spender);
      })

      it("Revoke the approval when the spender is zero address", async function() {
        await this.token.connect(this.wallet1).approve(ethers.ZeroAddress, valueOrId);
        expect(await this.token.getApproved(valueOrId)).to.equal(ethers.ZeroAddress);
      })

      it("Spender can approve to others when the holder setApproveForAll", async function() {
        await this.token.connect(this.wallet1).setApprovalForAll(this.spender, true);
        await this.token.connect(this.spender).approve(this.wallet2, valueOrId);
        expect(await this.token.getApproved(valueOrId)).to.equal(this.wallet2);
      })

      it("Emit ERC721Approval event", async function() {
        await expect(this.erc721ApproveTx)
        .to.emit(this.token, "ERC721Approval")
        .withArgs(this.wallet1, this.spender, valueOrId);
      })

      it("Allowance doesn't increase", async function() {
        expect(await this.token.allowance(this.wallet1, this.spender)).to.equal(0);
      })

    })

    // approve ERC20
    describe("When value is not a valid token ID", async function() {
      beforeEach("Approve some tokens to satisfy ERC20 approve function", async function() {
        this.erc20ApproveTx = await this.token.connect(this.wallet1)
        .approve(this.spender, valueOrIdInWei);
      })

      it("Reverts when the spender is zero address", async function() {
        await expect(this.token.connect(this.wallet1)
        .approve(ethers.ZeroAddress, valueOrIdInWei))
        .to.revertedWithCustomError(this.token, "InvalidSpender");
      })

      it("Can approve more than the balance", async function() {
        expect(await this.token.balanceOf(this.wallet2)).to.equal(0);

        this.erc20ApproveTx = await this.token.connect(this.wallet2)
        .approve(this.spender, amountInWei);

        expect(await this.token.allowance(this.wallet2, this.spender))
        .to.equal(amountInWei);
      })

      it("Check allowance", async function() {
        expect(await this.token.allowance(this.wallet1, this.spender))
        .to.equal(valueOrIdInWei);
      })

      it("Can decrease allowance", async function() {
        const newVal = ethers.parseEther("1");
        this.erc20ApproveTx = await this.token.connect(this.wallet1)
        .approve(this.spender, newVal);

        expect(await this.token.allowance(this.wallet1, this.spender)).to.equal(newVal);
      })

      it("Emit ERC20Approval event", async function() {
        await expect(this.erc20ApproveTx)
        .to.emit(this.token, "ERC20Approval")
        .withArgs(this.wallet1, this.spender, valueOrIdInWei);
      })

    })
  })

  describe("ApproveForAll", async function(){})

  describe("TransferFrom", async function(){})

  describe("BurnFrom", async function(){})

  describe("ApproveForAll", async function(){})
})