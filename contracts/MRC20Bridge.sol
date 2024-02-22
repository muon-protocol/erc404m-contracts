// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IMRC404.sol";
import "./lib/interfaces/IMuonClient.sol";

contract MRC20Bridge is AccessControl {
  using ECDSA for bytes32;
  using MessageHashUtils for bytes32;

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  struct ClaimParams {
    address user;
    uint256 amount;
    uint256 fromChain;
    uint256 toChain;
    uint256 tokenId;
    uint256 txId;
  }

  /**
   * @dev `AddToken` and `setSideContract`
   * are using this role.
   *
   * This role could be granted another contract to let a Muon app
   * manage the tokens. The token deployer will be verified by
   * a Muon app and let the deployer add new tokens to the MTC20Bridges.
   */
  bytes32 public constant TOKEN_ADDER_ROLE = keccak256("TOKEN_ADDER");

  uint256 public muonAppId;
  IMuonClient.PublicKey public muonPublicKey;
  IMuonClient public muon;
  address public muonValidGateway;

  uint256 public network; // current chain id

  // tokenId => tokenContractAddress
  mapping(uint256 => address) public tokens;
  mapping(address => uint256) public ids;

  event AddToken(address addr, uint256 tokenId);

  event Deposit(uint256 txId);

  event Claim(
    address indexed user,
    uint256 txId,
    uint256 indexed fromChain,
    uint256 amount,
    uint256 indexed tokenId
  );
  /* ========== STATE VARIABLES ========== */
  struct TX {
    // uint256 txId;
    uint256 tokenId;
    uint256 amount;
    uint256 toChain;
    address user;
    bytes nftData;
  }

  uint256 public lastTxId = 0; // unique id for deposit tx
  mapping(uint256 => TX) public txs;

  // source chain => (tx id => false/true)
  mapping(uint256 => mapping(uint256 => bool)) public claimedTxs;

  /* ========== CONSTRUCTOR ========== */

  constructor(
    uint256 _muonAppId,
    IMuonClient.PublicKey memory _muonPublicKey,
    address _muon
  ) {
    network = getExecutingChainID();
    muonAppId = _muonAppId;
    muonPublicKey = _muonPublicKey;
    muon = IMuonClient(_muon);
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
  }

  /* ========== PUBLIC FUNCTIONS ========== */

  function deposit(
    uint256 amount,
    uint256 toChain,
    uint256 tokenId
  ) external returns (uint256) {
    return depositFor(msg.sender, amount, toChain, tokenId);
  }

  function depositFor(
    address user,
    uint256 amount,
    uint256 toChain,
    uint256 tokenId
  ) public returns (uint256 txId) {
    require(toChain != network, "Bridge: selfDeposit");
    require(tokens[tokenId] != address(0), "Bridge: unknown tokenId");

    IMRC404 token = IMRC404(tokens[tokenId]);
    bytes memory nftData = token.burnFrom(msg.sender, amount);

    txId = ++lastTxId;
    txs[txId] = TX({
      tokenId: tokenId,
      toChain: toChain,
      amount: amount,
      user: user,
      nftData: nftData
    });

    emit Deposit(txId);

    return txId;
  }

  function claim(
    ClaimParams memory params,
    bytes calldata nftData,
    bytes calldata reqId,
    IMuonClient.SchnorrSign calldata signature,
    bytes calldata gatewaySignature
  ) external {
    require(params.toChain == network, "Bridge: toChain should equal network");
    require(
      !claimedTxs[params.fromChain][params.txId],
      "Bridge: already claimed"
    );
    require(tokens[params.tokenId] != address(0), "Bridge: unknown tokenId");

    {
      bytes32 hash = keccak256(
        abi.encodePacked(
          abi.encodePacked(muonAppId),
          abi.encodePacked(reqId),
          abi.encodePacked(params.txId, params.tokenId, params.amount),
          abi.encodePacked(params.fromChain, params.toChain),
          abi.encodePacked(params.user),
          abi.encodePacked(nftData)
        )
      );
      verifyMuonSig(reqId, hash, signature, gatewaySignature);
    }

    claimedTxs[params.fromChain][params.txId] = true;
    IMRC404 token = IMRC404(tokens[params.tokenId]);

    token.mint(params.user, params.amount, nftData);

    emit Claim(
      params.user,
      params.txId,
      params.fromChain,
      params.amount,
      params.tokenId
    );
  }

  /* ========== VIEWS ========== */

  function pendingTxs(
    uint256 fromChain,
    uint256[] calldata _ids
  ) external view returns (bool[] memory unclaimedIds) {
    unclaimedIds = new bool[](_ids.length);
    for (uint256 i = 0; i < _ids.length; i++) {
      unclaimedIds[i] = claimedTxs[fromChain][_ids[i]];
    }
  }

  function getTx(
    uint256 _txId
  )
    external
    view
    returns (
      uint256 txId,
      uint256 tokenId,
      uint256 amount,
      uint256 fromChain,
      uint256 toChain,
      address user,
      bytes memory nftData
    )
  // uint256 timestamp
  {
    txId = _txId;
    tokenId = txs[_txId].tokenId;
    amount = txs[_txId].amount;
    fromChain = network;
    toChain = txs[_txId].toChain;
    user = txs[_txId].user;
    nftData = txs[_txId].nftData;
  }

  function getExecutingChainID() public view returns (uint256) {
    uint256 id;
    assembly {
      id := chainid()
    }
    return id;
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function addToken(
    uint256 tokenId,
    address tokenAddress
  ) external onlyRole(TOKEN_ADDER_ROLE) {
    require(ids[tokenAddress] == 0, "already exist");
    require(tokens[tokenId] == address(0), "already exist");

    tokens[tokenId] = tokenAddress;
    ids[tokenAddress] = tokenId;

    emit AddToken(tokenAddress, tokenId);
  }

  function removeToken(
    uint256 tokenId,
    address tokenAddress
  ) external onlyRole(TOKEN_ADDER_ROLE) {
    require(ids[tokenAddress] == tokenId, "id!=addr");

    ids[tokenAddress] = 0;
    tokens[tokenId] = address(0);
  }

  function getTokenId(address _addr) external view returns (uint256) {
    return ids[_addr];
  }

  function setNetworkID(uint256 _network) external onlyRole(ADMIN_ROLE) {
    network = _network;
  }

  function setMuonAppId(uint256 _muonAppId) external onlyRole(ADMIN_ROLE) {
    muonAppId = _muonAppId;
  }

  function setMuonContract(address addr) external onlyRole(ADMIN_ROLE) {
    muon = IMuonClient(addr);
  }

  function setMuonPubKey(
    IMuonClient.PublicKey memory _muonPublicKey
  ) external onlyRole(ADMIN_ROLE) {
    muonPublicKey = _muonPublicKey;
  }

  function setMuonGateway(
    address _gatewayAddress
  ) external onlyRole(ADMIN_ROLE) {
    muonValidGateway = _gatewayAddress;
  }

  function emergencyWithdrawETH(
    uint256 amount,
    address addr
  ) external onlyRole(ADMIN_ROLE) {
    require(addr != address(0));
    payable(addr).transfer(amount);
  }

  function emergencyWithdrawERC404Tokens(
    address _tokenAddr,
    address _to,
    uint256 _amount
  ) external onlyRole(ADMIN_ROLE) {
    IMRC404(_tokenAddr).transfer(_to, _amount);
  }

  function verifyMuonSig(
    bytes calldata reqId,
    bytes32 hash,
    IMuonClient.SchnorrSign calldata sign,
    bytes calldata gatewaySignature
  ) internal {
    require(
      muon.muonVerify(reqId, uint256(hash), sign, muonPublicKey),
      "Invalid signature!"
    );

    if (muonValidGateway != address(0)) {
      hash = hash.toEthSignedMessageHash();
      address gatewaySignatureSigner = hash.recover(gatewaySignature);

      require(
        gatewaySignatureSigner == muonValidGateway,
        "Gateway is not valid"
      );
    }
  }
}
