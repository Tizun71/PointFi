// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LendingPool
 * @notice Manages liquidity deposits and loan funding for the lending protocol
 * @dev Uses OpenZeppelin's ReentrancyGuard and Ownable for security
 */
contract LendingPool is Ownable, ReentrancyGuard {
    // ============ State Variables ============
    
    /// @notice Tracks deposits for each liquidity provider
    mapping(address => uint256) public deposits;
    
    /// @notice Total liquidity available in the pool
    uint256 public totalLiquidity;
    
    /// @notice Address of the LoanManager contract authorized to provide loans
    address public loanManager;
    
    // ============ Events ============
    
    event Deposited(address indexed provider, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed provider, uint256 amount, uint256 remainingBalance);
    event LoanProvided(address indexed borrower, uint256 amount, uint256 remainingLiquidity);
    event LoanRepaid(address indexed borrower, uint256 amount, uint256 newLiquidity);
    event LoanManagerSet(address indexed oldManager, address indexed newManager);
    
    // ============ Errors ============
    
    error InsufficientBalance(uint256 requested, uint256 available);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error UnauthorizedCaller(address caller);
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();
    
    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}
    
    // ============ Modifiers ============
    
    modifier onlyLoanManager() {
        if (msg.sender != loanManager) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Deposit ETH into the lending pool to provide liquidity
     * @dev Increases both user balance and total liquidity
     */
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        
        deposits[msg.sender] += msg.value;
        totalLiquidity += msg.value;
        
        emit Deposited(msg.sender, msg.value, deposits[msg.sender]);
    }
    
    /**
     * @notice Withdraw deposited ETH from the pool
     * @param amount Amount of ETH to withdraw
     * @dev Uses pull-over-push pattern for security
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (deposits[msg.sender] < amount) {
            revert InsufficientBalance(amount, deposits[msg.sender]);
        }
        
        // Checks-Effects-Interactions pattern
        deposits[msg.sender] -= amount;
        totalLiquidity -= amount;
        
        emit Withdrawn(msg.sender, amount, deposits[msg.sender]);
        
        // Transfer after state changes
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    /**
     * @notice Provide a loan to a borrower (only callable by LoanManager)
     * @param borrower Address receiving the loan
     * @param amount Loan amount in wei
     * @dev Transfers funds directly to borrower
     */
    function provideLoan(address borrower, uint256 amount) external onlyLoanManager nonReentrant {
        if (borrower == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (totalLiquidity < amount) {
            revert InsufficientLiquidity(amount, totalLiquidity);
        }
        
        // Update state before transfer
        totalLiquidity -= amount;
        
        emit LoanProvided(borrower, amount, totalLiquidity);
        
        // Transfer loan to borrower
        (bool success, ) = borrower.call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    /**
     * @notice Receive loan repayment (only callable by LoanManager)
     * @dev Increases total liquidity when loans are repaid
     */
    function receiveLoanRepayment(address borrower) external payable onlyLoanManager {
        if (msg.value == 0) revert ZeroAmount();
        
        totalLiquidity += msg.value;
        
        emit LoanRepaid(borrower, msg.value, totalLiquidity);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the authorized LoanManager contract address
     * @param _loanManager Address of the LoanManager contract
     * @dev Only owner can set this
     */
    function setLoanManager(address _loanManager) external onlyOwner {
        if (_loanManager == address(0)) revert ZeroAddress();
        
        address oldManager = loanManager;
        loanManager = _loanManager;
        
        emit LoanManagerSet(oldManager, _loanManager);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get deposit balance for a specific provider
     * @param provider Address of the liquidity provider
     * @return Balance of the provider
     */
    function getDeposit(address provider) external view returns (uint256) {
        return deposits[provider];
    }
    
    /**
     * @notice Get total available liquidity in the pool
     * @return Total liquidity
     */
    function getTotalLiquidity() external view returns (uint256) {
        return totalLiquidity;
    }
}
