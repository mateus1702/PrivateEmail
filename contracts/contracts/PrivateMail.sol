// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PrivateMail
 * @notice On-chain registry for encryption public keys, usernames, and paged encrypted message storage.
 * @dev Recipients register public keys (and optionally usernames); senders encrypt and store ciphertext.
 *      Inbox is paged (10 msgs/page); large ciphertexts stored by ref for lazy loading.
 */
contract PrivateMail {
    error ZeroAddress();
    error EmptyPublicKey();
    error AlreadyRegistered(address owner);
    error EmptyCiphertext();
    error RecipientNotRegistered(address recipient);
    error InvalidMessageId(uint256 messageId);
    error InvalidPageId(uint256 pageId);
    error InvalidUsername();
    error UsernameTaken(string username);
    error UsernameAlreadySet(address owner);
    error NotRegistered();

    uint256 public constant CIPHER_TEXT_INLINE_MAX = 256;
    uint256 public constant MESSAGES_PER_PAGE = 10;

    uint256 public constant PREV_PAGE_NONE = 0;

    struct Message {
        address sender;
        address recipient;
        bytes ciphertext;
        uint256 ciphertextRef;
        uint256 timestamp;
        bytes32 contentHash;
    }

    struct Page {
        uint256[MESSAGES_PER_PAGE] messageIds;
        uint8 count;
        uint256 prevPageIdForRecipient;
    }

    uint256 public nextMessageId;
    uint256 public nextPageId = 1;
    uint256 public nextCiphertextRefId = 1;

    mapping(uint256 => Message) public messages;
    mapping(uint256 => Page) public pages;
    mapping(uint256 => bytes) public largeCiphertexts;
    mapping(address => uint256) public recipientHeadPageId;
    mapping(address => bytes) public encryptionPublicKeys;
    mapping(address => bool) public hasRegisteredKey;
    mapping(bytes32 => address) public usernameToAddress;
    mapping(address => bytes32) public addressToUsername;
    mapping(address => string) public usernameOf;

    event PublicKeyRegistered(address indexed owner, bytes pubKey);
    event UsernameRegistered(address indexed owner, string username);
    event MessageSent(
        uint256 indexed messageId,
        address indexed sender,
        address indexed recipient,
        uint256 timestamp,
        bytes32 contentHash
    );

    /**
     * @notice Normalize username to lowercase for consistent lookup.
     */
    function _normalizeUsername(string calldata username) internal pure returns (bytes32) {
        bytes memory b = bytes(username);
        if (b.length < 3 || b.length > 32) revert InvalidUsername();
        bytes memory out = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c >= 0x41 && c <= 0x5A) {
                out[i] = bytes1(uint8(c) + 32);
            } else if (
                (c >= 0x61 && c <= 0x7A) ||
                (c >= 0x30 && c <= 0x39) ||
                c == 0x2E || c == 0x2D || c == 0x5F
            ) {
                out[i] = c;
            } else {
                revert InvalidUsername();
            }
        }
        return keccak256(out);
    }

    /**
     * @notice Register the caller's encryption public key. One-time only.
     * @param pubKey Raw public key bytes (e.g. X25519).
     */
    function registerPublicKey(bytes calldata pubKey) external {
        if (msg.sender == address(0)) revert ZeroAddress();
        if (pubKey.length == 0) revert EmptyPublicKey();
        if (hasRegisteredKey[msg.sender]) revert AlreadyRegistered(msg.sender);
        encryptionPublicKeys[msg.sender] = pubKey;
        hasRegisteredKey[msg.sender] = true;
        emit PublicKeyRegistered(msg.sender, pubKey);
    }

    /**
     * @notice Register a username for the caller. Must be registered first. One-time only.
     * @param username Lowercase alphanumeric, dots, dashes, underscores; 3-32 chars.
     */
    function registerUsername(string calldata username) external {
        if (!hasRegisteredKey[msg.sender]) revert NotRegistered();
        if (addressToUsername[msg.sender] != bytes32(0)) revert UsernameAlreadySet(msg.sender);
        bytes32 h = _normalizeUsername(username);
        if (usernameToAddress[h] != address(0)) revert UsernameTaken(username);
        usernameToAddress[h] = msg.sender;
        addressToUsername[msg.sender] = h;
        usernameOf[msg.sender] = username;
        emit UsernameRegistered(msg.sender, username);
    }

    /**
     * @notice Resolve username to address.
     */
    function getAddressForUsername(string calldata username) external view returns (address) {
        return usernameToAddress[_normalizeUsername(username)];
    }

    /**
     * @notice Send an encrypted message to a recipient.
     * @param recipient Recipient address (must have registered a public key).
     * @param ciphertext Encrypted message payload.
     * @param contentHash Keccak256 of plaintext for integrity verification.
     * @return messageId Assigned message ID for retrieval.
     */
    function sendMessage(
        address recipient,
        bytes calldata ciphertext,
        bytes32 contentHash
    ) external returns (uint256 messageId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (!hasRegisteredKey[recipient]) revert RecipientNotRegistered(recipient);
        if (ciphertext.length == 0) revert EmptyCiphertext();

        messageId = nextMessageId++;
        uint256 refId = 0;

        if (ciphertext.length <= CIPHER_TEXT_INLINE_MAX) {
            messages[messageId] = Message({
                sender: msg.sender,
                recipient: recipient,
                ciphertext: ciphertext,
                ciphertextRef: 0,
                timestamp: block.timestamp,
                contentHash: contentHash
            });
        } else {
            refId = nextCiphertextRefId++;
            largeCiphertexts[refId] = ciphertext;
            messages[messageId] = Message({
                sender: msg.sender,
                recipient: recipient,
                ciphertext: "",
                ciphertextRef: refId,
                timestamp: block.timestamp,
                contentHash: contentHash
            });
        }

        uint256 headPageId = recipientHeadPageId[recipient];
        if (headPageId == 0 || pages[headPageId].count == MESSAGES_PER_PAGE) {
            uint256 newPageId = nextPageId++;
            pages[newPageId].messageIds[0] = messageId;
            pages[newPageId].count = 1;
            pages[newPageId].prevPageIdForRecipient = headPageId;
            recipientHeadPageId[recipient] = newPageId;
        } else {
            Page storage p = pages[headPageId];
            p.messageIds[p.count] = messageId;
            p.count++;
        }

        emit MessageSent(messageId, msg.sender, recipient, block.timestamp, contentHash);
        return messageId;
    }

    /**
     * @notice Fetch a message by ID.
     */
    function getMessage(uint256 messageId) external view returns (Message memory) {
        if (messageId >= nextMessageId) revert InvalidMessageId(messageId);
        return messages[messageId];
    }

    /**
     * @notice Get ciphertext for a message stored by reference.
     */
    function getLargeCiphertext(uint256 refId) external view returns (bytes memory) {
        return largeCiphertexts[refId];
    }

    /**
     * @notice Get the head page ID for a recipient (0 if empty).
     */
    function getRecipientHeadPageId(address recipient) external view returns (uint256) {
        return recipientHeadPageId[recipient];
    }

    /**
     * @notice Get page metadata (message IDs only).
     */
    function getPage(uint256 pageId) external view returns (uint256[MESSAGES_PER_PAGE] memory messageIds, uint8 count, uint256 prevPageIdForRecipient) {
        if (pageId == 0 || pageId >= nextPageId) revert InvalidPageId(pageId);
        Page storage p = pages[pageId];
        return (p.messageIds, p.count, p.prevPageIdForRecipient);
    }

    /**
     * @notice Get page with full message data. One RPC for up to 10 messages.
     */
    function getPageWithMessages(uint256 pageId) external view returns (
        uint8 count,
        uint256 prevPageIdForRecipient,
        Message[MESSAGES_PER_PAGE] memory pageMessages
    ) {
        if (pageId == 0 || pageId >= nextPageId) revert InvalidPageId(pageId);
        Page storage p = pages[pageId];
        count = p.count;
        prevPageIdForRecipient = p.prevPageIdForRecipient;
        for (uint256 i = 0; i < count; i++) {
            pageMessages[i] = messages[p.messageIds[i]];
        }
    }

    /**
     * @notice Get the encryption public key for an address.
     */
    function getPublicKey(address owner) external view returns (bytes memory) {
        return encryptionPublicKeys[owner];
    }

    /**
     * @notice Check if an address has registered a public key.
     */
    function isRegistered(address owner) external view returns (bool) {
        return hasRegisteredKey[owner];
    }

    /**
     * @notice Get the username hash for an address (bytes32 zero if none).
     */
    function getUsernameHash(address owner) external view returns (bytes32) {
        return addressToUsername[owner];
    }
}
