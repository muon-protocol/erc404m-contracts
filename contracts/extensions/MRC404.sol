//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../ERC404.sol";

abstract contract MRC404 is ERC404, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");

  error ERC20InsufficientAllowance(
    address spender,
    uint256 allowed,
    uint256 amount
  );

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    address admin_
  ) ERC404(name_, symbol_, decimals_) {
    _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    _grantRole(DAO_ROLE, admin_);
  }

  function setWhitelist(
    address account_,
    bool value_
  ) external onlyRole(DAO_ROLE) {
    _setERC721TransferExempt(account_, value_);
  }

  function getUnits() external view returns (uint256) {
    return units;
  }

  function burnFrom(
    address from,
    uint256 amount
  ) public virtual returns (bytes memory nftData);

  function burnFrom(
    address from,
    uint256[] calldata nftIds
  ) public virtual returns (bytes memory nftData);

  function mint(
    address to,
    uint256 amount,
    bytes calldata data
  ) public virtual returns (uint256[] memory nftIds);

  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC404, AccessControl) returns (bool) {
    return (ERC404.supportsInterface(interfaceId) ||
      AccessControl.supportsInterface(interfaceId));
  }

  function encodeData(uint256 id) public view virtual returns (bytes memory);

  function encodeData(uint256[] memory ids) public view returns (bytes memory) {
    bytes[] memory params = new bytes[](ids.length);
    for (uint256 i = 0; i < ids.length; i++) {
      params[i] = encodeData(ids[i]);
    }
    return abi.encode(params);
  }

  function _burnFromERC20(
    address from,
    uint256 amount
  ) internal virtual returns (uint256[] memory nftIds) {
    // Prevent transferring tokens from 0x0.
    if (from == address(0)) {
      revert InvalidSender();
    }

    uint256 allowed = allowance[from][msg.sender];
    if (allowed != type(uint256).max) {
      if (allowed < amount) {
        revert ERC20InsufficientAllowance(msg.sender, allowed, amount);
      }
      allowance[from][msg.sender] = allowed - amount;
    }

    uint256 erc20BalanceOfSenderBefore = erc20BalanceOf(from);

    balanceOf[from] -= amount;
    totalSupply -= amount;

    // Skip burn for certain addresses to save gas
    if (!erc721TransferExempt(from)) {
      uint256 tokensToWithdrawAndStore = (erc20BalanceOfSenderBefore / units) -
        (balanceOf[from] / units);
      nftIds = new uint256[](tokensToWithdrawAndStore);
      for (uint256 i = 0; i < tokensToWithdrawAndStore; i++) {
        nftIds[i] = _withdrawAndStoreERC721(from);
      }
    }

    emit ERC20Events.ERC20Transfer(from, address(0), amount);
  }

  function _burnFromERC721(
    address from,
    uint256[] calldata nftIds
  ) internal virtual {
    if (from == address(0) || erc721TransferExempt(from)) {
      revert InvalidSender();
    }

    uint256 numIds = nftIds.length;

    uint256 erc20Amount = numIds * units;
    balanceOf[from] -= erc20Amount;
    totalSupply -= erc20Amount;

    for (uint256 i = 0; i < numIds; i++) {
      // Intention is to transfer as ERC-721 token (id).
      uint256 id = nftIds[i];

      if (from != _getOwnerOf(id)) {
        revert Unauthorized();
      }

      // Check that the operator is either the sender or approved for the transfer.
      // TODO: check safety.
      if (
        msg.sender != from &&
        !isApprovedForAll[from][msg.sender] &&
        msg.sender != getApproved[id]
      ) {
        revert Unauthorized();
      }

      _transferERC721(from, address(0), id);
    }

    emit ERC20Events.ERC20Transfer(from, address(0), erc20Amount);
  }

  function _mint(
    address to,
    uint256 amount
  ) internal virtual onlyRole(MINTER_ROLE) returns (uint256[] memory nftIds) {
    uint256 erc20BalanceOfReceiverBefore = erc20BalanceOf(to);

    _transferERC20(address(0), to, amount);

    // Skip minting for certain addresses to save gas
    if (!erc721TransferExempt(to)) {
      uint256 tokensToRetrieveOrMint = (balanceOf[to] / units) -
        (erc20BalanceOfReceiverBefore / units);
      nftIds = new uint256[](tokensToRetrieveOrMint);
      for (uint256 i = 0; i < tokensToRetrieveOrMint; i++) {
        nftIds[i] = _retrieveOrMintERC721(to);
      }
    }
  }
}
