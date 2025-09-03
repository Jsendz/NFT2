// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Minimal non-custodial NFT Marketplace
 * @notice Sellers keep tokens in their wallet; buyers purchase with native ETH.
 *         Supports protocol fees and optional EIP-2981 royalties (pulled from the NFT).
 * @dev    Educational template — not audited. Add pausability, listing expiry,
 *         signatures/off-chain orders, and more tests for production.
 */
contract Marketplace is Ownable, ReentrancyGuard {
    struct Listing {
        address nft;
        uint256 tokenId;
        address seller;
        uint256 price; // in wei
        bool active;
    }

    uint96 public protocolFeeBps; // e.g., 250 = 2.5%
    address public feeRecipient;

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings; // listingId => Listing

    event Listed(
        uint256 indexed listingId,
        address indexed nft,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    event PriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);
    event Canceled(uint256 indexed listingId);
    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 price,
        uint256 sellerProceeds,
        uint256 protocolFee,
        uint256 royaltyAmount
    );

    constructor(address _owner, address _feeRecipient, uint96 _protocolFeeBps) Ownable(_owner) {
        require(_feeRecipient != address(0), "feeRecipient=0");
        require(_protocolFeeBps <= 1000, "fee too high"); // <=10%
        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
    }

    // ------------------------ Admin ------------------------
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "feeRecipient=0");
        feeRecipient = _feeRecipient;
    }

    function setProtocolFeeBps(uint96 _bps) external onlyOwner {
        require(_bps <= 1000, "fee too high");
        protocolFeeBps = _bps;
    }

    // ------------------------ Listing ------------------------
    function list(address nft, uint256 tokenId, uint256 price) external returns (uint256 listingId) {
        require(price > 0, "price=0");
        IERC721 t = IERC721(nft);
        require(t.ownerOf(tokenId) == msg.sender, "not owner");
        require(
            t.getApproved(tokenId) == address(this) || t.isApprovedForAll(msg.sender, address(this)),
            "approve marketplace"
        );

        listingId = nextListingId++;
        listings[listingId] = Listing({
            nft: nft,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit Listed(listingId, nft, tokenId, msg.sender, price);
    }

    function updatePrice(uint256 listingId, uint256 newPrice) external {
        Listing storage l = listings[listingId];
        require(l.active, "inactive");
        require(l.seller == msg.sender, "not seller");
        require(newPrice > 0, "price=0");
        uint256 old = l.price;
        l.price = newPrice;
        emit PriceUpdated(listingId, old, newPrice);
    }

    function cancel(uint256 listingId) external {
        Listing storage l = listings[listingId];
        require(l.active, "inactive");
        require(l.seller == msg.sender, "not seller");
        l.active = false;
        emit Canceled(listingId);
    }

    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "inactive");
        require(msg.value == l.price, "wrong value");

        IERC721 t = IERC721(l.nft);
        require(t.ownerOf(l.tokenId) == l.seller, "owner changed");
        require(
            t.getApproved(l.tokenId) == address(this) || t.isApprovedForAll(l.seller, address(this)),
            "not approved"
        );

        // effects
        l.active = false;

        // fees
        uint256 protocolFee = (msg.value * protocolFeeBps) / 10_000;
        (address royaltyRcpt, uint256 royaltyAmt) = _royaltyInfo(l.nft, l.tokenId, msg.value);
        uint256 sellerProceeds = msg.value - protocolFee - royaltyAmt;

        // interactions
        t.safeTransferFrom(l.seller, msg.sender, l.tokenId); // transfers token first

        if (protocolFee > 0) {
            (bool okFee, ) = payable(feeRecipient).call{value: protocolFee}("");
            require(okFee, "fee xfer failed");
        }
        if (royaltyAmt > 0 && royaltyRcpt != address(0)) {
            (bool okRoy, ) = payable(royaltyRcpt).call{value: royaltyAmt}("");
            require(okRoy, "royalty xfer failed");
        }
        (bool okSeller, ) = payable(l.seller).call{value: sellerProceeds}("");
        require(okSeller, "seller xfer failed");

        emit Purchased(listingId, msg.sender, msg.value, sellerProceeds, protocolFee, royaltyAmt);
    }

    // ------------------------ Views ------------------------
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    /**
     * @dev Paginates active listings and also returns their IDs.
     * @param cursor start index to scan from (0..nextListingId-1)
     * @param limit  max number of active listings to return
     */
   function getActiveListings(uint256 cursor, uint256 limit)
    external
    view
    returns (Listing[] memory list_, uint256[] memory ids_, uint256 nextCursor_)
{
    uint256 n;
    uint256 i = cursor;
    uint256 maxId = nextListingId;

    Listing[] memory tmp = new Listing[](limit);
    uint256[] memory idTmp = new uint256[](limit);

    while (i < maxId && n < limit) {
        Listing memory L = listings[i];
        if (L.active) {
            tmp[n] = L;
            idTmp[n] = i;
            unchecked { n++; }
        }
        unchecked { i++; }
    }

    list_ = new Listing[](n);
    ids_  = new uint256[](n);
    for (uint256 j = 0; j < n; j++) {
        list_[j] = tmp[j];
        ids_[j]  = idTmp[j];
    }
    nextCursor_ = i;
}

    // ------------------------ Internal ------------------------
    function _royaltyInfo(address nft, uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (address, uint256)
    {
        // Try/catch avoids revert if NFT doesn't implement 2981
        try IERC2981(nft).royaltyInfo(tokenId, salePrice) returns (address rcpt, uint256 amount) {
            return (rcpt, amount);
        } catch {
            return (address(0), 0);
        }
    }
}
