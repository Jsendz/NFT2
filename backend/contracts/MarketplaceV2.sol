// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MarketplaceV2
 * @notice Supports ERC-20 payments and gasless (EIP-712) signed orders.
 *         - Currency = address(0) → native ETH
 *         - Currency = ERC20 token address (e.g., WETH)
 *         - Signed Order: seller signs off-chain; buyer fills on-chain (no storage listing).
 * @dev Educational template; not audited. Consider pausability, guardian roles, better nonce mgmt, etc.
 */
contract MarketplaceV2 is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    struct Order {
        address seller;
        address nft;
        uint256 tokenId;
        address currency; // 0x0 for ETH, else ERC20 (e.g., WETH)
        uint256 price;    // in smallest unit (wei for ETH or token decimals)
        uint256 expiration; // unix timestamp (0 = no expiry)
        uint256 nonce;      // per-seller nonce to prevent replay
    }

    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address nft,uint256 tokenId,address currency,uint256 price,uint256 expiration,uint256 nonce)"
    );

    uint96 public protocolFeeBps; // e.g., 250 = 2.5%
    address public feeRecipient;

    // Nonce use/cancellation per seller
    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    // Events
    event OrderFilled(bytes32 orderHash, address indexed buyer, uint256 price, uint256 protocolFee, uint256 royaltyAmount);
    event OrderCancelled(address indexed seller, uint256 indexed nonce);
    event ProtocolFeeChanged(uint96 bps);
    event FeeRecipientChanged(address indexed feeRecipient);

    constructor(address _owner, address _feeRecipient, uint96 _protocolFeeBps)
        Ownable(_owner)
        EIP712("MarketplaceV2", "1")
    {
        require(_feeRecipient != address(0), "feeRecipient=0");
        require(_protocolFeeBps <= 1000, "fee too high");
        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
    }

    // ----- Admin -----
    function setProtocolFeeBps(uint96 _bps) external onlyOwner {
        require(_bps <= 1000, "fee too high");
        protocolFeeBps = _bps;
        emit ProtocolFeeChanged(_bps);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "feeRecipient=0");
        feeRecipient = _feeRecipient;
        emit FeeRecipientChanged(_feeRecipient);
    }

    // ----- Order helpers -----
    function hashOrder(Order calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    o.seller,
                    o.nft,
                    o.tokenId,
                    o.currency,
                    o.price,
                    o.expiration,
                    o.nonce
                )
            )
        );
    }

    function verify(Order calldata o, bytes calldata sig) public view returns (bool) {
        bytes32 digest = hashOrder(o);
        (address recovered, , ) = ECDSA.tryRecover(digest, sig);
        return recovered == o.seller;
    }

    // Seller can preemptively cancel a nonce (even without any stored order)
    function cancelNonce(uint256 nonce) external {
        nonceUsed[msg.sender][nonce] = true;
        emit OrderCancelled(msg.sender, nonce);
    }

    // ----- Fill signed order -----
    function buySigned(Order calldata o, bytes calldata signature) external payable nonReentrant {
        require(o.seller != address(0), "bad seller");
        require(o.price > 0, "price=0");
        if (o.expiration != 0) {
            require(block.timestamp <= o.expiration, "order expired");
        }
        require(!nonceUsed[o.seller][o.nonce], "nonce used");

        bytes32 digest = hashOrder(o);
        (address recovered, , ) = ECDSA.tryRecover(digest, signature);
        require(recovered == o.seller, "bad signature");

        IERC721 t = IERC721(o.nft);
        require(t.ownerOf(o.tokenId) == o.seller, "owner changed");
        require(
            t.getApproved(o.tokenId) == address(this) || t.isApprovedForAll(o.seller, address(this)),
            "not approved"
        );

        // mark nonce used (effect)
        nonceUsed[o.seller][o.nonce] = true;

        // compute fees
        uint256 protocolFee = (o.price * protocolFeeBps) / 10_000;
        (address royaltyRcpt, uint256 royaltyAmt) = _royaltyInfo(o.nft, o.tokenId, o.price);
        uint256 sellerProceeds = o.price - protocolFee - royaltyAmt;

        // handle funds
        if (o.currency == address(0)) {
            // ETH path
            require(msg.value == o.price, "wrong msg.value");
            // transfer fees
            if (protocolFee > 0) {
                (bool okFee, ) = payable(feeRecipient).call{value: protocolFee}("");
                require(okFee, "fee xfer failed");
            }
            if (royaltyAmt > 0 && royaltyRcpt != address(0)) {
                (bool okRoy, ) = payable(royaltyRcpt).call{value: royaltyAmt}("");
                require(okRoy, "royalty xfer failed");
            }
            (bool okSeller, ) = payable(o.seller).call{value: sellerProceeds}("");
            require(okSeller, "seller xfer failed");
        } else {
            // ERC20 path (buyer must approve this contract to spend o.currency)
            IERC20 token = IERC20(o.currency);
            if (protocolFee > 0) token.safeTransferFrom(msg.sender, feeRecipient, protocolFee);
            if (royaltyAmt > 0 && royaltyRcpt != address(0)) token.safeTransferFrom(msg.sender, royaltyRcpt, royaltyAmt);
            token.safeTransferFrom(msg.sender, o.seller, sellerProceeds);
        }

        // transfer NFT last (or first — either is fine; here we do last to ensure funds path didn’t revert)
        t.safeTransferFrom(o.seller, msg.sender, o.tokenId);

        emit OrderFilled(digest, msg.sender, o.price, protocolFee, royaltyAmt);
    }

    // ----- Internal -----
    function _royaltyInfo(address nft, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (address, uint256)
    {
        try IERC2981(nft).royaltyInfo(tokenId, salePrice) returns (address rcpt, uint256 amount) {
            return (rcpt, amount);
        } catch {
            return (address(0), 0);
        }
    }
}
