// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ILendingPool {
    function provideLoan(address borrower, uint256 amount) external;
    function receiveLoanRepayment(address borrower) external payable;
}

interface ICreditOracleConsumer {
    function requestCreditScore(address user, uint256 loanId) external returns (bytes32 requestId);
}

/**
 * @title LoanManager
 * @notice Manages the complete lifecycle of loans including requests, approvals, and repayments
 * @dev Integrates with CreditOracleConsumer for credit verification and LendingPool for funding
 */
contract LoanManager is Ownable, ReentrancyGuard {
    // ============ Structs ============
    
    struct Loan {
        address borrower;
        uint256 amount;
        uint256 interestRate; // In percentage (e.g., 5 for 5%)
        bool approved;
        bool repaid;
        uint256 loanedAt; // Timestamp when loan was funded
        bytes32 requestId; // Chainlink request ID
    }
    
    // ============ State Variables ============
    
    /// @notice Counter for generating unique loan IDs
    uint256 public loanIdCounter;
    
    /// @notice Mapping from loan ID to Loan struct
    mapping(uint256 => Loan) public loans;
    
    /// @notice Mapping from Chainlink request ID to loan ID
    mapping(bytes32 => uint256) public requestIdToLoanId;
    
    /// @notice Mapping to track if a user has a pending loan
    mapping(address => bool) public hasPendingLoan;
    
    /// @notice Reference to LendingPool contract
    ILendingPool public lendingPool;
    
    /// @notice Reference to CreditOracleConsumer contract
    ICreditOracleConsumer public creditOracle;
    
    /// @notice Minimum loan amount (0.01 ETH)
    uint256 public constant MIN_LOAN_AMOUNT = 0.01 ether;
    
    /// @notice Maximum loan amount (100 ETH)
    uint256 public constant MAX_LOAN_AMOUNT = 100 ether;
    
    // ============ Events ============
    
    event LoanRequested(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        bytes32 requestId
    );
    
    event LoanApproved(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 interestRate
    );
    
    event LoanRejected(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        string reason
    );
    
    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principalAmount,
        uint256 interestAmount,
        uint256 totalRepaid
    );
    
    event LendingPoolSet(address indexed oldPool, address indexed newPool);
    event CreditOracleSet(address indexed oldOracle, address indexed newOracle);
    
    // ============ Errors ============
    
    error InvalidLoanAmount(uint256 amount);
    error PendingLoanExists();
    error LoanNotFound(uint256 loanId);
    error LoanNotApproved(uint256 loanId);
    error LoanAlreadyRepaid(uint256 loanId);
    error UnauthorizedCaller(address caller);
    error InsufficientRepayment(uint256 required, uint256 provided);
    error ZeroAddress();
    error NotBorrower(address caller, address borrower);
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}
    
    // ============ Modifiers ============
    
    modifier onlyCreditOracle() {
        if (msg.sender != address(creditOracle)) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Request a new loan
     * @param amount Loan amount in wei
     * @dev Triggers credit score request from oracle
     */
    function requestLoan(uint256 amount) external nonReentrant returns (uint256 loanId) {
        // Validate amount
        if (amount < MIN_LOAN_AMOUNT || amount > MAX_LOAN_AMOUNT) {
            revert InvalidLoanAmount(amount);
        }
        
        // Check for existing pending loan
        if (hasPendingLoan[msg.sender]) {
            revert PendingLoanExists();
        }
        
        // Create new loan
        loanId = ++loanIdCounter;
        
        loans[loanId] = Loan({
            borrower: msg.sender,
            amount: amount,
            interestRate: 0,
            approved: false,
            repaid: false,
            loanedAt: 0,
            requestId: bytes32(0)
        });
        
        // Mark user as having pending loan
        hasPendingLoan[msg.sender] = true;
        
        // Request credit score from oracle
        bytes32 requestId = creditOracle.requestCreditScore(msg.sender, loanId);
        
        // Update loan with request ID
        loans[loanId].requestId = requestId;
        requestIdToLoanId[requestId] = loanId;
        
        emit LoanRequested(loanId, msg.sender, amount, requestId);
    }
    
    /**
     * @notice Approve a loan after credit verification (only callable by CreditOracle)
     * @param loanId ID of the loan to approve
     * @param interestRate Interest rate for the loan (in percentage)
     * @dev Triggers loan funding from LendingPool
     */
    function approveLoan(uint256 loanId, uint256 interestRate) external onlyCreditOracle nonReentrant {
        Loan storage loan = loans[loanId];
        
        // Validate loan exists and is not already processed
        if (loan.borrower == address(0)) {
            revert LoanNotFound(loanId);
        }
        if (loan.approved) {
            return; // Already approved, skip
        }
        
        // Update loan status
        loan.approved = true;
        loan.interestRate = interestRate;
        loan.loanedAt = block.timestamp;
        
        // Clear pending loan flag
        hasPendingLoan[loan.borrower] = false;
        
        emit LoanApproved(loanId, loan.borrower, loan.amount, interestRate);
        
        // Provide loan from pool
        lendingPool.provideLoan(loan.borrower, loan.amount);
    }
    
    /**
     * @notice Reject a loan after credit verification (only callable by CreditOracle)
     * @param loanId ID of the loan to reject
     * @param reason Reason for rejection
     */
    function rejectLoan(uint256 loanId, string calldata reason) external onlyCreditOracle {
        Loan storage loan = loans[loanId];
        
        if (loan.borrower == address(0)) {
            revert LoanNotFound(loanId);
        }
        
        // Clear pending loan flag
        hasPendingLoan[loan.borrower] = false;
        
        emit LoanRejected(loanId, loan.borrower, loan.amount, reason);
    }
    
    /**
     * @notice Repay a loan with interest
     * @param loanId ID of the loan to repay
     * @dev Calculates interest based on time elapsed and interest rate
     */
    function repayLoan(uint256 loanId) external payable nonReentrant {
        Loan storage loan = loans[loanId];
        
        // Validate loan
        if (loan.borrower == address(0)) {
            revert LoanNotFound(loanId);
        }
        if (msg.sender != loan.borrower) {
            revert NotBorrower(msg.sender, loan.borrower);
        }
        if (!loan.approved) {
            revert LoanNotApproved(loanId);
        }
        if (loan.repaid) {
            revert LoanAlreadyRepaid(loanId);
        }
        
        // Calculate interest
        uint256 daysElapsed = (block.timestamp - loan.loanedAt) / 1 days;
        if (daysElapsed == 0) {
            daysElapsed = 1; // Minimum 1 day of interest
        }
        
        // Interest = principal * rate * days / 365 / 100
        uint256 interest = (loan.amount * loan.interestRate * daysElapsed) / 365 / 100;
        uint256 totalRepayment = loan.amount + interest;
        
        // Validate repayment amount
        if (msg.value < totalRepayment) {
            revert InsufficientRepayment(totalRepayment, msg.value);
        }
        
        // Mark as repaid
        loan.repaid = true;
        
        emit LoanRepaid(loanId, loan.borrower, loan.amount, interest, totalRepayment);
        
        // Send repayment to lending pool
        lendingPool.receiveLoanRepayment{value: totalRepayment}(loan.borrower);
        
        // Refund excess if any
        if (msg.value > totalRepayment) {
            uint256 refund = msg.value - totalRepayment;
            (bool success, ) = msg.sender.call{value: refund}("");
            require(success, "Refund failed");
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the LendingPool contract address
     * @param _lendingPool Address of the LendingPool contract
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        if (_lendingPool == address(0)) revert ZeroAddress();
        
        address oldPool = address(lendingPool);
        lendingPool = ILendingPool(_lendingPool);
        
        emit LendingPoolSet(oldPool, _lendingPool);
    }
    
    /**
     * @notice Set the CreditOracleConsumer contract address
     * @param _creditOracle Address of the CreditOracleConsumer contract
     */
    function setCreditOracle(address _creditOracle) external onlyOwner {
        if (_creditOracle == address(0)) revert ZeroAddress();
        
        address oldOracle = address(creditOracle);
        creditOracle = ICreditOracleConsumer(_creditOracle);
        
        emit CreditOracleSet(oldOracle, _creditOracle);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get loan details
     * @param loanId ID of the loan
     * @return Loan struct
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }
    
    /**
     * @notice Calculate repayment amount for a loan
     * @param loanId ID of the loan
     * @return totalRepayment Total amount to repay (principal + interest)
     * @return principal Principal amount
     * @return interest Interest amount
     */
    function calculateRepayment(uint256 loanId) 
        external 
        view 
        returns (uint256 totalRepayment, uint256 principal, uint256 interest) 
    {
        Loan storage loan = loans[loanId];
        
        if (loan.borrower == address(0) || !loan.approved || loan.repaid) {
            return (0, 0, 0);
        }
        
        uint256 daysElapsed = (block.timestamp - loan.loanedAt) / 1 days;
        if (daysElapsed == 0) {
            daysElapsed = 1;
        }
        
        principal = loan.amount;
        interest = (loan.amount * loan.interestRate * daysElapsed) / 365 / 100;
        totalRepayment = principal + interest;
    }
}
