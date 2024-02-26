import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect, } from "chai";
import { ethers } from "hardhat";
import { MRC20Bridge, ERC404m, IMuonClient } from "../typechain-types";
import { Signer, ContractReceipt } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import axios from "axios";


describe("MRC20Bridge", async () => {
  const rarityBytes = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";
  let adminWallet: Signer;
  let wallet1: Signer;
  let wallet2: Signer;
  let wallet3: Signer;
  let wallet4: Signer;
  let wallet5: Signer;
  let erc404Token: ERC404m;
  let mrc20Bridge: MRC20Bridge;
  // let rarityToken1: String;
  let appId: String = "14133107918753457905122726879005594497699931608290848063847062588349373557837";
  let muonPublicKey: IMuonClient.PublicKeyStruct = {
    x: "0x4fad372492f60aaa060ed514c65c0638e9555aaf08b92a2e3dad72b45d172889",
    parity: "0"
  }

  const deployERC404 = async () => {
    const token = await ethers.deployContract("ERC404m", [""]);
    return token;
  }

  const deployMrc20Bridge = async () => {
    const bridge = await ethers.deployContract("MRC20Bridge", [appId, muonPublicKey, wallet1]);
    return bridge;
  }

  before(async () => {
    [
      adminWallet,
      wallet1,
      wallet2,
      wallet3,
      wallet4,
      wallet5,
    ] = await ethers.getSigners();
    erc404Token = await loadFixture(deployERC404);
    mrc20Bridge = await loadFixture(deployMrc20Bridge);
    // rarityToken1 = await erc404Token["encodeData(uint256[])"]([1])
  })


  it("Should mint 5 tokens to wallet1", async () => {
    await erc404Token.connect(adminWallet).mint(wallet1.getAddress(), ethers.parseEther("5"), rarityBytes);
  })

  it("Should grant TOKEN_ADDER_ROLE to admin wallet", async () => {
    const tokenAdderRole = await mrc20Bridge.TOKEN_ADDER_ROLE();
    await mrc20Bridge.connect(adminWallet).grantRole(tokenAdderRole, adminWallet.getAddress());
    expect(await mrc20Bridge.hasRole(tokenAdderRole, adminWallet.getAddress())).to.be.equal(true);
  })

  it("Should add tokenId:1", async () => {
    await (expect(mrc20Bridge.connect(adminWallet).addToken(1, erc404Token.getAddress())))
    .to.emit(mrc20Bridge, "AddToken")
  })

  it("Should wallet1 approve tokenId:1 to bridge", async () => {
    await erc404Token.connect(wallet1).approve(mrc20Bridge.getAddress(), ethers.parseEther("1"))
  })

  it("Should deposit tokenId:1", async () => {
    await (expect(mrc20Bridge.connect(wallet1).deposit(ethers.parseEther("1"), 2, 1)))
    .to.emit(mrc20Bridge, "Deposit").withArgs(1);
  })

  it("Check txId", async () => {
    const tx = await mrc20Bridge.getTx(1)
    expect(tx[0]).to.be.equal(1)
    expect(tx[1]).to.be.equal(1)
    expect(tx[2]).to.be.equal(ethers.parseEther("1"))
    expect(tx[3]).to.be.equal(31337n) //fromChain
    expect(tx[4]).to.be.equal(2) //toChain
    expect(tx[5]).to.be.equal(wallet1.address)
    // expect(tx[6]).to.be.equal(await erc404Token["encodeData(uint256[])"]([1]))
  })

  it("Check pending tx", async () => {
    const claimed = await mrc20Bridge.claimedTxs(31337, 1);
    const pending = await mrc20Bridge.pendingTxs(31337, [1]);
    expect(claimed).to.be.equal(false);
    expect(pending[0]).to.be.equal(false);
  })

})
