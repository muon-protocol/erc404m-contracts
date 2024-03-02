import { ethers, upgrades } from "hardhat";
import { Wallet } from "ethers";
import { expect } from "chai";
import { ERC404m, MRC404Staking } from "../typechain-types";
import {
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";


describe("MRC404Staking", function () {

  let erc404mToken: ERC404m;
  let mrc404Staking: MRC404Staking;
  let admin: Wallet;
  let rewardRole: Wallet;
  let user1: Wallet;
  let user2: Wallet;
  let oneDay: Number;


  const distributeRewards = async (rewardAmount) => {
    await mrc404Staking.connect(rewardRole).distributeRewards(rewardAmount);
  };

  before("Deploy contracts", async () => {
    [admin, user1, user2, rewardRole] = await (ethers as any).getSigners();
    const rarityBytes = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";
    erc404mToken = await ethers.deployContract("ERC404m", [""]);
    await erc404mToken.connect(admin).mint(user1, ethers.parseEther("50"), rarityBytes);
    await erc404mToken.connect(admin).mint(user2, ethers.parseEther("50"), rarityBytes);
    expect(await erc404mToken.balanceOf(user1)).to.be.equal(ethers.parseEther("50"));
    expect(await erc404mToken.balanceOf(user2)).to.be.equal(ethers.parseEther("50"));

    const staking = await ethers.getContractFactory("MRC404Staking");
    mrc404Staking = await upgrades.deployProxy(staking, [erc404mToken.target, erc404mToken.target]);
    await mrc404Staking.waitForDeployment();


    await erc404mToken.setWhitelist(mrc404Staking, true);
    await erc404mToken.connect(admin).mint(mrc404Staking, ethers.parseEther("1000"), rarityBytes);
    await mrc404Staking.connect(admin).grantRole(await mrc404Staking.REWARD_ROLE(), rewardRole.address);
    oneDay = 60 * 60 * 24;
  });

  describe("Staking", async () => {

    it("User1 stake 3 tokens", async () => {
      await erc404mToken.connect(user1).approve(mrc404Staking, ethers.parseEther("3"));
      await expect(mrc404Staking.connect(user1).stake(ethers.parseEther("3")))
      .to.emit(mrc404Staking, "Staked").withArgs(user1.address, ethers.parseEther("3"))
      .to.emit(erc404mToken, "ERC20Transfer").withArgs(user1.address, mrc404Staking.getAddress(), ethers.parseEther("3"))
      .to.emit(erc404mToken, "ERC721Transfer").withArgs(user1.address, ethers.ZeroAddress, 50);

      expect(await mrc404Staking.totalStaked()).to.be.equal(ethers.parseEther("3"));
      const userInfo = await mrc404Staking.users(user1.address)
      expect(userInfo.balance).to.be.equal(ethers.parseEther("3")); // balance
      expect(userInfo.paidReward).to.be.equal(0); // paidReward
      expect(userInfo.paidRewardPerToken).to.be.equal(0); // paidRewardPerToken
      expect(userInfo.pendingRewards).to.be.equal(0); // pendingRewards
    });

    it("User2 stake 5 tokens", async () => {
      await erc404mToken.connect(user2).approve(mrc404Staking, ethers.parseEther("6"));
      await expect(mrc404Staking.connect(user2).stake(ethers.parseEther("6")))
      .to.emit(mrc404Staking, "Staked").withArgs(user2.address, ethers.parseEther("6"))

      expect(await mrc404Staking.totalStaked()).to.be.equal(ethers.parseEther("9"));
      const userInfo = await mrc404Staking.users(user2.address)
      expect(userInfo.balance).to.be.equal(ethers.parseEther("6")); // balance
      expect(userInfo.paidReward).to.be.equal(0); // paidReward
      expect(userInfo.paidRewardPerToken).to.be.equal(0); // paidRewardPerToken
      expect(userInfo.pendingRewards).to.be.equal(0); // pendingRewards
    });

    it("Admin distribute rewards", async () => {
      const tenDays = BigInt(10 * oneDay);
      const units = BigInt(10 ** 18)
      const totalStaked = await mrc404Staking.totalStaked();
      const initialReward = tenDays * totalStaked / units;
      await distributeRewards(initialReward);
      const rewardPeriod = await mrc404Staking.rewardPeriod();
      expect(rewardPeriod).to.be.equal(tenDays);
      const expectedRewardRate = initialReward / rewardPeriod;
      const rewardRate = await mrc404Staking.rewardRate();
      expect(expectedRewardRate).to.be.equal(rewardRate);
      await time.increase(tenDays);

      const rewardPerToken = await mrc404Staking.rewardPerToken();
      const expectedRewardPerToken = parseInt(
        ((tenDays * rewardRate * units) / totalStaked).toString()
      );
      expect(rewardPerToken).to.be.equal(expectedRewardPerToken);

      let user1Reward = await mrc404Staking.earned(user1.address);
      let user2Reward = await mrc404Staking.earned(user2.address);

      expect(user1Reward + user2Reward).to.be.equal(initialReward);

      const user1ExpectedReward = initialReward / BigInt(3);
      const user1ActualReward = await mrc404Staking.earned(user1.address);
      expect(user1ActualReward).to.be.equal(user1ExpectedReward);

      const user2ExpectedReward = initialReward * BigInt(2) / BigInt(3);
      const user2ActualReward = await mrc404Staking.earned(user2.address);
      expect(user2ActualReward).to.be.equal(user2ExpectedReward);
    })

  })

  describe("Get Reward", async () => {

    it("User1 can get rewards after rewardPeriod", async () => {
      const user1Reward = await mrc404Staking.earned(user1);
      const rewardPerToken = await mrc404Staking.rewardPerToken();
      await (expect(mrc404Staking.connect(user1).getReward()))
      .to.emit(mrc404Staking, "RewardGot").withArgs(user1, user1Reward);
      const userInfo = await mrc404Staking.users(user1.address)
      expect(userInfo.balance).to.be.equal(ethers.parseEther("3"));
      expect(userInfo.paidReward).to.be.equal(user1Reward);
      expect(userInfo.paidRewardPerToken).to.be.equal(rewardPerToken);
      expect(userInfo.pendingRewards).to.be.equal(0);
      expect(await mrc404Staking.earned(user1)).to.be.equal(0);
    })


    it("User2 can get rewards after rewardPeriod + 2 days", async () => {
      await time.increase(2 * oneDay);
      const user2Reward = await mrc404Staking.earned(user2);
      const rewardPerToken = await mrc404Staking.rewardPerToken();
      await (expect(mrc404Staking.connect(user2).getReward()))
      .to.emit(mrc404Staking, "RewardGot").withArgs(user2, user2Reward);
      const userInfo = await mrc404Staking.users(user2.address)
      expect(userInfo.balance).to.be.equal(ethers.parseEther("6"));
      expect(userInfo.paidReward).to.be.equal(user2Reward);
      expect(userInfo.paidRewardPerToken).to.be.equal(rewardPerToken);
      expect(userInfo.pendingRewards).to.be.equal(0);
      expect(await mrc404Staking.earned(user2)).to.be.equal(0);
    })

    it("Should prevent user1 getReward", async () => {
      const user1Reward = await mrc404Staking.earned(user1);
      expect(user1Reward).to.be.equal(0);
      await (expect(mrc404Staking.connect(user1).getReward()))
      .revertedWith("Invalid reward amount");
    })

  })

});