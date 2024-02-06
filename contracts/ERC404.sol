//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC404} from "./IERC404.sol";
import {ERC721Receiver} from "./ERC721Receiver.sol";

abstract contract ERC404 is IERC404, Ownable {
  // Metadata
  /// @dev Token name
  string public name;

  /// @dev Token symbol
  string public symbol;

  /// @dev Decimals for ERC20 representation
  uint8 public immutable decimals;

  /// @dev Units for ERC20 representation
  uint256 public immutable units;

  /// @dev Total supply in ERC20 representation
  uint256 public immutable totalSupply;

  /// @dev Current mint counter, monotonically increasing to ensure accurate ownership
  uint256 public minted;

  // Mappings
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

  // Constructor
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _totalERC721Supply,
    address _owner
  ) Ownable(_owner) {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    units = 10 ** decimals;
    totalSupply = _totalERC721Supply * units;
  }

  /// @notice Initialization function to set pairs / etc, saving gas by avoiding mint / burn on unnecessary targets
  function setWhitelist(address target, bool state) public onlyOwner {
    whitelist[target] = state;
  }

  /// @notice Function to find owner of a given ERC721 token
  function ownerOf(uint256 id) public view virtual returns (address owner) {
    owner = _ownerOf[id];

    if (owner == address(0)) {
      revert NotFound();
    }
  }

  /// @notice tokenURI must be implemented by child contract
  function tokenURI(uint256 id) public view virtual returns (string memory);

  /// @notice Function for token approvals
  /// @dev This function assumes id / ERC721 if amount less than or equal to current max id
  function approve(
    address spender,
    uint256 valueOrId
  ) public virtual returns (bool) {
    if (valueOrId <= minted && valueOrId > 0) {
      // Intention is to approve as ERC-721 token (id).
      uint256 id = valueOrId;
      address nftOwner = _ownerOf[id];

      if (msg.sender != nftOwner && !isApprovedForAll[nftOwner][msg.sender]) {
        revert Unauthorized();
      }

      getApproved[id] = spender;

      emit Approval(nftOwner, spender, id);
      emit ERC721Approval(nftOwner, spender, id);
    } else {
      // Intention is to approve as ERC-20 token (value).
      uint256 value = valueOrId;
      allowance[msg.sender][spender] = value;

      emit Approval(msg.sender, spender, value);
      emit ERC20Approval(msg.sender, spender, value);
    }

    return true;
  }

  /// @notice Function ERC721 approvals
  function setApprovalForAll(address operator, bool approved) public virtual {
    isApprovedForAll[msg.sender][operator] = approved;
    emit ApprovalForAll(msg.sender, operator, approved);
  }

  /// @notice Function for mixed transfers
  /// @dev This function assumes id / ERC721 if amount less than or equal to current max id
  function transferFrom(
    address from,
    address to,
    uint256 valueOrId
  ) public virtual {
    if (valueOrId <= minted) {
      uint256 id = valueOrId;
      // Intention is to transfer as ERC-721 token (id).
      if (from != _ownerOf[id]) {
        revert InvalidSender();
      }

      if (to == address(0)) {
        revert InvalidRecipient();
      }

      if (
        msg.sender != from &&
        !isApprovedForAll[from][msg.sender] &&
        msg.sender != getApproved[id]
      ) {
        revert Unauthorized();
      }

      balanceOf[from] -= units;

      unchecked {
        balanceOf[to] += units;
      }

      _ownerOf[id] = to;
      delete getApproved[id];

      // update _owned for sender
      uint256 updatedId = _owned[from][_owned[from].length - 1];
      _owned[from][_ownedIndex[id]] = updatedId;
      // pop
      _owned[from].pop();
      // update index for the moved id
      _ownedIndex[updatedId] = _ownedIndex[id];
      // push token to to owned
      _owned[to].push(id);
      // update index for to owned
      _ownedIndex[id] = _owned[to].length - 1;

      emit Transfer(from, to, id);
      emit ERC20Transfer(from, to, units);
    } else {
      // Intention is to transfer as ERC-20 token (value).
      uint256 value = valueOrId;
      uint256 allowed = allowance[from][msg.sender];

      if (allowed != type(uint256).max) {
        allowance[from][msg.sender] = allowed - value;
      }

      _transfer(from, to, value);
      emit ERC721Transfer(from, to, value);
    }
  }

  /// @notice Function for ERC20 transfers
  function transfer(address to, uint256 amount) public virtual returns (bool) {
    return _transfer(msg.sender, to, amount);
  }

  /// @notice Function for ERC721 transfers with contract support
  function safeTransferFrom(
    address from,
    address to,
    uint256 id
  ) public virtual {
    transferFrom(from, to, id);

    if (
      to.code.length != 0 &&
      ERC721Receiver(to).onERC721Received(msg.sender, from, id, "") !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Function for ERC721 transfers with contract support and callback data
  function safeTransferFrom(
    address from,
    address to,
    uint256 id,
    bytes calldata data
  ) public virtual {
    transferFrom(from, to, id);

    if (
      to.code.length != 0 &&
      ERC721Receiver(to).onERC721Received(msg.sender, from, id, data) !=
      ERC721Receiver.onERC721Received.selector
    ) {
      revert UnsafeRecipient();
    }
  }

  /// @notice Internal function for ERC20 transfers
  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal returns (bool) {
    uint256 balanceBeforeSender = balanceOf[from];
    uint256 balanceBeforeReceiver = balanceOf[to];

    balanceOf[from] -= amount;

    unchecked {
      balanceOf[to] += amount;
    }

    // Skip burn for certain addresses to save gas
    if (!whitelist[from]) {
      uint256 tokensToBurn = (balanceBeforeSender / units) -
        (balanceOf[from] / units);
      for (uint256 i = 0; i < tokensToBurn; i++) {
        _burn(from);
      }
    }

    // Skip minting for certain addresses to save gas
    if (!whitelist[to]) {
      uint256 tokensToMint = (balanceOf[to] / units) -
        (balanceBeforeReceiver / units);
      for (uint256 i = 0; i < tokensToMint; i++) {
        _mint(to);
      }
    }

    emit ERC20Transfer(from, to, amount);
    return true;
  }

  function _mint(address to) internal virtual {
    if (to == address(0)) {
      revert InvalidRecipient();
    }

    unchecked {
      minted++;
    }

    uint256 id = minted;

    if (_ownerOf[id] != address(0)) {
      revert AlreadyExists();
    }

    _ownerOf[id] = to;
    _owned[to].push(id);
    _ownedIndex[id] = _owned[to].length - 1;

    emit Transfer(address(0), to, id);
  }

  function _burn(address from) internal virtual {
    if (from == address(0)) {
      revert InvalidSender();
    }

    uint256 id = _owned[from][_owned[from].length - 1];
    _owned[from].pop();
    delete _ownedIndex[id];
    delete _ownerOf[id];
    delete getApproved[id];

    emit Transfer(from, address(0), id);
    emit ERC721Transfer(from, address(0), id);
  }

  function _setNameSymbol(string memory _name, string memory _symbol) internal {
    name = _name;
    symbol = _symbol;
  }
}