// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LendingPool.sol";
import "../src/LoanManager.sol";
import "../src/CreditOracleConsumer.sol";

contract MockFunctionsRouter {
    mapping(bytes32 => address) public requestToConsumer;
    uint256 private requestCounter;
    
    function sendRequest(
        uint64,
        bytes calldata,
        uint16,
        uint32,
        bytes32
    ) external returns (bytes32) {
        bytes32 requestId = keccak256(abi.encodePacked(block.timestamp, requestCounter++));
        requestToConsumer[requestId] = msg.sender;
        return requestId;
    }
    
    function fulfillRequest(
        address consumer,
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external {
        CreditOracleConsumer(consumer).handleOracleFulfillment(requestId, response, err);
    }
}

contract BaseTest is Test {
    LendingPool public lendingPool;
    LoanManager public loanManager;
    CreditOracleConsumer public creditOracle;
    MockFunctionsRouter public mockRouter;
    
    address public owner = address(this);
    address public liquidityProvider = address(0x1);
    address public borrower = address(0x2);
    address public attacker = address(0x3);
    
    bytes32 constant DON_ID = bytes32(0);
    uint64 constant SUBSCRIPTION_ID = 1;
    
    event Deposited(address indexed provider, uint256 amount, uint256 newBalance);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, bytes32 requestId);
    event LoanApproved(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate);
    event LoanRejected(uint256 indexed loanId, address indexed borrower, uint256 amount, string reason);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 principalAmount, uint256 interestAmount, uint256 totalRepaid);
    
    function setUp() public virtual {
        mockRouter = new MockFunctionsRouter();
        
        lendingPool = new LendingPool();
        loanManager = new LoanManager();
        creditOracle = new CreditOracleConsumer(
            address(mockRouter),
            DON_ID,
            SUBSCRIPTION_ID
        );
        
        lendingPool.setLoanManager(address(loanManager));
        loanManager.setLendingPool(address(lendingPool));
        loanManager.setCreditOracle(address(creditOracle));
        creditOracle.setLoanManager(address(loanManager));
        
        creditOracle.setSource("mock source code");
        
        vm.deal(liquidityProvider, 100 ether);
        vm.deal(borrower, 10 ether);
        vm.deal(attacker, 10 ether);
    }
}
