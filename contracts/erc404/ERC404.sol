//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "hardhat/console.sol";

import {DoubleEndedQueue} from "@openzeppelin/contracts/utils/structs/DoubleEndedQueue.sol";
import {IERC404} from "./IERC404.sol";
import {ERC721Receiver} from "../ERC721Receiver.sol";

abstract contract ERC404 is IERC404 {
  using DoubleEndedQueue for DoubleEndedQueue.Bytes32Deque;

  /// @dev The queue of ERC721 tokens stored in the contract.
  DoubleEndedQueue.Bytes32Deque private _storedERC721Ids;

  /// @dev Token name
  string public name;

  /// @dev Token symbol
  string public symbol;

  /// @dev Decimals for ERC20 representation
  uint8 public immutable decimals;

  /// @dev Units for ERC20 representation
  uint256 public immutable units;

  /// @dev Max supply for ERC20 representation
  uint256 public immutable maxTotalSupplyERC20;

  /// @dev Max supply for ERC721 representation
  uint256 public immutable maxTotalSupplyERC721;

  /// @dev Total supply in ERC20 representation
  uint256 public totalSupply;

  /// @dev Current mint counter, monotonically increasing to ensure accurate ownership
  uint256 public minted;

  /// @dev Balance of user in ERC20 representation
  mapping(address => uint256) public balanceOf;

  /// @dev Allowance of user in ERC20 representation
  mapping(address => mapping(address => uint256)) public allowance;

  /// @dev Approval in ERC721 representaion
  mapping(uint256 => address) public getApproved;

  /// @dev Approval for all in ERC721 representation
  mapping(address => mapping(address => bool)) public isApprovedForAll;

  /// @dev Owner of id in ERC721 representation
  mapping(uint256 => address) internal _ownerOf;

  /// @dev Array of owned ids in ERC721 representation
  mapping(address => uint256[]) internal _owned;

  /// @dev Tracks indices for the _owned mapping
  mapping(uint256 => uint256) internal _ownedIndex;

  /// @dev Addresses whitelisted from minting / burning for gas savings (pairs, routers, etc)
  mapping(address => bool) public whitelist;

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 maxTotalSupplyERC721_
  ) {
    name = name_;
    symbol = symbol_;

    if (decimals_ < 18) {
      revert DecimalsTooLow();
    }

    decimals = decimals_;
    units = 10 ** decimals;
    maxTotalSupplyERC721 = maxTotalSupplyERC721_;
    maxTotalSupplyERC20 = maxTotalSupplyERC721 * units;
  }

  /// @notice Function to find owner of a given ERC721 token
  function ownerOf(uint256 id_) public view virtual returns (address nftOwner) {
    nftOwner = _ownerOf[id_];

    // TODO: could add check for id < minted to ensure it's a valid id
    if (nftOwner == address(0)) {
      revert NotFound();
    }
  }

  function erc721BalanceOf(
    address owner_
  ) public view virtual returns (uint256) {
    return _owned[owner_].length;
  }

  function erc20BalanceOf(
    address owner_
  ) public view virtual returns (uint256) {
    return balanceOf[owner_];
  }

  /// @notice tokenURI must be implemented by child contract
  function tokenURI(uint256 id_) public view virtual returns (string memory);

  /// @notice Function for token approvals
  /// @dev This function assumes the operator is attempting to approve an ERC721 if valueOrId is less than or equal to current max id
  function approve(
    address spender_,
    uint256 valueOrId_
  ) public virtual returns (bool) {
    if (valueOrId_ <= minted && valueOrId_ > 0) {
      // Intention is to approve as ERC-721 token (id).
      uint256 id = valueOrId_;
      address nftOwner = _ownerOf[id];

      if (msg.sender != nftOwner && !isApprovedForAll[nftOwner][msg.sender]) {
        revert Unauthorized();
      }

      getApproved[id] = spender_;

      emit Approval(nftOwner, spender_, id);
      emit ERC721Approval(nftOwner, spender_, id);
    } else {
      // Intention is to approve as ERC-20 token (value).
      uint256 value = valueOrId_;
      allowance[msg.sender][spender_] = value;

      emit Approval(msg.sender, spender_, value);
      emit ERC20Approval(msg.sender, spender_, value);
    }

    return true;
  }

  /// @notice Function for ERC721 approvals
  function setApprovalForAll(address operator_, bool approved_) public virtual {
    isApprovedForAll[msg.sender][operator_] = approved_;
    emit ApprovalForAll(msg.sender, operator_, approved_);
  }

  /// @notice Function for mixed transfers from an operator that may be different than 'from'.
  /// @dev This function assumes the operator is attempting to transfer an ERC721 if valueOrId is less than or equal to current max id.
  function transferFrom(
    address from_,
    address to_,
    uint256 valueOrId_
  ) public virtual {
    // Prevent burning tokens to the 0 address.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    if (valueOrId_ <= minted) {
      // Intention is to transfer as ERC-721 token (id).
      uint256 id = valueOrId_;

      if (from_ != _ownerOf[id]) {
        revert InvalidSender();
      }

      // Check that the operator is approved for the transfer.
      if (
        msg.sender != from_ &&
        !isApprovedForAll[from_][msg.sender] &&
        msg.sender != getApproved[id]
      ) {
        revert Unauthorized();
      }

      // Transfer 1 * units ERC20 and 1 ERC721 token.
      _transferERC20(from_, to_, units);
      _transferERC721(from_, to_, id);
    } else {
      // Intention is to transfer as ERC-20 token (value).
      uint256 value = valueOrId_;
      uint256 allowed = allowance[from_][msg.sender];

      // Check that the operator has sufficient allowance.
      if (allowed != type(uint256).max) {
        if (allowed < value) {
          revert InsufficientAllowance();
        }
        allowance[from_][msg.sender] = allowed - value;
      }

      // Transferring ERC20s directly requires the _transfer function.
      _transfer(from_, to_, value);
    }
  }

  /// @notice Function for mixed transfers.
  /// @dev This function assumes the operator is attempting to transfer an ERC721 if valueOrId is less than or equal to current max id.
  function transfer(
    address to_,
    uint256 valueOrId_
  ) public virtual returns (bool) {
    // Prevent burning tokens to the 0 address.
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    if (valueOrId_ <= minted) {
      // Intention is to transfer as ERC-721 token (id).
      uint256 id = valueOrId_;

      if (msg.sender != _ownerOf[id]) {
        revert Unauthorized();
      }

      // Transfer 1 * units ERC20 and 1 ERC721 token.
      // This this path is used to ensure the exact ERC721 specified is transferred.
      _transferERC20(msg.sender, to_, units);
      _transferERC721(msg.sender, to_, id);
    } else {
      // Intention is to transfer as ERC-20 token (value).
      uint256 value = valueOrId_;

      // Transferring ERC20s directly requires the _transfer function.
      _transfer(msg.sender, to_, value);
    }

    return true;
  }

  /// @notice Function for ERC721 transfers with contract support.
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_
  ) public virtual {
    transferFrom(from_, to_, id_);

    if (
      to_.code.length != 0 &&
      ERC721Receiver(to_).onERC721Received(msg.sender, from_, id_, "") !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Function for ERC721 transfers with contract support and callback data.
  function safeTransferFrom(
    address from_,
    address to_,
    uint256 id_,
    bytes calldata data_
  ) public virtual {
    transferFrom(from_, to_, id_);

    if (
      to_.code.length != 0 &&
      ERC721Receiver(to_).onERC721Received(msg.sender, from_, id_, data_) !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice This is the lowest level ERC20 transfer function, which should be used for both normal ERC20 transfers as well as minting.
  /// Note that this function allows transfers to and from 0x0.
  function _transferERC20(
    address from_,
    address to_,
    uint256 value_
  ) internal virtual {
    // Minting is a special case for which we should not check the balance of the sender, and we should increase the total supply.
    if (from_ == address(0)) {
      if (totalSupply + value_ > maxTotalSupplyERC20) {
        revert MaxERC20SupplyReached();
      }
      unchecked {
        totalSupply += value_;
      }
    } else {
      // For transfers not from the 0x0 address, check for insufficient balance.
      if (balanceOf[from_] < value_) {
        revert InsufficientBalance();
      }
      // Deduct value from sender's balance.
      balanceOf[from_] -= value_;
    }

    // Update the recipient's balance.
    unchecked {
      balanceOf[to_] += value_;
    }

    emit Transfer(from_, to_, value_);
    emit ERC20Transfer(from_, to_, value_);
  }

  /// @notice Consolidated record keeping function for transferring ERC721s.
  /// @dev Assign the token to the new owner, and remove from the old owner.
  /// Note that this function allows transfers to and from 0x0.
  function _transferERC721(
    address from_,
    address to_,
    uint256 id_
  ) internal virtual {
    // If this is not a mint, handle record keeping for transfer from previous owner.
    if (from_ != address(0)) {
      // On transfer of an NFT, any previous approval is reset.
      delete getApproved[id_];

      // update _owned for sender
      uint256 updatedId = _owned[from_][_owned[from_].length - 1];
      _owned[from_][_ownedIndex[id_]] = updatedId;
      // pop
      _owned[from_].pop();
      // update index for the moved id
      _ownedIndex[updatedId] = _ownedIndex[id_];
    }

    // Update owner of the token to the new owner.
    _ownerOf[id_] = to_;
    // Push token onto the new owner's stack.
    _owned[to_].push(id_);
    // Update index for new owner's stack.
    _ownedIndex[id_] = _owned[to_].length - 1;

    emit Transfer(from_, to_, id_);
    emit ERC721Transfer(from_, to_, id_);
  }

  /// @notice Internal function for ERC20 transfers. Also handles any NFT transfers that may be required.
  function _transfer(
    address from_,
    address to_,
    uint256 value_
  ) internal virtual returns (bool) {
    uint256 erc20BalanceBeforeSender = erc20BalanceOf(from_);
    uint256 erc20BalanceBeforeReceiver = erc20BalanceOf(to_);

    _transferERC20(from_, to_, value_);

    // Skip _withdrawAndStoreERC721 and/or _retrieveOrMintERC721 for whitelisted addresses 1) to save gas, and 2) because whitelisted addresses won't always have/need NFTs corresponding to their ERC20s.
    if (whitelist[from_] && whitelist[to_]) {
      // Case 1) Both sender and recipient are whitelisted. No NFTs need to be transferred.
      // NOOP.
    } else if (whitelist[from_]) {
      // Case 2) The sender is whitelisted, but the recipient is not. Contract should not attempt to transfer NFTs from the sender, but the recipient should receive NFTs from the bank/minted for any whole number increase in their balance.
      // Only cares about whole number increments.
      uint256 tokensToRetrieveOrMint = (balanceOf[to_] / units) -
        (erc20BalanceBeforeReceiver / units);
      for (uint256 i = 0; i < tokensToRetrieveOrMint; i++) {
        _retrieveOrMintERC721(to_);
      }
    } else if (whitelist[to_]) {
      // Case 3) The sender is not whitelisted, but the recipient is. Contract should attempt to withdraw and store NFTs from the sender, but the recipient should not receive NFTs from the bank/minted.
      // Only cares about whole number increments.
      uint256 tokensToWithdrawAndStore = (erc20BalanceBeforeSender / units) -
        (balanceOf[from_] / units);
      for (uint256 i = 0; i < tokensToWithdrawAndStore; i++) {
        _withdrawAndStoreERC721(from_);
      }
    } else {
      // Case 4) Neither the sender nor the recipient are whitelisted.
      // Strategy:
      // 1. First deal with the whole tokens. These are easy and will just be transferred.
      // 2. Look at the fractional part of the value:
      //   a) If it causes the sender to lose a whole token that was represented by an NFT due to a fractional part being transferred, withdraw and store an additional NFT from the sender.
      //   b) If it causes the receiver to gain a whole new token that should be represented by an NFT due to receiving a fractional part that completes a whole token, retrieve or mint an NFT to the recevier.

      // Whole tokens worth of ERC20s get transferred as NFTs without any burning/minting.
      uint256 nftsToTransfer = value_ / units;
      for (uint256 i = 0; i < nftsToTransfer; i++) {
        // Pop from sender's NFT stack and transfer them (LIFO)
        uint256 indexOfLastToken = _owned[from_].length - 1;
        uint256 tokenId = _owned[from_][indexOfLastToken];
        _transferERC721(from_, to_, tokenId);
      }

      // If the sender's transaction changes their holding from a fractional to a non-fractional amount (or vice versa), adjust NFTs.
      // Check if the send causes the sender to lose a whole token that was represented by an NFT due to a fractional part being transferred.
      // To check this, look if subtracting the fractional amount from the balance causes the balance to drop below the original balance % units, which represents the number of whole tokens they started with.
      uint256 fractionalAmount = value_ % units;

      if (
        (erc20BalanceBeforeSender - fractionalAmount) / units <
        (erc20BalanceBeforeSender / units)
      ) {
        _withdrawAndStoreERC721(from_);
      }

      // Check if the receive causes the receiver to gain a whole new token that should be represented by an NFT due to receiving a fractional part that completes a whole token.
      if (
        (erc20BalanceBeforeReceiver + fractionalAmount) / units >
        (erc20BalanceBeforeReceiver / units)
      ) {
        _retrieveOrMintERC721(to_);
      }
    }

    return true;
  }

  /// @notice Internal function for ERC20 minting
  /// @dev This function will allow minting of new ERC20s up to the maxTotalSupplyERC20. If mintCorrespondingERC721s_ is true, it will also mint the corresponding ERC721s.
  function _mintERC20(
    address to_,
    uint256 value_,
    bool mintCorrespondingERC721s_
  ) internal virtual {
    /// You cannot mint to the zero address (you can't mint and immediately burn in the same transfer).
    if (to_ == address(0)) {
      revert InvalidRecipient();
    }

    _transferERC20(address(0), to_, value_);

    // If mintCorrespondingERC721s_ is true, mint the corresponding ERC721s.
    if (mintCorrespondingERC721s_) {
      uint256 nftsToRetrieveOrMint = value_ / units;
      for (uint256 i = 0; i < nftsToRetrieveOrMint; i++) {
        _retrieveOrMintERC721(to_);
      }
    }
  }

  /// @notice Internal function for ERC721 minting and retrieval from the bank.
  /// @dev This function will allow minting of new ERC721s up to the maxTotalSupplyERC20. It will first try to pull from the bank, and if the bank is empty, it will mint a new token.
  function _retrieveOrMintERC721(address to_) internal virtual {
    if (to_ == address(0) || to_ == address(this)) {
      revert InvalidRecipient();
    }

    uint256 id;

    if (!DoubleEndedQueue.empty(_storedERC721Ids)) {
      // If there are any tokens in the bank, use those first.
      // Pop off the end of the queue (FIFO).
      id = uint256(_storedERC721Ids.popBack());
    } else {
      // Otherwise, mint a new token, unless it would put us over the max total supply in ERC721 terms.
      // id is 0-indexed, and minted is the absolute count of minted tokens.
      id = minted;
      minted++;
      if (minted > maxTotalSupplyERC20 / units) {
        revert MaxERC721SupplyReached();
      }
    }

    address nftOwner = _ownerOf[id];

    // The token should not already belong to anyone besides 0x0 or this contract. If it does, something is wrong.
    if (nftOwner != address(0) && nftOwner != address(this)) {
      revert AlreadyExists();
    }

    // Transfer the token to the recipient, either transferring from the contract's bank or minting.
    _transferERC721(nftOwner, to_, id);
  }

  /// @notice Internal function for ERC721 deposits to bank (this contract).
  /// @dev This function will allow depositing of ERC721s to the bank, which can be retrieved by future minters.
  function _withdrawAndStoreERC721(address from_) internal virtual {
    if (from_ == address(0) || from_ == address(this)) {
      revert InvalidSender();
    }

    // Retrieve the latest token added to the owner's stack (LIFO).
    uint256 id = _owned[from_][_owned[from_].length - 1];

    // Transfer the token to the contract.
    _transferERC721(from_, address(this), id);

    // Record the token in the contract's bank queue.
    _storedERC721Ids.pushFront(bytes32(id));
  }

  /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
  function _setWhitelist(address target_, bool state_) internal virtual {
    // If the target has 1 or more NFTs, they should not be removed from the whitelist.
    if (erc721BalanceOf(target_) >= 1 && !state_) {
      revert CannotRemoveFromWhitelist();
    }
    whitelist[target_] = state_;
  }
}
