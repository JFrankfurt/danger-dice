// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct RequestStatus {
    bool fulfilled; // Has the VRF request been fulfilled?
    bool exists; // To differentiate from uninitialized requests
    address recipient; // Who made the request?
    uint256 prizeAmount; // Amount won (0 if fulfilled but no prize)
}
contract HonoreDice is VRFConsumerBaseV2Plus {
    // Chainlink VRF variables
    uint256 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private immutable callbackGasLimit;
    uint16 private immutable requestConfirmations;
    uint32 private immutable numWords;

    // USDC token
    IERC20 public immutable usdcToken;

    // Game state
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => RequestStatus) public s_requestStatuses;
    mapping(address => uint256) public totalPrizeAwarded;

    event DiceRolled(
        uint256 indexed requestId,
        uint256 die1,
        uint256 die2,
        uint256 die3,
        uint256 die4,
        uint256 die5,
        uint256 die6
    );
    event PrizeWon(
        uint256 indexed requestId,
        bool hasAllValues,
        uint256 prizeAmount
    );
    event RequestFulfilled(
        uint256 indexed requestId,
        address indexed user,
        uint256 prizeAmount
    );

    /**
     * @dev Constructor initializes the Fortune Cookie contract
     * @param _vrfCoordinator VRF Coordinator address
     * @param _subscriptionId Chainlink VRF subscription ID
     * @param _keyHash VRF key hash for the network
     * @param _callbackGasLimit Gas limit for VRF callback
     * @param _usdcToken USDC token address
     * @param _requestConfirmations Minimum block confirmations for VRF request
     * @param _numWords Number of random words to request
     * @param _requiredNFTAddress Address of the NFT contract required to claim (0x0 for no requirement)
     */
    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        address _usdcToken,
        uint16 _requestConfirmations
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        usdcToken = IERC20(_usdcToken);
        requestConfirmations = _requestConfirmations;
        numWords = 6;
    }

    function rollTheDice() external payable returns (uint256 requestId) {
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient
            .RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            });

        // Request randomness from Chainlink VRF
        requestId = s_vrfCoordinator.requestRandomWords(req);

        s_requestStatuses[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            recipient: msg.sender,
            prizeAmount: 0
        });
        return requestId;
    }

    /**
     * @dev Callback function used by VRF Coordinator to deliver randomness
     * @param requestId Request ID
     * @param randomWords Random words from VRF (6 words)
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        RequestStatus storage status = s_requestStatuses[requestId];
        require(status.exists, "Request not found");
        require(!status.fulfilled, "Request already fulfilled");

        address user = status.recipient;

        // Generate 6 die rolls using different random words
        uint256 randomValue0 = (randomWords[0] % 6) + 1; // 1-6
        uint256 randomValue1 = (randomWords[1] % 6) + 1; // 1-6
        uint256 randomValue2 = (randomWords[2] % 6) + 1; // 1-6
        uint256 randomValue3 = (randomWords[3] % 6) + 1; // 1-6
        uint256 randomValue4 = (randomWords[4] % 6) + 1; // 1-6
        uint256 randomValue5 = (randomWords[5] % 6) + 1; // 1-6

        // Create a mapping to check if all dice values are present
        bool[7] memory diceValues;
        diceValues[randomValue0] = true;
        diceValues[randomValue1] = true;
        diceValues[randomValue2] = true;
        diceValues[randomValue3] = true;
        diceValues[randomValue4] = true;
        diceValues[randomValue5] = true;

        // Check if all values 1-6 are present
        bool hasAllValues = diceValues[1] &&
            diceValues[2] &&
            diceValues[3] &&
            diceValues[4] &&
            diceValues[5] &&
            diceValues[6];

        // Calculate prize amount based on whether all values are present
        uint256 prizeAmount = usdcToken.balanceOf(address(this));

        if (prizeAmount > 0) {
            // Update request status
            status.fulfilled = true;
            status.prizeAmount = prizeAmount;
            // Transfer prize
            totalPrizeAwarded[user] += prizeAmount;
            usdcToken.transfer(user, prizeAmount);
            emit PrizeWon(requestId, hasAllValues, prizeAmount);
        }

        // Emit dice roll result
        emit DiceRolled(
            requestId,
            randomValue0,
            randomValue1,
            randomValue2,
            randomValue3,
            randomValue4,
            randomValue5
        );

        // Emit fulfillment event
        emit RequestFulfilled(requestId, user, prizeAmount);
    }
}
