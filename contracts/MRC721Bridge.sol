// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./lib/interfaces/IMuonClient.sol";
import "./interfaces/IMRC404.sol";

contract MRC721Bridge is AccessControl, IERC721Receiver {
  using ECDSA for bytes32;
  using MessageHashUtils for bytes32;

  struct ClaimParams {
    address user;
    uint256[] nftIds;
    uint256 fromChain;
    uint256 toChain;
    uint256 tokenId;
    uint256 txId;
  }

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  /**
   * @dev `AddToken` and `removeToken` are using this role.
   *
   * This role could be granted another contract to let a Muon app
   * manage the tokens. The token deployer will be verified by
   * a Muon app and let the deployer add new tokens to the MTC20Bridges.
   */
  bytes32 public constant TOKEN_ADDER_ROLE = keccak256("TOKEN_ADDER");

  bytes4 public constant _ERC721_RECEIVED = 0x150b7a02;

  uint256 public muonAppId;
  IMuonClient.PublicKey public muonPublicKey;
  IMuonClient public muon;
  address public muonValidGateway;

  // a unique ID will be assigned to each chain (default is CHAIN-ID)
  uint256 public network;

  // tokenId => tokenContractAddress
  mapping(uint256 => address) public tokens;
  mapping(address => uint256) public ids;

  event AddToken(address addr, uint256 tokenId);

  event Deposit(uint256 txId);

  event Claim(
    address indexed user,
    uint256 txId,
    uint256 indexed fromChain,
    uint256 indexed tokenId
  );

  struct TX {
    uint256 tokenId;
    uint256[] nftIds;
    uint256 toChain;
    address user;
    bytes nftData;
  }
  uint256 public lastTxId;

  mapping(uint256 => TX) public txs;

  mapping(uint256 => mapping(uint256 => bool)) public claimedTxs;

  constructor(
    uint256 _muonAppId,
    IMuonClient.PublicKey memory _muonPublicKey,
    address _muon
  ) {
    network = getCurrentChainID();
    muonAppId = _muonAppId;
    muonPublicKey = _muonPublicKey;
    muon = IMuonClient(_muon);
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
  }

  function deposit(
    uint256[] calldata nftId,
    uint256 toChain,
    uint256 tokenId
  ) external returns (uint256) {
    return depositFor(msg.sender, nftId, toChain, tokenId);
  }

  function depositFor(
    address user,
    uint256[] calldata nftIds,
    uint256 toChain,
    uint256 tokenId
  ) public payable returns (uint256) {
    require(toChain != network, "Self Deposit");
    require(tokens[tokenId] != address(0), "!tokenId");

    IMRC404 token = IMRC404(tokens[tokenId]);
    bytes memory nftData = token.burnFrom(msg.sender, nftIds);

    uint256 txId = ++lastTxId;
    txs[txId] = TX({
      tokenId: tokenId,
      toChain: toChain,
      nftIds: nftIds,
      user: user,
      nftData: nftData
    });

    emit Deposit(txId);

    return txId;
  }

  function claim(
    ClaimParams calldata params,
    bytes calldata nftData,
    bytes calldata reqId,
    IMuonClient.SchnorrSign calldata signature,
    bytes calldata gatewaySignature
  ) public {
    require(!claimedTxs[params.fromChain][params.txId], "already claimed");
    require(params.toChain == network, "!network");
    require(tokens[params.tokenId] != address(0), "Unknown tokenId");

    {
      // split encoding to avoid "stack too deep" error.
      bytes32 hash = keccak256(
        abi.encodePacked(
          abi.encodePacked(muonAppId),
          abi.encodePacked(reqId),
          abi.encodePacked(params.txId, params.tokenId),
          abi.encodePacked(params.fromChain, params.toChain),
          abi.encodePacked(params.user),
          abi.encodePacked(params.nftIds),
          abi.encodePacked(nftData)
        )
      );
      verifyMuonSig(reqId, hash, signature, gatewaySignature);
    }

    claimedTxs[params.fromChain][params.txId] = true;
    IMRC404 token = IMRC404(tokens[params.tokenId]);
    uint256 mintAmount = params.nftIds.length * token.getUnits();

    token.mint(params.user, mintAmount, nftData);

    emit Claim(params.user, params.txId, params.fromChain, params.tokenId);
  }

  function pendingTxs(
    uint256 fromChain,
    uint256[] calldata _ids
  ) public view returns (bool[] memory unclaimedIds) {
    unclaimedIds = new bool[](_ids.length);
    for (uint256 i = 0; i < _ids.length; i++) {
      unclaimedIds[i] = claimedTxs[fromChain][_ids[i]];
    }
  }

  function getTx(
    uint256 _txId
  )
    public
    view
    returns (
      uint256 txId,
      uint256 tokenId,
      uint256 fromChain,
      uint256 toChain,
      address user,
      address nftContract,
      uint256[] memory nftIds,
      bytes memory nftData
    )
  {
    txId = _txId;
    tokenId = txs[_txId].tokenId;
    fromChain = network;
    toChain = txs[_txId].toChain;
    user = txs[_txId].user;
    nftContract = tokens[tokenId];
    nftIds = txs[_txId].nftIds;
    nftData = txs[_txId].nftData;
  }

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

  function getTokenId(address _addr) public view returns (uint256) {
    return ids[_addr];
  }

  function getCurrentChainID() public view returns (uint256) {
    uint256 id;
    assembly {
      id := chainid()
    }
    return id;
  }

  function setNetworkID(uint256 _network) public onlyRole(ADMIN_ROLE) {
    network = _network;
  }

  function setMuonAppId(uint256 _muonAppId) external onlyRole(ADMIN_ROLE) {
    muonAppId = _muonAppId;
  }

  function setMuonContract(address _addr) public onlyRole(ADMIN_ROLE) {
    muon = IMuonClient(_addr);
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

  function adminWithdrawTokens(
    uint256 amount,
    address _to,
    address tokenAddress
  ) public onlyRole(ADMIN_ROLE) {
    require(_to != address(0));
    if (tokenAddress == address(0)) {
      payable(_to).transfer(amount);
    } else {
      IMRC404(tokenAddress).transfer(_to, amount);
    }
  }

  function emergencyWithdrawERC721Tokens(
    address _tokenAddr,
    address _to,
    uint256 _id
  ) public onlyRole(ADMIN_ROLE) {
    IMRC404(_tokenAddr).safeTransferFrom(address(this), _to, _id);
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) public pure override returns (bytes4) {
    return _ERC721_RECEIVED;
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
