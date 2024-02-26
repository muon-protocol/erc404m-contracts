// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IMRC404.sol";

contract MRC404Staking is Initializable, AccessControlUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  struct User {
    uint256 balance;
    uint256 paidReward;
    uint256 paidRewardPerToken;
    uint256 pendingRewards;
  }

  bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
  bytes32 public constant REWARD_ROLE = keccak256("REWARD_ROLE");

  uint256 public totalStaked;

  uint256 public minStakeAmount;

  uint256 public periodFinish;

  uint256 public rewardRate;

  uint256 public lastUpdateTime;

  uint256 public rewardPerTokenStored;

  mapping(address => User) public users;

  IERC20Upgradeable public rewardToken;
  IERC20Upgradeable public stakedToken;

  // stakerAddress => bool
  mapping(address => bool) public lockedStakes;

  // function name => paused
  mapping(string => bool) public functionPauseStatus;

  uint256 public rewardPeriod;

  // ======== Events ========
  event Staked(address indexed stakerAddress, uint256 amount);
  event Withdrawn(address indexed stakerAddress);
  event RewardGot(address indexed stakerAddress, uint256 amount);
  event RewardsDistributed(
    uint256 reward,
    uint256 indexed periodStart,
    uint256 _rewardPeriod
  );
  event MinStakeAmountUpdated(uint256 minStakeAmount);
  event StakeLockStatusChanged(address indexed stakerAddress, bool locked);
  event FunctionPauseStatusChanged(string indexed functionName, bool isPaused);

  // ======== Modifiers ========
  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenFunctionNotPaused(string memory functionName) {
    require(!functionPauseStatus[functionName], "Function is paused.");
    _;
  }

  /**
   * @dev Modifier that updates the reward parameters
   * before all of the functions that can change the rewards.
   *
   * `stakerAddress` should be address(0) when new rewards are distributing.
   */
  modifier updateReward(address stakerAddress) {
    rewardPerTokenStored = rewardPerToken();
    lastUpdateTime = lastTimeRewardApplicable();
    if (stakerAddress != address(0)) {
      users[stakerAddress].pendingRewards = earned(stakerAddress);
      users[stakerAddress].paidRewardPerToken = rewardPerTokenStored;
    }
    _;
  }

  /**
   * @dev Initializes the contract.
   * @param _rewardTokenAddress The address of the reward token.
   */
  function initialize(
    address _rewardTokenAddress,
    address _stakedToken
  ) external initializer {
    __MuonNodeStakingUpgradeable_init(_rewardTokenAddress, _stakedToken);
  }

  function __MuonNodeStakingUpgradeable_init(
    address _rewardTokenAddress,
    address _stakedToken
  ) internal initializer {
    __AccessControl_init();

    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(DAO_ROLE, msg.sender);

    rewardToken = IERC20Upgradeable(_rewardTokenAddress);
    stakedToken = IERC20Upgradeable(_stakedToken);

    minStakeAmount = 0;

    rewardPeriod = 10 days;
  }

  function __MuonNodeStakingUpgradeable_init_unchained() internal initializer {}

  /**
   * @dev Locks the specified tokens.
   * The staker must first approve the contract to transfer the tokens on their behalf.
   * Only the staker can call this function.
   * @param amount amount of tokens
   */
  function stake(
    uint256 amount
  ) external updateReward(msg.sender) whenFunctionNotPaused("stake") {
    uint256 balance = IERC20Upgradeable(stakedToken).balanceOf(address(this));

    IERC20Upgradeable(stakedToken).safeTransferFrom(
      msg.sender,
      address(this),
      amount
    );

    uint256 receivedAmount = IERC20Upgradeable(stakedToken).balanceOf(
      address(this)
    ) - balance;
    require(
      amount == receivedAmount,
      "The discrepancy between the received amount and the claimed amount."
    );

    users[msg.sender].balance += amount;
    totalStaked += amount;

    emit Staked(msg.sender, amount);
  }

  /**
   * @dev Allows the stakers to withdraw their rewards.
   */
  function getReward() external whenFunctionNotPaused("getReward") {
    uint256 amount = earned(msg.sender);

    require(amount > 0, "Invalid reward amount");

    users[msg.sender].pendingRewards = 0;
    users[msg.sender].paidReward += amount;
    users[msg.sender].paidRewardPerToken = rewardPerToken();

    rewardToken.safeTransfer(msg.sender, amount);

    emit RewardGot(msg.sender, amount);
  }

  /**
   * @dev Allows stakers to withdraw their staked amount after exit pending period has passed.
   */
  function withdraw()
    external
    updateReward(msg.sender)
    whenFunctionNotPaused("withdraw")
  {
    require(!lockedStakes[msg.sender], "Stake is locked.");

    uint256 amount = users[msg.sender].balance;

    if (amount > 0) {
      totalStaked -= amount;
      users[msg.sender].balance = 0;
      IERC20Upgradeable(stakedToken).transfer(msg.sender, amount);
    }

    emit Withdrawn(msg.sender);
  }

  /**
   * @dev Distributes the specified reward amount to the stakers.
   * Only callable by the REWARD_ROLE.
   * @param reward The reward amount to be distributed.
   */
  function distributeRewards(
    uint256 reward
  ) external updateReward(address(0)) onlyRole(REWARD_ROLE) {
    if (block.timestamp >= periodFinish) {
      rewardRate = reward / rewardPeriod;
    } else {
      uint256 remaining = periodFinish - block.timestamp;
      uint256 leftover = remaining * rewardRate;
      rewardRate = (reward + leftover) / rewardPeriod;
    }

    lastUpdateTime = block.timestamp;
    periodFinish = block.timestamp + rewardPeriod;
    emit RewardsDistributed(reward, block.timestamp, rewardPeriod);
  }

  /**
   * @dev Locks or unlocks the specified staker's stake.
   * Only callable by the REWARD_ROLE.
   * @param stakerAddress The address of the staker.
   * @param lockStatus Boolean indicating whether to lock (true) or unlock (false) the stake.
   */
  function setStakeLockStatus(
    address stakerAddress,
    bool lockStatus
  ) external onlyRole(REWARD_ROLE) {
    bool currentLockStatus = lockedStakes[stakerAddress];
    require(
      currentLockStatus != lockStatus,
      lockStatus ? "Already locked." : "Already unlocked."
    );

    lockedStakes[stakerAddress] = lockStatus;
    emit StakeLockStatusChanged(stakerAddress, lockStatus);
  }

  /**
   * @dev ERC721 token receiver function.
   *
   * @return bytes4 `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`.
   */
  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns (bytes4) {
    return this.onERC721Received.selector;
  }

  // ======== DAO functions ========

  function setRewardPeriod(
    uint256 period
  ) external updateReward(address(0)) onlyRole(DAO_ROLE) {
    require(block.timestamp >= periodFinish, "old period is still active");
    rewardPeriod = period;
  }

  function setMinStakeAmount(
    uint256 _minStakeAmount
  ) external onlyRole(DAO_ROLE) {
    minStakeAmount = _minStakeAmount;
    emit MinStakeAmountUpdated(_minStakeAmount);
  }

  function setFunctionPauseStatus(
    string memory functionName,
    bool pauseStatus
  ) external onlyRole(DAO_ROLE) {
    bool currentStatus = functionPauseStatus[functionName];
    require(
      currentStatus != pauseStatus,
      pauseStatus ? "Already paused." : "Already unpaused."
    );

    functionPauseStatus[functionName] = pauseStatus;
    emit FunctionPauseStatusChanged(functionName, pauseStatus);
  }

  /**
   * @dev Calculates the current reward per token.
   * The reward per token is the amount of reward earned per staking token until now.
   * @return The current reward per token.
   */
  function rewardPerToken() public view returns (uint256) {
    if (totalStaked == 0) {
      return rewardPerTokenStored;
    } else {
      return
        rewardPerTokenStored +
        ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) /
        totalStaked;
    }
  }

  /**
   * @dev Calculates the total rewards earned by a node.
   * @param stakerAddress The staker address of a node.
   * @return The total rewards earned by a node.
   */
  function earned(address stakerAddress) public view returns (uint256) {
    User memory user = users[stakerAddress];
    return
      (user.balance * (rewardPerToken() - user.paidRewardPerToken)) /
      1e18 +
      user.pendingRewards;
  }

  /**
   * @dev Returns the last time when rewards were applicable.
   * @return The last time when rewards were applicable.
   */
  function lastTimeRewardApplicable() public view returns (uint256) {
    return block.timestamp < periodFinish ? block.timestamp : periodFinish;
  }
}
