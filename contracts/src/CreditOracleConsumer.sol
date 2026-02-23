// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface ILoanManager {
    function approveLoan(uint256 loanId, uint256 interestRate) external;
    function rejectLoan(uint256 loanId, string calldata reason) external;
}

/**
 * @title CreditOracleConsumer
 * @notice Chainlink Functions consumer for confidential off-chain credit scoring
 * @dev Requests credit scores via Chainlink DON and processes callbacks to approve/reject loans
 */
contract CreditOracleConsumer is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;
    using Strings for uint256;
    
    // ============ Structs ============
    
    struct CreditRequest {
        address user;
        uint256 loanId;
        uint256 timestamp;
        bool fulfilled;
    }
    
    // ============ State Variables ============
    
    /// @notice Reference to LoanManager contract
    ILoanManager public loanManager;
    
    /// @notice Chainlink Functions subscription ID
    uint64 public subscriptionId;
    
    /// @notice Gas limit for callback
    uint32 public gasLimit;
    
    /// @notice DON ID for Chainlink Functions
    bytes32 public donId;
    
    /// @notice JavaScript source code executed by Chainlink DON
    string public source;
    
    /// @notice Mapping from request ID to credit request details
    mapping(bytes32 => CreditRequest) public requests;
    
    /// @notice Mapping from user to their latest credit score
    mapping(address => uint256) public creditScores;
    
    /// @notice Mapping from user to timestamp of last score update
    mapping(address => uint256) public lastScoreUpdate;
    
    /// @notice Minimum credit score for any approval (650)
    uint256 public constant MIN_CREDIT_SCORE = 650;
    
    /// @notice Premium tier threshold (700)
    uint256 public constant PREMIUM_TIER_THRESHOLD = 700;
    
    /// @notice Premium tier interest rate (5%)
    uint256 public constant PREMIUM_INTEREST_RATE = 5;
    
    /// @notice Standard tier interest rate (10%)
    uint256 public constant STANDARD_INTEREST_RATE = 10;
    
    /// @notice Maximum valid credit score
    uint256 public constant MAX_CREDIT_SCORE = 850;
    
    // ============ Events ============
    
    event CreditScoreRequested(
        bytes32 indexed requestId,
        address indexed user,
        uint256 indexed loanId
    );
    
    event CreditScoreFulfilled(
        bytes32 indexed requestId,
        address indexed user,
        uint256 score,
        uint256 loanId
    );
    
    event RequestError(
        bytes32 indexed requestId,
        bytes err
    );
    
    event SourceUpdated(string newSource);
    event SubscriptionIdUpdated(uint64 oldId, uint64 newId);
    event GasLimitUpdated(uint32 oldLimit, uint32 newLimit);
    event LoanManagerSet(address indexed oldManager, address indexed newManager);
    
    // ============ Errors ============
    
    error InvalidCreditScore(uint256 score);
    error RequestNotFound(bytes32 requestId);
    error RequestAlreadyFulfilled(bytes32 requestId);
    error ZeroAddress();
    error EmptySource();
    
    // ============ Constructor ============
    
    /**
     * @param router Chainlink Functions router address
     * @param _donId DON ID for the network
     * @param _subscriptionId Subscription ID for Chainlink Functions
     */
    constructor(
        address router,
        bytes32 _donId,
        uint64 _subscriptionId
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        donId = _donId;
        subscriptionId = _subscriptionId;
        gasLimit = 300000; // Default gas limit for callback
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Request credit score for a user
     * @param user Address of the user to check
     * @param loanId Associated loan ID
     * @return requestId Chainlink request ID
     */
    function requestCreditScore(
        address user,
        uint256 loanId
    ) external returns (bytes32 requestId) {
        // Validate inputs
        require(user != address(0), "Invalid user address");
        require(bytes(source).length > 0, "Source not set");
        
        // Build Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequest(
            FunctionsRequest.Location.Inline,
            FunctionsRequest.CodeLanguage.JavaScript,
            source
        );
        
        // Build arguments for Chainlink Functions
        string[] memory args = new string[](1);
        args[0] = Strings.toHexString(uint256(uint160(user)), 20); // Convert address to hex string
        req.setArgs(args);
        
        // Encode request to CBOR
        bytes memory encodedRequest = req.encodeCBOR();
        
        // Send request to Chainlink DON
        requestId = _sendRequest(
            encodedRequest,
            subscriptionId,
            gasLimit,
            donId
        );
        
        // Store request details
        requests[requestId] = CreditRequest({
            user: user,
            loanId: loanId,
            timestamp: block.timestamp,
            fulfilled: false
        });
        
        emit CreditScoreRequested(requestId, user, loanId);
        
        return requestId;
    }
    
    /**
     * @notice Callback function for Chainlink Functions
     * @param requestId The request ID
     * @param response Encoded response from DON
     * @param err Error bytes if request failed
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        // Validate request exists
        CreditRequest storage request = requests[requestId];
        if (request.user == address(0)) {
            revert RequestNotFound(requestId);
        }
        if (request.fulfilled) {
            revert RequestAlreadyFulfilled(requestId);
        }
        
        // Mark as fulfilled
        request.fulfilled = true;
        
        // Handle errors
        if (err.length > 0) {
            emit RequestError(requestId, err);
            // Reject loan on error
            loanManager.rejectLoan(request.loanId, "Credit check failed");
            return;
        }
        
        // Decode credit score
        uint256 creditScore = abi.decode(response, (uint256));
        
        // Validate score range
        if (creditScore > MAX_CREDIT_SCORE) {
            revert InvalidCreditScore(creditScore);
        }
        
        // Update user's credit score
        creditScores[request.user] = creditScore;
        lastScoreUpdate[request.user] = block.timestamp;
        
        emit CreditScoreFulfilled(requestId, request.user, creditScore, request.loanId);
        
        // Apply credit decision logic
        _processCreditDecision(request.loanId, creditScore);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Process credit decision based on score
     * @param loanId Loan ID to process
     * @param score Credit score
     */
    function _processCreditDecision(uint256 loanId, uint256 score) internal {
        if (score >= PREMIUM_TIER_THRESHOLD) {
            // Premium tier: score >= 700 → 5% interest
            loanManager.approveLoan(loanId, PREMIUM_INTEREST_RATE);
        } else if (score >= MIN_CREDIT_SCORE) {
            // Standard tier: 650-699 → 10% interest
            loanManager.approveLoan(loanId, STANDARD_INTEREST_RATE);
        } else {
            // Reject: score < 650
            loanManager.rejectLoan(loanId, "Credit score too low");
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the JavaScript source code for Chainlink Functions
     * @param _source JavaScript source code
     */
    function setSource(string calldata _source) external onlyOwner {
        if (bytes(_source).length == 0) revert EmptySource();
        source = _source;
        emit SourceUpdated(_source);
    }
    
    /**
     * @notice Update subscription ID
     * @param _subscriptionId New subscription ID
     */
    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        uint64 oldId = subscriptionId;
        subscriptionId = _subscriptionId;
        emit SubscriptionIdUpdated(oldId, _subscriptionId);
    }
    
    /**
     * @notice Update gas limit for callbacks
     * @param _gasLimit New gas limit
     */
    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        uint32 oldLimit = gasLimit;
        gasLimit = _gasLimit;
        emit GasLimitUpdated(oldLimit, _gasLimit);
    }
    
    /**
     * @notice Set the LoanManager contract address
     * @param _loanManager Address of LoanManager
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        if (_loanManager == address(0)) revert ZeroAddress();
        
        address oldManager = address(loanManager);
        loanManager = ILoanManager(_loanManager);
        
        emit LoanManagerSet(oldManager, _loanManager);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get credit score for a user
     * @param user User address
     * @return score Credit score
     * @return timestamp Last update timestamp
     */
    function getCreditScore(address user) 
        external 
        view 
        returns (uint256 score, uint256 timestamp) 
    {
        return (creditScores[user], lastScoreUpdate[user]);
    }
    
    /**
     * @notice Get request details
     * @param requestId Request ID
     * @return request Credit request struct
     */
    function getRequest(bytes32 requestId) 
        external 
        view 
        returns (CreditRequest memory) 
    {
        return requests[requestId];
    }
}
